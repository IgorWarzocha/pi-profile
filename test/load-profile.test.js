import assert from "node:assert/strict";
import test from "node:test";
import { loadProfile } from "../capsule/client/load-profile.ts";

test("detail requests carry cancellation and reject HTTP failures", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(loadProfile(signal, async (url, options) => {
    assert.equal(url, "./profile.json");
    assert.equal(options.signal, signal);
    return new Response("Unavailable", { status: 503 });
  }), /503/);
});

test("invalid detail responses fail instead of leaving the loading skeleton", async () => {
  await assert.rejects(loadProfile(new AbortController().signal, async () =>
    Response.json({ error: "not a profile" })), /Invalid profile/);
});

test("detail requests return the complete profile snapshot", async () => {
  const profile = { profile: {}, totals: {}, models: [], machines: [], tools: [],
    projects: [], recentSessions: [], language: {}, languageSummary: {} };
  const result = await loadProfile(new AbortController().signal, async () => Response.json(profile));
  assert.deepEqual(result, profile);
});
