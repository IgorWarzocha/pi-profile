import path from "node:path";
import { addCounts, analyzeText, totalSignals } from "./analyzer.js";

export const MACHINE_ORDER = ["server", "desktop", "laptop"];
const ACTIVE_GAP_MS = 30 * 60 * 1000;

export function createStreamState(machine) {
  return { machine, current: null, sessions: [], malformedLines: 0 };
}

export function ingestLine(state, line) {
  if (!line?.trim()) return;
  let entry;
  try { entry = JSON.parse(line); } catch { state.malformedLines++; return; }
  if (entry.type === "session" && entry.id) {
    const session = createSession(entry, state.machine);
    state.sessions.push(session);
    state.current = session;
    return;
  }
  const session = state.current;
  if (!session) return;
  session.counts.events++;
  const timestamp = eventTime(entry);
  updateTime(session, timestamp);

  if (entry.type === "session_info" && entry.name) session.name = entry.name;
  if (entry.type === "model_change" && entry.modelId) touchModel(session, entry.modelId, entry.provider);
  if (entry.type === "thinking_level_change" && entry.thinkingLevel) increment(session.reasoningLevels, entry.thinkingLevel);
  if (entry.type === "compaction") {
    session.counts.compactions++;
    session.maxTokensBeforeCompaction = Math.max(session.maxTokensBeforeCompaction, entry.tokensBefore ?? 0);
  }
  if (entry.type !== "message" || !entry.message) return;
  ingestMessage(session, entry.message, (timestamp ?? session.endedAt).slice(0, 10));
}

export function finalizeStream(state) {
  return state.sessions.map(finalizeSession);
}

export function dedupeSessions(machineCollections, machineOrder = MACHINE_ORDER) {
  const groups = new Map();
  for (const collection of machineCollections) {
    for (const session of collection.sessions) {
      const list = groups.get(session.sessionId) ?? [];
      list.push(session);
      groups.set(session.sessionId, list);
    }
  }
  const selected = [];
  for (const variants of groups.values()) {
    variants.sort((a, b) => machineOrder.indexOf(a.machine) - machineOrder.indexOf(b.machine) || b.counts.events - a.counts.events || Date.parse(b.endedAt) - Date.parse(a.endedAt));
    const session = variants[0];
    session.availableMachines = [...new Set(variants.map((item) => item.machine))];
    session.duplicateCount = variants.length;
    session.variantConflict = new Set(variants.map((item) => `${item.counts.events}:${item.endedAt}`)).size > 1;
    selected.push(session);
  }
  return selected.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

export function buildProfile(sessions, collections, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const machineOrder = options.machineOrder ?? MACHINE_ORDER;
  const daily = {}, modelMap = {}, projectMap = {}, toolMap = {}, reasoningLevels = {}, language = {};
  const totals = zeroUsage();
  let userMessages = 0, assistantMessages = 0, toolCalls = 0, toolResults = 0, toolErrors = 0, compactions = 0, activeDurationMs = 0;

  for (const session of sessions) {
    addUsage(totals, session.usage);
    userMessages += session.counts.userMessages;
    assistantMessages += session.counts.assistantMessages;
    toolCalls += session.counts.toolCalls;
    toolResults += session.counts.toolResults;
    toolErrors += session.counts.toolErrors;
    compactions += session.counts.compactions;
    activeDurationMs += session.activeDurationMs;
    addCounts(language, session.language);
    mergeNumberMap(reasoningLevels, session.reasoningLevels);

    for (const [day, activity] of Object.entries(session.daily)) {
      const d = daily[day] ??= { sessions: 0, tokens: 0, outputTokens: 0, toolCalls: 0, messages: 0, cost: 0, courtesy: 0, collaboration: 0, friction: 0 };
      d.sessions++; d.tokens += activity.tokens; d.outputTokens += activity.outputTokens; d.toolCalls += activity.toolCalls;
      d.messages += activity.messages; d.cost += activity.cost; d.courtesy += activity.courtesy; d.collaboration += activity.collaboration; d.friction += activity.friction;
    }

    for (const [modelId, stats] of Object.entries(session.models)) {
      const model = modelMap[modelId] ??= { modelId, provider: stats.provider, sessions: 0, messages: 0, tokens: 0, outputTokens: 0, cost: 0, toolCalls: 0 };
      model.sessions++; model.messages += stats.messages; model.tokens += stats.tokens; model.outputTokens += stats.outputTokens; model.cost += stats.cost; model.toolCalls += stats.toolCalls;
    }
    const project = projectMap[session.projectKey] ??= { name: session.projectName, sessions: 0, tokens: 0, toolCalls: 0, messages: 0, activeDurationMs: 0, lastActive: session.endedAt, machines: new Set(), models: {} };
    project.sessions++; project.tokens += session.usage.totalTokens; project.toolCalls += session.counts.toolCalls; project.messages += session.counts.userMessages + session.counts.assistantMessages;
    project.activeDurationMs += session.activeDurationMs; project.lastActive = later(project.lastActive, session.endedAt); project.machines.add(session.machine);
    for (const modelId of Object.keys(session.models)) increment(project.models, modelId);

    for (const [name, stats] of Object.entries(session.tools)) {
      const tool = toolMap[name] ??= { name, calls: 0, results: 0, errors: 0, sessions: 0 };
      tool.calls += stats.calls; tool.results += stats.results; tool.errors += stats.errors; tool.sessions++;
    }
  }

  const days = Object.keys(daily).sort();
  const streaks = calculateStreaks(days, generatedAt.slice(0, 10));
  const models = Object.values(modelMap).sort((a, b) => b.tokens - a.tokens);
  const projects = Object.values(projectMap).map((p) => ({ ...p, machines: [...p.machines], models: topEntries(p.models, 3).map(([name]) => name) })).sort((a, b) => b.tokens - a.tokens);
  const tools = Object.values(toolMap).sort((a, b) => b.calls - a.calls);
  const longest = [...sessions].sort((a, b) => b.activeDurationMs - a.activeDurationMs)[0];
  const deepest = [...sessions].sort((a, b) => (b.counts.userMessages + b.counts.assistantMessages) - (a.counts.userMessages + a.counts.assistantMessages))[0];
  const peakDay = days.map((day) => ({ day, ...daily[day] })).sort((a, b) => b.tokens - a.tokens)[0];
  const sourceCount = collections.reduce((sum, item) => sum + item.sessions.length, 0);
  const selectedByMachine = Object.fromEntries(machineOrder.map((machine) => [machine, sessions.filter((s) => s.machine === machine).length]));
  const machines = collections.map((item) => ({ machine: item.machine, ok: item.ok, sourceSessions: item.sessions.length, selectedSessions: selectedByMachine[item.machine] ?? 0, malformedLines: item.malformedLines, error: item.error }));

  return {
    schemaVersion: 2,
    generatedAt,
    profile: options.profile ?? { name: "Pi user", handle: "", avatarUrl: "", links: {} },
    headline: {
      lifetimeTokens: totals.totalTokens,
      peakTokens: peakDay?.tokens ?? 0,
      peakDay: peakDay?.day,
      longestSessionMs: longest?.activeDurationMs ?? 0,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    totals: {
      sessions: sessions.length, sourceSessions: sourceCount, duplicatesRemoved: sourceCount - sessions.length,
      activeDays: days.length, userMessages, assistantMessages, toolCalls, toolResults, toolErrors, compactions, activeDurationMs,
      ...totals, cacheReadShare: ratio(totals.cacheReadTokens, totals.inputTokens + totals.cacheReadTokens),
    },
    daily,
    machines,
    models: models.slice(0, 20),
    projects: projects.slice(0, 30),
    tools: tools.slice(0, 24),
    reasoningLevels,
    language,
    languageSummary: {
      courtesy: totalSignals(language.courtesy), collaboration: totalSignals(language.collaboration), friction: totalSignals(language.friction),
      ragio: ratio(language.friction?.profanity ?? 0, totalSignals(language.courtesy)),
      userMessages,
    },
    insights: {
      mostUsedModel: models[0]?.modelId,
      mostActiveProject: projects[0]?.name,
      mostUsedTool: tools[0]?.name,
      primaryReasoning: topEntries(reasoningLevels, 1)[0]?.[0],
      deepestSessionMessages: deepest ? deepest.counts.userMessages + deepest.counts.assistantMessages : 0,
      longestSessionProject: longest?.projectName,
    },
    recentSessions: [...sessions].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt)).slice(0, 14).map(publicSession),
  };
}

function createSession(entry, machine) {
  const startedAt = entry.timestamp ?? new Date(0).toISOString();
  return {
    sessionId: entry.id, machine, startedAt, endedAt: startedAt, cwd: entry.cwd, projectKey: displayProject(entry.cwd).toLowerCase(), projectName: displayProject(entry.cwd), name: null,
    observedDurationMs: 0, activeDurationMs: 0, previousEventMs: Date.parse(startedAt),
    counts: { events: 0, userMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, toolErrors: 0, thinkingParts: 0, imageParts: 0, compactions: 0 },
    usage: zeroUsage(), models: {}, tools: {}, reasoningLevels: {}, language: {}, daily: { [startedAt.slice(0, 10)]: zeroDaily() }, maxTokensBeforeCompaction: 0,
  };
}

function ingestMessage(session, message, day) {
  const daily = session.daily[day] ??= zeroDaily();
  if (message.role === "user") {
    session.counts.userMessages++;
    daily.messages++;
    const signals = analyzeText(textContent(message.content));
    addCounts(session.language, signals);
    daily.courtesy += totalSignals(signals.courtesy); daily.collaboration += totalSignals(signals.collaboration); daily.friction += totalSignals(signals.friction);
    return;
  }
  if (message.role === "toolResult") {
    session.counts.toolResults++;
    if (message.isError) session.counts.toolErrors++;
    if (message.toolName) {
      const tool = session.tools[message.toolName] ??= { calls: 0, results: 0, errors: 0 };
      tool.results++; if (message.isError) tool.errors++;
    }
    return;
  }
  if (message.role !== "assistant") return;
  session.counts.assistantMessages++;
  daily.messages++;
  const modelId = message.model ?? "unknown";
  const model = touchModel(session, modelId, message.provider);
  model.messages++;
  const usage = normalizeUsage(message.usage);
  addUsage(session.usage, usage); model.tokens += usage.totalTokens; model.outputTokens += usage.outputTokens; model.cost += usage.cost;
  daily.tokens += usage.totalTokens; daily.outputTokens += usage.outputTokens; daily.cost += usage.cost;
  for (const part of Array.isArray(message.content) ? message.content : []) {
    if (part?.type === "thinking") session.counts.thinkingParts++;
    if (part?.type === "image") session.counts.imageParts++;
    if (part?.type === "toolCall" && part.name) {
      session.counts.toolCalls++; model.toolCalls++;
      daily.toolCalls++;
      const tool = session.tools[part.name] ??= { calls: 0, results: 0, errors: 0 };
      tool.calls++;
    }
    if (part?.type === "web_search_call" || part?.type === "image_generation_call") {
      const name = part.type === "web_search_call" ? "web_search" : "image_generation";
      session.counts.toolCalls++; model.toolCalls++; daily.toolCalls++;
      const tool = session.tools[name] ??= { calls: 0, results: 0, errors: 0 };
      tool.calls++;
    }
  }
}

function finalizeSession(session) {
  delete session.previousEventMs;
  session.models = Object.fromEntries(Object.entries(session.models).filter(([id, stats]) => id !== "unknown" || stats.messages > 0));
  return session;
}

function touchModel(session, modelId, provider) {
  const model = session.models[modelId] ??= { provider, messages: 0, tokens: 0, outputTokens: 0, cost: 0, toolCalls: 0 };
  if (!model.provider && provider) model.provider = provider;
  return model;
}

function updateTime(session, iso) {
  if (!iso) return;
  const current = Date.parse(iso); if (!Number.isFinite(current)) return;
  session.endedAt = later(session.endedAt, iso);
  session.observedDurationMs = Math.max(0, Date.parse(session.endedAt) - Date.parse(session.startedAt));
  const gap = current - session.previousEventMs;
  if (gap > 0 && gap <= ACTIVE_GAP_MS) session.activeDurationMs += gap;
  session.previousEventMs = current;
}

function eventTime(entry) {
  if (typeof entry.timestamp === "string") return entry.timestamp;
  if (typeof entry.message?.timestamp === "number") return new Date(entry.message.timestamp).toISOString();
}

function normalizeUsage(usage = {}) {
  return { inputTokens: usage.input ?? 0, outputTokens: usage.output ?? 0, totalTokens: usage.totalTokens ?? 0, cacheReadTokens: usage.cacheRead ?? 0, cacheWriteTokens: usage.cacheWrite ?? 0, reasoningTokens: usage.reasoning ?? 0, cost: usage.cost?.total ?? 0 };
}
function zeroUsage() { return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, cost: 0 }; }
function zeroDaily() { return { tokens: 0, outputTokens: 0, toolCalls: 0, messages: 0, cost: 0, courtesy: 0, collaboration: 0, friction: 0 }; }
function addUsage(total, usage) { for (const key of Object.keys(total)) total[key] += usage[key] ?? 0; }
function increment(map, key, amount = 1) { map[key] = (map[key] ?? 0) + amount; }
function mergeNumberMap(target, source) { for (const [key, value] of Object.entries(source)) increment(target, key, value); }
function textContent(content) { return typeof content === "string" ? content : Array.isArray(content) ? content.filter((p) => p?.type === "text").map((p) => p.text).join(" ") : ""; }
function later(a, b) { return Date.parse(b) > Date.parse(a) ? b : a; }
function ratio(a, b) { return b ? a / b : 0; }
function topEntries(map, count) { return Object.entries(map ?? {}).sort((a, b) => b[1] - a[1]).slice(0, count); }
function displayProject(cwd) {
  if (!cwd) return "Unknown project";
  const normalized = cwd.replace(/\/$/, "");
  if (/\/home\/[^/]+$/.test(normalized)) return "Home";
  const worktree = normalized.match(/^(.*)\/\.worktrees\//);
  return path.basename(worktree?.[1] ?? normalized) || "Home";
}
function publicSession(s) {
  const models = Object.entries(s.models).sort((a, b) => b[1].tokens - a[1].tokens);
  return { project: s.projectName, machine: s.machine, startedAt: s.startedAt, endedAt: s.endedAt, observedDurationMs: s.observedDurationMs, activeDurationMs: s.activeDurationMs, messages: s.counts.userMessages + s.counts.assistantMessages, toolCalls: s.counts.toolCalls, tokens: s.usage.totalTokens, model: models[0]?.[0], compactions: s.counts.compactions };
}
function calculateStreaks(days, today) {
  if (!days.length) return { current: 0, longest: 0 };
  const set = new Set(days); let longest = 0, run = 0, previous = null;
  for (const day of days) { const current = Date.parse(`${day}T00:00:00Z`); run = previous !== null && current - previous === 86400000 ? run + 1 : 1; longest = Math.max(longest, run); previous = current; }
  let cursor = Date.parse(`${today}T00:00:00Z`); if (!set.has(today)) cursor -= 86400000;
  let current = 0; while (set.has(new Date(cursor).toISOString().slice(0, 10))) { current++; cursor -= 86400000; }
  return { current, longest };
}
