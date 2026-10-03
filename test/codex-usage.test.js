import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectCodexUsage, projectCodexUsage } from "../src/codex-usage.js";
import { buildProfile } from "../src/profile-lib.js";
import { assertPublicProfile } from "../src/public-profile.js";

const start = Date.parse("2026-10-01T00:00:00Z");
const day = 86_400_000;
const stats = (usd) => ({ usd, input: 10, output: 5, cacheRead: 20, cacheWrite: 2, requests: 1, unpriced: 0 });
const summary = (usd) => ({ total: stats(usd), models: { "model:gpt-test": stats(usd) } });
const window = (usd) => ({ start, expectedReset: start + 7 * day, source: "inferred", partial: false, summary: summary(usd) });
function ledger() {
  return { version: 1, accounts: { "private-account-hash": {
    since: start, total: summary(100), months: { "2026-10": summary(100) },
    current: { ...window(100), quota: { at: start + day, usedPercent: 5, usd: 50 } },
    closed: { previous: { ...window(50), start: start - 2 * day, expectedReset: start + 5 * day, end: start, closedAt: start, source: "manual", reason: "early" } }, previous: "previous",
    unassignedUsd: 0, missingWeeklyObservations: 0, recordingGaps: 0,
    recent: [],
    history: { from: start, to: start + day, windowStart: start, importedAt: start + day,
      root: "/private/session/path", accountIdentity: "unverified", coverage: { sessions: 1, skippedCopies: 0, incompleteEntries: 0, unattributedUsage: 1, unreadablePaths: 0, warnings: ["Private text"] } },
  } } };
}

test("projects PCC costs and reset provenance without private ledger metadata or double-counting", () => {
  const input = ledger();
  input.accounts["private-account-hash"].raw = { accessToken: "private-token" };
  const server = projectCodexUsage(input, "server", new Date(start + 2 * day).toISOString());
  const desktop = projectCodexUsage(input, "desktop", new Date(start + 2 * day).toISOString());
  const profile = assertPublicProfile(buildProfile([], [], { codexUsage: [server, desktop] }));
  const account = server.accounts[0];
  assert.equal(account.current.total.tokens, 37);
  assert.equal(account.current.models[0].modelId, "gpt-test");
  assert.equal(account.closed[0].source, "manual");
  assert.equal(account.closed[0].reason, "early");
  assert.equal(account.spendPerDay, 50);
  assert.equal(account.vsPreviousWindowPercent, 100);
  assert.equal(account.diagnostics.unverifiedHistory, true);
  assert.equal(account.diagnostics.unattributedUsage, 1);
  assert.equal(profile.totals.cost, 0);
  assert.equal(profile.codexUsage.length, 2);
  assert.equal(profile.codexUsage[1].accounts[0].lifetime.total.usd, 100);
  for (const privateValue of ["private-account-hash", "/private/session/path", "Private text", "private-token"]) {
    assert.equal(JSON.stringify(profile).includes(privateValue), false);
  }
  assert.equal(input.accounts["private-account-hash"].raw.accessToken, "private-token");
});

test("expired and approximate windows do not invent current rates or reliable comparisons", () => {
  const input = ledger();
  const expired = projectCodexUsage(input, "server", new Date(start + 8 * day).toISOString()).accounts[0];
  assert.equal(expired.spendPerDay, undefined);
  assert.equal(expired.vsPreviousWindowPercent, undefined);
  assert.equal(expired.current.observedQuota.usedPercent, 5);
  input.accounts["private-account-hash"].current.approximate = true;
  const approximate = projectCodexUsage(input, "server", new Date(start + 2 * day).toISOString()).accounts[0];
  assert.equal(approximate.current.approximate, true);
  assert.equal(approximate.vsPreviousWindowPercent, undefined);
  input.accounts["private-account-hash"].current.partial = true;
  assert.equal(projectCodexUsage(input, "server").accounts[0].current.partial, true);
});

test("invalid or unsupported ledgers fail closed instead of turning missing prices into zero", () => {
  assert.throws(() => projectCodexUsage(null, "server"), /Invalid/);
  assert.throws(() => projectCodexUsage({ ...ledger(), version: 2 }, "server"), /version/);
  for (const mutate of [
    (a) => { a.total.total.usd = undefined; },
    (a) => { a.current.quota.usedPercent = 101; },
    (a) => { a.current.partial = "false"; },
    (a) => { a.current.expectedReset = start; },
    (a) => { a.closed.previous.end = start - 3 * day; },
    (a) => { a.months = { "2026-13": summary(1) }; },
    (a) => { delete a.history.importedAt; },
    (a) => { delete a.history.coverage.sessions; },
  ]) {
    const input = ledger();
    mutate(input.accounts["private-account-hash"]);
    assert.throws(() => projectCodexUsage(input, "server"), /Invalid/);
  }
});

test("bounds published history while preserving approximate and partial coverage", () => {
  const input = ledger();
  const a = input.accounts["private-account-hash"];
  a.closed = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index), {
    ...window(index), start: start - (index + 1) * day, expectedReset: start, end: start - index * day,
    reason: "backfill", source: "session-history", partial: true, approximate: true, closedAt: start,
  }]));
  a.months = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [new Date(Date.UTC(2026, 9 - index, 1)).toISOString().slice(0, 7), summary(index)]));
  const account = projectCodexUsage(input, "server").accounts[0];
  assert.equal(account.closed.length, 8);
  assert.equal(account.closed[0].total.usd, 0);
  assert.equal(account.closed[0].approximate, true);
  assert.equal(account.closed[0].partial, true);
  assert.equal(account.months.length, 12);
  assert.equal(account.months[0].month, "2026-10");
});

test("reading existing PCC JSON distinguishes missing files from corrupt files and quotes paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-profile-usage-"));
  const machine = { machine: "server", host: null, codexUsageFile: join(directory, "PCC's usage.json") };
  try {
    assert.deepEqual(await collectCodexUsage(machine), { machine: "server", accounts: [] });
    await writeFile(machine.codexUsageFile, JSON.stringify(ledger()));
    assert.equal((await collectCodexUsage(machine)).accounts[0].lifetime.total.usd, 100);
    await writeFile(machine.codexUsageFile, "{");
    await assert.rejects(collectCodexUsage(machine), SyntaxError);
    await writeFile(machine.codexUsageFile, "null");
    await assert.rejects(collectCodexUsage(machine), /Invalid/);
  } finally { await rm(directory, { recursive: true }); }
});
