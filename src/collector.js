import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { analyzeText, addCounts } from "./analyzer.js";

export const defaultSessionsDir = join(homedir(), ".pi", "agent", "sessions");

export async function collect({ machine, sessionsDir = defaultSessionsDir }) {
  const sessions = [];
  await walk(sessionsDir, async (file) => sessions.push(await readSession(file, machine, sessionsDir)));
  return sessions.filter(Boolean).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

async function walk(dir, visit) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, visit);
    else if (entry.name.endsWith(".jsonl")) await visit(path);
  }
}

async function readSession(file, machine, root) {
  let meta, lastTimestamp, userMessages = 0, assistantMessages = 0, toolCalls = 0;
  let tokens = { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
  let cost = 0, text = "", models = [], reasoning = [], events = 0;
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    events++; lastTimestamp = e.timestamp ?? lastTimestamp;
    if (e.type === "session") meta = e;
    if (e.type === "model_change" && e.modelId) models.push(e.modelId);
    if (e.type === "thinking_level_change" && e.thinkingLevel) reasoning.push(e.thinkingLevel);
    if (e.type === "tool_call" || e.type === "tool_result" || e.type === "toolCall" || e.type === "toolResult") toolCalls++;
    if (e.type === "message" && e.message) {
      const role = e.message.role;
      if (role === "user") userMessages++;
      if (role === "assistant") assistantMessages++;
      if (role === "user") text += "\n" + content(e.message.content);
      const usage = e.message.usage;
      if (usage) {
        tokens.input += usage.input ?? 0; tokens.output += usage.output ?? 0;
        tokens.total += usage.totalTokens ?? usage.total ?? 0;
        tokens.cacheRead += usage.cacheRead ?? 0; tokens.cacheWrite += usage.cacheWrite ?? 0;
        tokens.reasoning += usage.reasoning ?? 0;
        cost += usage.cost?.total ?? 0;
      }
    }
  }
  if (!meta?.id) return null;
  const language = analyzeText(text);
  return {
    sessionId: meta.id, machine, startedAt: meta.timestamp, endedAt: lastTimestamp ?? meta.timestamp,
    cwd: meta.cwd, sourcePath: relative(root, file), events, userMessages, assistantMessages, toolCalls,
    models: [...new Set(models)], reasoning: [...new Set(reasoning)], tokens, cost, language
  };
}

function content(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.filter((p) => p?.type === "text").map((p) => p.text ?? "").join(" ");
}

export function summarize(sessions) {
  const language = {};
  const days = new Map();
  const tokens = { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
  let cost = 0, toolCalls = 0;
  const models = new Map(), projects = new Map();
  for (const s of sessions) {
    addCounts(language, s.language);
    const day = s.startedAt.slice(0, 10); days.set(day, (days.get(day) ?? 0) + 1);
    for (const key of Object.keys(tokens)) tokens[key] += s.tokens[key] ?? 0;
    cost += s.cost ?? 0; toolCalls += s.toolCalls;
    for (const model of s.models) models.set(model, (models.get(model) ?? 0) + 1);
    const project = s.cwd ?? "unknown"; projects.set(project, (projects.get(project) ?? 0) + 1);
  }
  return { sessionCount: sessions.length, activeDays: days.size, sessionsByDay: Object.fromEntries(days), tokens, cost, toolCalls,
    cacheHitRate: tokens.input + tokens.cacheRead ? tokens.cacheRead / (tokens.input + tokens.cacheRead) : 0,
    models: Object.fromEntries(models), projects: Object.fromEntries(projects), language };
}
