import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

const COUNTS = ["events", "userMessages", "assistantMessages", "toolCalls", "toolResults", "toolErrors", "thinkingParts", "imageParts", "compactions"];
const USAGE = ["inputTokens", "outputTokens", "totalTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens", "cost"];
const DAILY = ["tokens", "outputTokens", "toolCalls", "messages", "cost", "courtesy", "collaboration", "friction"];

// The existing local metadata snapshot is the history store. Never read raw text here.
export async function withSessionHistory(file, collect, publish) {
  const lock = `${file}.lock`;
  await mkdir(lock);
  try {
    let previous;
    try { previous = JSON.parse(await readFile(file, "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (previous !== undefined && (!previous || previous.schemaVersion !== 3 || !Array.isArray(previous.sessions))) {
      throw new Error("Unsupported session history; refusing to replace it");
    }
    const sessions = (previous?.sessions ?? []).map(sessionSummary);
    if (new Set(sessions.map((s) => s.sessionId)).size !== sessions.length) {
      throw new Error("Duplicate IDs in session history");
    }
    const result = await collect(sessions);
    const snapshot = { ...result, sessions: result.sessions.map(sessionSummary) };
    const temporary = `${file}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(snapshot, null, 2));
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
    if (publish) await publish(snapshot);
    return snapshot;
  } finally {
    await rm(lock, { recursive: true });
  }
}

export function retainSessions(previous, live) {
  const sessions = new Map(previous.map((s) => [s.sessionId, s]));
  // A stale synced copy must not erase the fuller summary after the original is deleted.
  for (const session of live) {
    const saved = sessions.get(session.sessionId);
    if (!saved || session.counts.events >= saved.counts.events) sessions.set(session.sessionId, session);
  }
  return [...sessions.values()].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid session history object");
  return value;
}

function string(value) {
  if (typeof value !== "string" || !value.length) throw new Error("Invalid session history string");
  return value;
}

function number(value) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid session history number");
  return value;
}

function numbers(value, keys = Object.keys(object(value))) {
  object(value);
  return Object.fromEntries(keys.map((key) => [key, number(value[key])]));
}

function map(value, project) {
  return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, project(item)]));
}

function timestamp(value) {
  string(value);
  if (!Number.isFinite(Date.parse(value))) throw new Error("Invalid session history timestamp");
  return value;
}

function sessionSummary(value) {
  const s = object(value);
  // An allowlist drops legacy cwd and any unknown fields rather than preserving text.
  return {
    sessionId: string(s.sessionId), machine: string(s.machine),
    startedAt: timestamp(s.startedAt), endedAt: timestamp(s.endedAt),
    projectKey: string(s.projectKey), projectName: string(s.projectName),
    observedDurationMs: number(s.observedDurationMs), activeDurationMs: number(s.activeDurationMs),
    counts: numbers(s.counts, COUNTS), usage: numbers(s.usage, USAGE),
    models: map(s.models, (m) => ({
      ...(m.provider === undefined ? {} : { provider: string(m.provider) }),
      ...numbers(m, ["messages", "tokens", "outputTokens", "cost", "toolCalls"]),
    })),
    tools: map(s.tools, (t) => numbers(t, ["calls", "results", "errors"])),
    reasoningLevels: numbers(s.reasoningLevels), language: map(s.language, (group) => numbers(group)),
    daily: Object.fromEntries(Object.entries(object(s.daily)).map(([day, metrics]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid session history day");
      timestamp(day);
      return [day, numbers(metrics, DAILY)];
    })),
    maxTokensBeforeCompaction: number(s.maxTokensBeforeCompaction),
    ...(s.latestModel === undefined ? {} : { latestModel: string(s.latestModel) }),
    availableMachines: Array.isArray(s.availableMachines) ? s.availableMachines.map(string) : [string(s.machine)],
    duplicateCount: number(s.duplicateCount ?? 1),
    variantConflict: s.variantConflict === true,
  };
}
