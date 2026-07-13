import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicProfile } from "../src/public-profile.js";

function emptyPublicProfile() {
  return {
    schemaVersion: 2,
    generatedAt: "2026-07-13T00:00:00.000Z",
    profile: {},
    headline: {},
    totals: {},
    daily: {},
    machines: [],
    models: [],
    projects: [],
    tools: [],
    reasoningLevels: {},
    language: {},
    languageSummary: {},
    insights: {},
    recentSessions: [],
  };
}

test("accepts the bounded public profile contract", () => {
  const profile = emptyPublicProfile();
  assert.equal(assertPublicProfile(profile), profile);
});

test("rejects schema expansion and private session fields", () => {
  assert.throws(
    () => assertPublicProfile({ ...emptyPublicProfile(), sessions: [] }),
    /unexpected: sessions/,
  );
  assert.throws(
    () => assertPublicProfile({ ...emptyPublicProfile(), insights: { cwd: "/home/igorw/Work" } }),
    /forbidden field profile\.insights\.cwd/,
  );
});

test("rejects project names that still look like paths", () => {
  assert.throws(
    () => assertPublicProfile({
      ...emptyPublicProfile(),
      projects: [{ name: "Work/private-project" }],
    }),
    /looks like a path/,
  );
});
