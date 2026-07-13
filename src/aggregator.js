import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collect } from "./collector.js";

const exec = promisify(execFile);
export const MACHINE_PRIORITY = ["server", "desktop", "laptop"];

export async function collectMachines(config) {
  const results = [];
  for (const machine of MACHINE_PRIORITY) {
    const spec = config[machine];
    if (!spec) continue;
    const startedAt = new Date().toISOString();
    try {
      let sessions;
      if (spec.host) {
        const { stdout } = await exec("ssh", [spec.host, "node", spec.collector ?? "~/.local/bin/pi-profile-collect", "--json"], { maxBuffer: 64 * 1024 * 1024 });
        sessions = JSON.parse(stdout);
      } else {
        sessions = await collect({ machine, sessionsDir: spec.sessionsDir });
      }
      results.push({ machine, ok: true, startedAt, completedAt: new Date().toISOString(), sessions });
    } catch (error) {
      results.push({ machine, ok: false, startedAt, completedAt: new Date().toISOString(), error: String(error.message ?? error), sessions: [] });
    }
  }
  return results;
}

export function dedupe(machineResults) {
  const selected = new Map();
  const provenance = new Map();
  for (const result of machineResults) for (const session of result.sessions) {
    const id = session.sessionId;
    const existing = selected.get(id);
    provenance.set(id, [...(provenance.get(id) ?? []), session.machine]);
    if (!existing || priority(session.machine) < priority(existing.machine)) selected.set(id, session);
  }
  return [...selected.values()].map((session) => ({
    ...session,
    availableMachines: [...new Set(provenance.get(session.sessionId))],
    selectedMachine: session.machine,
    duplicateCount: provenance.get(session.sessionId).length
  })).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

function priority(machine) { return MACHINE_PRIORITY.indexOf(machine); }
