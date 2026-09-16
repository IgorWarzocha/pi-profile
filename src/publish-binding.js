// Loaded by Pi's notebook. All credentials stay inside the existing tools.
export function createPiProfileBinding(tools, projectDir) {
  async function run(cmd) {
    let result = await tools.exec_command({
      cmd, workdir: projectDir, yield_time_ms: 1000, max_output_tokens: 3000,
    });
    let output = result.output ?? "";
    while (result.session_id) {
      result = await tools.write_stdin({
        session_id: result.session_id, chars: "", yield_time_ms: 1000, max_output_tokens: 3000,
      });
      output += result.output ?? "";
    }
    if (result.exit_code !== 0) throw new Error(`${cmd}: exit ${result.exit_code}\n${output}`);
    return output;
  }

  async function sites(resource, action, params = {}) {
    const response = JSON.parse(await tools.sites(JSON.stringify({
      resource, action, params: { project_dir: projectDir, ...params },
    })));
    if (!response.ok) throw new Error(JSON.stringify(response));
    return response.result;
  }

  async function deploySites() {
    const version = await sites("version", "save");
    if (!version.id) throw new Error(`Missing saved version ID: ${JSON.stringify(version)}`);
    let deployment = await sites("deployment", "deploy", {
      version_id: version.id, visibility: "shared",
    });
    const deploymentId = deployment.id;
    for (let attempt = 0; attempt < 60 &&
      ["pending", "building", "publishing"].includes(deployment.status); attempt++) {
      if (!deploymentId) throw new Error("Missing deployment ID");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      deployment = await sites("deployment", "status", { deployment_id: deploymentId });
    }
    return { version, deployment };
  }

  return {
    description: "Collect once, validate both apps, commit only public snapshots, and update both existing public sites.",
    usage: "await piProfile.publish() after explicit publication approval. Requires clean master, configured Lakebed login and Sites tools. Use { refresh: false } to validate and republish the committed snapshot. Returns separate deployment results; inspect Sites status.",
    async publish({ refresh = true } = {}) {
      await run('test "$(git branch --show-current)" = master && test -z "$(git status --porcelain)" && mkdir .git/pi-profile-publish.lock');
      try {
        await run(refresh ? "npm run aggregate && npm run check" : "npm run check");
        await run("git add -- shared/profile.ts shared/profile-overview.ts");
        await run('git diff --cached --quiet || git commit -m "Refresh shared Pi profile snapshot"');
        await run("git push origin master");
        // Both builds pass before either production destination is changed.
        const results = await Promise.allSettled([
          run("timeout 180s npm run deploy"),
          deploySites(),
        ]);
        return Object.fromEntries(["lakebed", "sites"].map((name, index) => {
          const result = results[index];
          return [name, result.status === "fulfilled"
            ? { result: result.value }
            : { error: String(result.reason) }];
        }));
      } finally {
        await run("rmdir .git/pi-profile-publish.lock");
      }
    },
  };
}
