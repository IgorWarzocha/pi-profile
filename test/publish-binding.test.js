import assert from "node:assert/strict";
import test from "node:test";
import { createPiProfileBinding } from "../src/publish-binding.js";

function harness({ failCommand, failSites = false, yielded = false } = {}) {
  const commands = [], calls = [];
  const tools = {
    async exec_command({ cmd }) {
      commands.push(cmd);
      if (cmd === failCommand) return { output: "failed", exit_code: 1 };
      if (yielded && cmd === "npm run aggregate && npm run check") return { output: "", session_id: 7 };
      return { output: "", exit_code: 0 };
    },
    async write_stdin({ session_id }) {
      assert.equal(session_id, 7);
      return { output: "validated", exit_code: 0 };
    },
    async sites(input) {
      const call = JSON.parse(input);
      calls.push(call);
      if (failSites) return JSON.stringify({ ok: false, error: "unavailable" });
      return JSON.stringify({ ok: true, result: call.resource === "version"
        ? { id: "opaque-version" } : { id: "opaque-deployment", status: "ready" } });
    },
  };
  return { commands, calls, binding: createPiProfileBinding(tools, "/project") };
}

test("validation failure prevents commits and both deployments, releasing the lock", async () => {
  const h = harness({ failCommand: "npm run aggregate && npm run check" });
  await assert.rejects(h.binding.publish(), /failed/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.commands.at(-1), "rmdir .git/pi-profile-publish.lock");
  assert.ok(!h.commands.some((cmd) => cmd.startsWith("git add")));
});

test("publication awaits validation, stages only snapshots, and deploys the saved version", async () => {
  const h = harness({ yielded: true });
  const result = await h.binding.publish();
  assert.ok(result.lakebed.result !== undefined);
  assert.equal(result.sites.result.deployment.status, "ready");
  assert.equal(h.commands[2], "git add -- shared/profile.ts shared/profile-overview.ts");
  assert.equal(h.calls[1].params.version_id, "opaque-version");
  assert.equal(h.calls[1].params.visibility, "shared");
});

test("Sites failure does not hide a successful Lakebed publication", async () => {
  const h = harness({ failSites: true });
  const result = await h.binding.publish();
  assert.ok(result.sites.error.includes("unavailable"));
  assert.equal(result.lakebed.result, "");
});

test("explicit retry validates the committed snapshot without recollecting", async () => {
  const h = harness();
  await h.binding.publish({ refresh: false });
  assert.equal(h.commands[1], "npm run check");
  assert.ok(!h.commands.some((cmd) => cmd.includes("npm run aggregate")));
});
