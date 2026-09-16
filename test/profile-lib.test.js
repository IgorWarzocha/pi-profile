import assert from "node:assert/strict";
import test from "node:test";
import { buildProfile, createStreamState, dedupeSessions, finalizeStream, ingestLine } from "../src/profile-lib.js";

function line(value) { return JSON.stringify(value); }

test("extracts embedded tool calls, usage, cost, model and tool errors", () => {
  const state = createStreamState("server");
  ingestLine(state, line({ type: "session", id: "one", timestamp: "2026-07-01T10:00:00Z", cwd: "/home/igorw/Work/example" }));
  ingestLine(state, line({ type: "message", timestamp: "2026-07-01T10:01:00Z", message: { role: "assistant", provider: "openai", model: "gpt-test", usage: { input: 10, output: 5, cacheRead: 20, cacheWrite: 2, totalTokens: 35, cost: { total: .01 } }, content: [{ type: "thinking", thinking: "..." }, { type: "toolCall", id: "call", name: "exec_command", arguments: {} }] } }));
  ingestLine(state, line({ type: "message", timestamp: "2026-07-01T10:02:00Z", message: { role: "toolResult", toolCallId: "call", toolName: "exec_command", isError: true, content: [] } }));
  const session = finalizeStream(state)[0];
  assert.equal(session.counts.toolCalls, 1);
  assert.equal(session.counts.toolResults, 1);
  assert.equal(session.counts.toolErrors, 1);
  assert.equal(session.counts.thinkingParts, 1);
  assert.equal(session.usage.totalTokens, 35);
  assert.equal(session.usage.cost, .01);
  assert.equal(session.models["gpt-test"].toolCalls, 1);
});

test("dedupe selects server then desktop then laptop and keeps provenance", () => {
  const base = { sessionId: "same", counts: { events: 1 }, endedAt: "2026-01-01T00:00:00Z" };
  const result = dedupeSessions([
    { sessions: [{ ...base, machine: "laptop" }] },
    { sessions: [{ ...base, machine: "desktop" }] },
    { sessions: [{ ...base, machine: "server" }] },
  ]);
  assert.equal(result[0].machine, "server");
  assert.deepEqual(result[0].availableMachines, ["server", "desktop", "laptop"]);
  assert.equal(result[0].duplicateCount, 3);
});

test("dedupe keeps the fullest same-machine conflict copy", () => {
  const result = dedupeSessions([{ sessions: [
    { sessionId: "same", machine: "server", counts: { events: 2 }, endedAt: "2026-01-01T02:00:00Z", startedAt: "2026-01-01T00:00:00Z" },
    { sessionId: "same", machine: "server", counts: { events: 20 }, endedAt: "2026-01-01T01:00:00Z", startedAt: "2026-01-01T00:00:00Z" },
  ] }]);
  assert.equal(result[0].counts.events, 20);
  assert.deepEqual(result[0].availableMachines, ["server"]);
});

test("counts native web and image calls as tools", () => {
  const state = createStreamState("server");
  ingestLine(state, line({ type: "session", id: "native", timestamp: "2026-07-01T10:00:00Z", cwd: "/work/example" }));
  ingestLine(state, line({ type: "message", timestamp: "2026-07-01T10:01:00Z", message: { role: "assistant", model: "gpt-test", content: [{ type: "web_search_call" }, { type: "image_generation_call" }] } }));
  const session = finalizeStream(state)[0];
  assert.equal(session.counts.toolCalls, 2);
  assert.equal(session.tools.web_search.calls, 1);
  assert.equal(session.tools.image_generation.calls, 1);
});

test("does not retain user-authored session titles", () => {
  const state = createStreamState("server");
  ingestLine(state, line({ type: "session", id: "private-title", timestamp: "2026-07-01T10:00:00Z", cwd: "/work/example" }));
  ingestLine(state, line({ type: "session_info", timestamp: "2026-07-01T10:00:01Z", name: "Sensitive session title" }));
  const session = finalizeStream(state)[0];
  assert.equal("name" in session, false);
});

test("publishes the full token split and latest responding model, not the dominant or selected model", () => {
  const state = createStreamState("server");
  const ingest = (entry) => ingestLine(state, line(entry));
  ingest({ type: "session", id: "mixed", timestamp: "2026-07-01T10:00:00Z", cwd: "/work/example" });
  for (const [model, tokens, minute] of [["sol", 900, 1], ["astra", 100, 4], ["luna", 0, 2], ["fourth", 0, 3]]) {
    ingest({ type: "message", timestamp: `2026-07-01T10:0${minute}:00Z`, message: { role: "assistant", model, usage: { totalTokens: tokens } } });
  }
  ingest({ type: "model_change", timestamp: "2026-07-01T10:05:00Z", modelId: "unused" });
  ingest({ type: "session", id: "second", timestamp: "2026-07-02T10:00:00Z", cwd: "/work/example" });
  ingest({ type: "message", timestamp: "2026-07-02T10:01:00Z", message: { role: "assistant", model: "astra", usage: { totalTokens: 500 } } });
  const sessions = finalizeStream(state);
  const profile = buildProfile(sessions, [{ machine: "server", ok: true, sessions }]);
  const mixed = profile.recentSessions.find((s) => s.startedAt === "2026-07-01T10:00:00Z");
  assert.equal(mixed.latestModel, "astra");
  assert.deepEqual(mixed.models.map((m) => [m.modelId, m.tokens]), [["sol", 900], ["astra", 100], ["fourth", 0], ["luna", 0]]);
  assert.deepEqual(profile.projects[0].models.map((m) => [m.modelId, m.tokens, m.messages]), [["sol", 900, 1], ["astra", 600, 2], ["fourth", 0, 1], ["luna", 0, 1]]);
  assert.equal(profile.models.some((m) => m.modelId === "unused"), false);
  for (const row of [...profile.projects, ...profile.recentSessions]) {
    assert.equal(row.models.reduce((sum, model) => sum + model.tokens, 0), row.tokens);
  }
});

test("keeps zero-usage and unknown responses without inventing a model for an empty session", () => {
  const state = createStreamState("server");
  ingestLine(state, line({ type: "session", id: "empty", timestamp: "2026-07-01T10:00:00Z" }));
  ingestLine(state, line({ type: "model_change", modelId: "selected-only" }));
  ingestLine(state, line({ type: "session", id: "unknown", timestamp: "2026-07-02T10:00:00Z" }));
  ingestLine(state, line({ type: "message", message: { role: "assistant" } }));
  const sessions = finalizeStream(state);
  const profile = buildProfile(sessions, [{ machine: "server", ok: true, sessions }]);
  assert.equal(profile.recentSessions[0].latestModel, "unknown");
  assert.deepEqual(profile.recentSessions[0].models, [{ modelId: "unknown", tokens: 0, messages: 1 }]);
  assert.equal(profile.recentSessions[1].latestModel, undefined);
  assert.deepEqual(profile.recentSessions[1].models, []);
});
