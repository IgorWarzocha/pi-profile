import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { buildProfile, createStreamState, dedupeSessions, finalizeStream, ingestLine } from "./profile-lib.js";

const root = new URL("..", import.meta.url).pathname;
const machines = [
  { machine: "server", host: null },
  { machine: "desktop", host: process.env.PI_DESKTOP_HOST ?? "desktop" },
  { machine: "laptop", host: process.env.PI_LAPTOP_HOST ?? "laptop" },
];
const remoteCommand = "find ~/.pi/agent/sessions -type f -name '*.jsonl' -exec cat {} \\;";

async function collect({ machine, host }) {
  const startedAt = new Date().toISOString();
  const state = createStreamState(machine);
  const child = host
    ? spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, remoteCommand])
    : spawn("bash", ["-lc", remoteCommand]);
  let buffer = "", stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  for await (const chunk of child.stdout) {
    buffer += chunk;
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) ingestLine(state, line);
  }
  ingestLine(state, buffer);
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(stderr.trim() || `${machine} exited ${code}`);
  return { machine, ok: true, startedAt, completedAt: new Date().toISOString(), malformedLines: state.malformedLines, sessions: finalizeStream(state) };
}

const collections = await Promise.all(machines.map(async (machine) => {
  try { return await collect(machine); }
  catch (error) { console.error(`${machine.machine}: ${String(error.message ?? error)}`); return { machine: machine.machine, ok: false, error: "collection failed", malformedLines: 0, sessions: [] }; }
}));
const failed = collections.filter((collection) => !collection.ok);
if (failed.length && process.env.PI_ALLOW_PARTIAL !== "1") throw new Error(`Refusing to publish a partial profile; unavailable: ${failed.map((item) => item.machine).join(", ")}`);
const sessions = dedupeSessions(collections);
const profile = buildProfile(sessions, collections);

await mkdir(`${root}data`, { recursive: true });
await mkdir(`${root}capsule/shared`, { recursive: true });
await writeFile(`${root}data/profile.json`, JSON.stringify({ ...profile, sessions }, null, 2));
await writeFile(`${root}capsule/shared/default-profile.ts`, `export const DEFAULT_PROFILE = ${JSON.stringify(profile)} as const;\n`);

console.log(JSON.stringify({
  machines: profile.machines,
  uniqueSessions: profile.totals.sessions,
  duplicatesRemoved: profile.totals.duplicatesRemoved,
  tokens: profile.totals.totalTokens,
  toolCalls: profile.totals.toolCalls,
  generatedAt: profile.generatedAt,
}, null, 2));
