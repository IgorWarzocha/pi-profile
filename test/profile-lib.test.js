import assert from "node:assert/strict";
import test from "node:test";
import { createStreamState, dedupeSessions, finalizeStream, ingestLine } from "../src/profile-lib.js";

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
