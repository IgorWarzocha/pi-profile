import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const DAY_MS = 86_400_000;

// Read only PCC's existing ledger. Missing ledgers mean untracked, not zero spend.
export async function collectCodexUsage({ machine, host, codexUsageFile }, generatedAt) {
  if (!codexUsageFile) return { machine, accounts: [] };
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  const file = codexUsageFile.startsWith("~/") ? `"$HOME"/${quote(codexUsageFile.slice(2))}` : quote(codexUsageFile);
  const command = `if test -f ${file}; then cat ${file}; elif test -e ${file} || test -L ${file}; then exit 1; else exit 44; fi`;
  let stdout;
  try {
    ({ stdout } = await execute(host ? "ssh" : "bash", host
      ? ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, command]
      : ["-lc", command], { timeout: 15_000, maxBuffer: 8 * 1024 * 1024 }));
  } catch (error) {
    if (error.code === 44) return { machine, accounts: [] };
    throw error;
  }
  return projectCodexUsage(JSON.parse(stdout), machine, generatedAt);
}

// Fresh allowlisted objects keep account hashes, paths, warnings and raw payloads private.
// Machine ledgers can import the same sessions, so never sum or merge their accounts.
export function projectCodexUsage(ledger, machine, generatedAt = new Date().toISOString()) {
  if (object(ledger).version !== 1) throw new Error("Unsupported PCC usage ledger version");
  if (ledger.historyOwner !== undefined) string(ledger.historyOwner);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(now)) throw new Error("Invalid usage snapshot time");
  const accounts = Object.values(object(ledger.accounts)).map((value) => {
    const a = object(value);
    validatePrivateFields(a);
    const since = timestamp(a.since);
    const lifetime = summary(a.total);
    const current = a.current === undefined ? undefined : period(a.current);
    const closed = Object.entries(object(a.closed)).map(([key, value]) => [key, period(value, true)]);
    const previous = closed.find(([key]) => key === a.previous)?.[1];
    const months = Object.entries(object(a.months)).map(([month, value]) => {
      if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid usage month");
      return { month, ...summary(value) };
    }).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
    const currentRate = current && now < Date.parse(current.expectedReset)
      ? rate(current, now) : undefined;
    const previousRate = previous ? rate(previous, Date.parse(previous.end)) : undefined;
    const history = a.history === undefined ? undefined : object(a.history);
    const coverage = history ? object(history.coverage) : {};
    const diagnostics = {
      unassignedUsd: number(a.unassignedUsd),
      recordingGaps: number(a.recordingGaps),
      missingWeeklyObservations: number(a.missingWeeklyObservations),
      incompleteEntries: history ? number(coverage.incompleteEntries) : 0,
      unattributedUsage: history ? number(coverage.unattributedUsage) : 0,
      unreadablePaths: number(coverage.unreadablePaths ?? 0),
      unverifiedHistory: history?.accountIdentity === "unverified",
      nonstandard: optionalBoolean(a.nonstandard),
    };
    return {
      since, lifetime, months, diagnostics,
      ...(current ? { current } : {}),
      closed: closed.map(([, window]) => window).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8),
      ...(currentRate === undefined ? {} : { spendPerDay: currentRate }),
      ...(currentRate === undefined || !previousRate || current.partial || previous.partial || current.approximate || previous.approximate
        ? {} : { vsPreviousWindowPercent: (currentRate / previousRate - 1) * 100 }),
    };
  });
  return { machine, accounts };
}

// Validate PCC's persisted bookkeeping too, but never carry it into public output.
function validatePrivateFields(a) {
  if (!Array.isArray(a.recent)) throw new Error("Invalid PCC usage tail");
  for (const value of a.recent) {
    const spend = object(value);
    timestamp(spend.at); string(spend.model); stats(spend.stats);
  }
  if (a.previous !== undefined) string(a.previous);
  for (const key of ["lastObservation", "manualResetAt"]) if (a[key] !== undefined) timestamp(a[key]);
  if (a.history !== undefined) {
    const history = object(a.history), coverage = object(history.coverage);
    for (const key of ["from", "to", "windowStart", "importedAt"]) timestamp(history[key]);
    string(history.root);
    if (history.accountIdentity !== "unverified") throw new Error("Invalid usage history identity");
    for (const key of ["sessions", "skippedCopies", "incompleteEntries", "unattributedUsage"]) number(coverage[key]);
    if (!Array.isArray(coverage.warnings)) throw new Error("Invalid usage history warnings");
    coverage.warnings.forEach(string);
  }
}

function summary(value) {
  const s = object(value);
  return {
    total: stats(s.total),
    models: Object.entries(object(s.models)).map(([key, value]) => {
      if (!key.startsWith("model:") || key.length <= 6 || key.length > 166) throw new Error("Invalid usage model");
      return { modelId: key.slice(6), ...stats(value) };
    }).sort((a, b) => b.usd - a.usd).slice(0, 12),
  };
}

function stats(value) {
  const s = object(value);
  const input = number(s.input), output = number(s.output), cacheRead = number(s.cacheRead), cacheWrite = number(s.cacheWrite);
  return { usd: number(s.usd), input, output, cacheRead, cacheWrite,
    tokens: number(input + output + cacheRead + cacheWrite), requests: number(s.requests), unpriced: number(s.unpriced) };
}

function period(value, closed = false) {
  const p = object(value);
  if (!["manual", "inferred", "session-history"].includes(p.source)) throw new Error("Invalid usage window source");
  const start = timestamp(p.start), expectedReset = timestamp(p.expectedReset);
  if (p.expectedReset <= p.start) throw new Error("Invalid usage window range");
  const result = { start, expectedReset, source: p.source, partial: boolean(p.partial), approximate: optionalBoolean(p.approximate), ...summary(p.summary) };
  if (p.quotaPerUsd !== undefined) number(p.quotaPerUsd);
  if (p.quota !== undefined) {
    const q = object(p.quota);
    if (number(q.usedPercent) > 100) throw new Error("Invalid quota percentage");
    number(q.usd);
    result.observedQuota = { at: timestamp(q.at), usedPercent: q.usedPercent };
  }
  if (closed) {
    if (!["scheduled", "early", "gap", "backfill"].includes(p.reason) || p.end <= p.start) throw new Error("Invalid closed usage window");
    result.end = timestamp(p.end);
    result.reason = p.reason;
    timestamp(p.closedAt);
    if (p.quotaEstimate !== undefined) number(p.quotaEstimate);
  }
  return result;
}

function rate(window, end) {
  const days = (end - Date.parse(window.start)) / DAY_MS;
  return days > 0 ? number(window.total.usd / days) : undefined;
}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PCC usage object");
  return value;
}
function number(value) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid PCC usage number");
  return value;
}
function boolean(value) {
  if (typeof value !== "boolean") throw new Error("Invalid PCC usage flag");
  return value;
}
function string(value) {
  if (typeof value !== "string") throw new Error("Invalid PCC usage string");
  return value;
}
function optionalBoolean(value) { return value === undefined ? false : boolean(value); }
function timestamp(value) {
  const date = new Date(number(value));
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid PCC usage timestamp");
  return date.toISOString();
}
