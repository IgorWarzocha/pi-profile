import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildProfile, createStreamState, dedupeSessions, finalizeStream, ingestLine } from "../src/profile-lib.js";
import { retainSessions, withSessionHistory } from "../src/session-history.js";
import { assertPublicProfile } from "../src/public-profile.js";

function session(id, tokens, machine = "server", responses = 1) {
  const state = createStreamState(machine);
  for (const entry of [
    { type: "session", id, timestamp: "2026-04-01T10:00:00Z", cwd: "/work/example" },
    { type: "message", timestamp: "2026-04-01T10:01:00Z", message: { role: "user", content: [{ type: "text", text: "private conversation, please help" }] } },
    ...Array.from({ length: responses }, () => ({ type: "message", timestamp: "2026-04-01T10:02:00Z", message: { role: "assistant", model: "test-model", provider: "test", usage: { totalTokens: tokens / responses, cost: { total: tokens / (100 * responses) } } } })),
  ]) ingestLine(state, JSON.stringify(entry));
  return finalizeStream(state)[0];
}

function snapshot(previous, live) {
  const collections = ["server", "desktop", "laptop"].map((machine) => ({
    machine, ok: true, sessions: live.filter((s) => s.machine === machine), malformedLines: 0,
  }));
  const sessions = retainSessions(previous, dedupeSessions(collections));
  return { ...assertPublicProfile(buildProfile(sessions, collections)), sessions };
}

async function historyFile(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pi-profile-history-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return path.join(dir, "profile.json");
}

test("keeps deleted sessions across refreshes while live sessions update without double counting", async (t) => {
  const file = await historyFile(t);
  const first = await withSessionHistory(file, (previous) => snapshot(previous, [session("old", 100), session("active", 200)]));
  const second = await withSessionHistory(file, (previous) => snapshot(previous, [session("active", 300), session("active", 300, "desktop")]));
  assert.equal(second.totals.totalTokens, 400);
  assert.equal(second.totals.cost, 4);
  assert.equal(second.totals.sessions, 2);
  assert.equal(second.totals.sourceSessions, 2);
  assert.equal(second.totals.duplicatesRemoved, 1);
  assert.equal(second.totals.retainedSessions, 1);
  assert.equal(second.machines[0].selectedSessions, 1);
  assert.equal(second.daily["2026-04-01"].tokens, 400);
  assert.equal(second.projects[0].tokens, 400);
  assert.equal(second.models[0].tokens, 400);
  assert.deepEqual(second.language, first.language);
  const third = await withSessionHistory(file, (previous) => snapshot(previous, []));
  assert.equal(third.totals.totalTokens, 400);
  assert.equal(third.totals.sourceSessions, 0);
  assert.equal(third.totals.duplicatesRemoved, 0);
  assert.equal(third.totals.retainedSessions, 2);
  assert.equal(third.machines[0].selectedSessions, 0);
  const fourth = await withSessionHistory(file, (previous) => snapshot(previous, [session("old", 150, "laptop")]));
  assert.equal(fourth.totals.totalTokens, 450);
  assert.equal(fourth.totals.sessions, 2);
  assert.equal(fourth.sessions.find((s) => s.sessionId === "old").machine, "laptop");
  const { sessions, ...publicProfile } = fourth;
  assertPublicProfile(publicProfile);
  assert.ok(!JSON.stringify(publicProfile).includes('"sessionId"'));
});

test("adopts existing schema-3 metadata and strips paths and unknown text on disk", async (t) => {
  const file = await historyFile(t);
  const legacy = snapshot([], [session("legacy", 100)]);
  legacy.sessions[0].content = "must not be retained";
  await writeFile(file, JSON.stringify(legacy));
  const result = await withSessionHistory(file, (previous) => snapshot(previous, []));
  assert.equal(result.totals.totalTokens, 100);
  const stored = await readFile(file, "utf8");
  assert.ok(!stored.includes('"cwd"'));
  assert.ok(!stored.includes('"content"'));
  assert.ok(!stored.includes("private conversation"));
  assert.ok(!stored.includes("must not be retained"));
});

test("deleting the fullest source or reintroducing an older copy never erases saved usage", async (t) => {
  const file = await historyFile(t);
  await withSessionHistory(file, (previous) => snapshot(previous, [session("synced", 1000, "server", 10), session("synced", 100, "desktop")]));
  for (const live of [[session("synced", 100, "desktop")], [], [session("synced", 100, "laptop")]]) {
    const result = await withSessionHistory(file, (previous) => snapshot(previous, live));
    assert.equal(result.totals.totalTokens, 1000);
    assert.equal(result.totals.assistantMessages, 10);
    assert.equal(result.totals.sessions, 1);
  }
  const updated = await withSessionHistory(file, (previous) => snapshot(previous, [session("synced", 1500, "desktop", 12)]));
  assert.equal(updated.totals.totalTokens, 1500);
  assert.equal(updated.totals.assistantMessages, 12);
  assert.equal(updated.sessions[0].machine, "desktop");
});

test("fails closed on corrupt or unsupported history without replacing it", async (t) => {
  const file = await historyFile(t);
  const badSession = snapshot([], [session("bad", 100)]);
  delete badSession.sessions[0].usage.totalTokens;
  for (const invalid of ["{", "null", "0", "false", '{"schemaVersion":2,"sessions":[]}', JSON.stringify(badSession)]) {
    await writeFile(file, invalid);
    await assert.rejects(withSessionHistory(file, () => { assert.fail("must not collect with invalid history"); }));
    assert.equal(await readFile(file, "utf8"), invalid);
  }
});

test("collection failure preserves history and concurrent collectors cannot overwrite it", async (t) => {
  const file = await historyFile(t);
  await withSessionHistory(file, (previous) => snapshot(previous, [session("old", 100)]));
  const before = await readFile(file, "utf8");
  await assert.rejects(withSessionHistory(file, async (previous) => {
    await assert.rejects(withSessionHistory(file, () => snapshot([], [])), /EEXIST/);
    assert.equal(previous.length, 1);
    throw new Error("machine unavailable");
  }), /machine unavailable/);
  assert.equal(await readFile(file, "utf8"), before);
  const after = await withSessionHistory(file, (previous) => snapshot(previous, []));
  assert.equal(after.totals.totalTokens, 100);
});

test("the lock covers public snapshot publication and saved history survives a publication failure", async (t) => {
  const file = await historyFile(t);
  await assert.rejects(withSessionHistory(file, (previous) => snapshot(previous, [session("saved", 100)]), async () => {
    await assert.rejects(withSessionHistory(file, () => snapshot([], [])), /EEXIST/);
    throw new Error("public output failed");
  }), /public output failed/);
  const retry = await withSessionHistory(file, (previous) => snapshot(previous, []));
  assert.equal(retry.totals.totalTokens, 100);
});
