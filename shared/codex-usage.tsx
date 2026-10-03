"use client";

import { useState } from "react";
import { prettyModel } from "./model-split";
import type { CodexUsageSource, CodexWindow } from "./profile-types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const tokens = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value));
const provenance = (window: CodexWindow) => [window.source === "manual" ? "Manual reset" : window.source === "inferred" ? "Inferred boundary" : "Imported history", window.partial && "partial", window.approximate && "approximate"].filter(Boolean).join(" · ");

export function CodexUsage({ sources, generatedAt }: { sources: ReadonlyArray<CodexUsageSource>; generatedAt: string }) {
  const [selected, setSelected] = useState(sources.findIndex((source) => source.accounts.length > 0));
  if (!sources.some((source) => source.accounts.length > 0)) return null;
  const source = sources[selected] ?? sources[0];
  return <section className="mt-12" aria-label="Codex usage">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-lg font-medium tracking-[-.025em]">Codex usage</h2>
      <div className="flex flex-wrap gap-1" aria-label="Usage machine">
        {sources.map((item, index) => <button key={item.machine} type="button" aria-pressed={index === selected}
          onClick={() => setSelected(index)} className={`rounded-lg px-3 py-1.5 text-xs capitalize transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8eb7ff] ${index === selected ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
          {item.machine}
        </button>)}
      </div>
    </div>
    <div className="rounded-2xl border border-white/[.08] bg-[#111414] p-5 sm:p-7">
      {source.accounts.length === 0 ? <p className="text-sm text-white/55">No PCC usage ledger recorded on {source.machine}.</p> : source.accounts.map((account, index) => {
        const current = account.current;
        const modelSummary = current?.models.length ? current : account.lifetime;
        const expired = current && Date.parse(current.expectedReset) <= Date.parse(generatedAt);
        const diagnostics = account.diagnostics;
        const warnings = [
          current?.partial && "Partial window",
          current?.approximate && "Approximate window",
          expired && "Awaiting a new reset-window observation",
          diagnostics.unverifiedHistory && "Imported history has unverified account identity",
          diagnostics.nonstandard && "Nonstandard endpoint: pricing and quota may be inaccurate",
          diagnostics.recordingGaps > 0 && `${diagnostics.recordingGaps} recording gaps`,
          diagnostics.missingWeeklyObservations > 0 && `${diagnostics.missingWeeklyObservations} missing weekly observations`,
          diagnostics.incompleteEntries > 0 && `${diagnostics.incompleteEntries} incomplete history entries`,
          diagnostics.unattributedUsage > 0 && `${diagnostics.unattributedUsage} unattributed history entries`,
          diagnostics.unreadablePaths > 0 && `${diagnostics.unreadablePaths} unreadable history files`,
          account.lifetime.total.unpriced > 0 && `${account.lifetime.total.unpriced} unpriced requests`,
          diagnostics.unassignedUsd >= 0.005 && `${money(diagnostics.unassignedUsd)} outside recorded windows`,
        ].filter(Boolean);
        return <div key={index} className={index > 0 ? "mt-8 border-t border-white/[.08] pt-8" : ""}>
          {source.accounts.length > 1 && <h3 className="mb-4 text-sm font-medium">Account {index + 1}</h3>}
          <dl className="grid gap-6 sm:grid-cols-3">
            <Stat label={expired ? "Latest window" : "This window"} value={current ? money(current.total.usd) : "Not observed"} note={current ? provenance(current) : "PCC has not recorded a weekly boundary"} />
            <Stat label="Recorded total" value={money(account.lifetime.total.usd)} note={`${tokens(account.lifetime.total.tokens)} tokens since ${date(account.since)} UTC`} />
            <Stat label={expired ? "Last predicted reset" : "Predicted reset"} value={current ? date(current.expectedReset) : "Not observed"} note={current ? "UTC · based on PCC's last observation" : "No reset prediction recorded"} small />
          </dl>
          {account.spendPerDay !== undefined && <p className="mt-5 text-xs text-white/60">
            {money(account.spendPerDay)} per day this window
            {account.vsPreviousWindowPercent !== undefined && ` · ${account.vsPreviousWindowPercent >= 0 ? "+" : ""}${Math.round(account.vsPreviousWindowPercent)}% vs previous window's daily rate`}
          </p>}
          {current?.observedQuota && <p className="mt-3 text-xs leading-relaxed text-white/50">Quota last observed: {current.observedQuota.usedPercent}% used · {date(current.observedQuota.at)} UTC. Not a live reading.</p>}
          {warnings.length > 0 && <ul className="mt-4 space-y-1 text-xs leading-relaxed text-[#f4ca73]">{warnings.map((warning) => <li key={String(warning)}>{warning}</li>)}</ul>}
          {modelSummary.models.length > 0 && <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs"><caption className="mb-3 text-left text-sm text-white/75">{modelSummary === current ? "Models in this window" : "Recorded models"}</caption>
              <thead className="text-white/45"><tr><th scope="col" className="py-2 font-normal">Model</th><th scope="col" className="px-3 text-right font-normal">Tokens</th><th scope="col" className="text-right font-normal">API equivalent</th></tr></thead>
              <tbody>{modelSummary.models.map((model) => <tr key={model.modelId} className="border-t border-white/[.06]"><th scope="row" className="max-w-48 break-words py-3 pr-3 font-normal text-white/75">{prettyModel(model.modelId)}</th><td className="px-3 text-right font-mono tabular-nums text-white/55">{tokens(model.tokens)}</td><td className="text-right font-mono tabular-nums text-white/75">{money(model.usd)}</td></tr>)}</tbody>
            </table>
          </div>}
          {(account.closed.length > 0 || account.months.length > 0) && <details className="mt-6 border-t border-white/[.08] pt-4">
            <summary className="w-fit cursor-pointer rounded-sm text-xs text-white/65 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8eb7ff]">Reset windows and monthly totals</summary>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              {account.closed.length > 0 && <div><h3 className="mb-3 text-sm text-white/75">Completed windows</h3><ul className="space-y-4">
                {account.closed.map((window) => <li key={window.start} className="flex items-start justify-between gap-4 text-xs"><div className="min-w-0 leading-relaxed text-white/65">{date(window.start)} to {date(window.end)} UTC<div className="mt-1 text-white/45">{provenance(window)}{window.reason === "gap" ? " · observation gap" : ""}</div></div><span className="shrink-0 font-mono tabular-nums text-white/75">{money(window.total.usd)}</span></li>)}
              </ul></div>}
              {account.months.length > 0 && <div><h3 className="mb-3 text-sm text-white/75">UTC calendar months</h3><ul className="space-y-3 text-xs">
                {account.months.map((month) => <li key={month.month} className="flex justify-between gap-4"><span className="text-white/65">{month.month}{account.since.slice(0, 7) >= month.month ? " · partial" : ""}</span><span className="font-mono tabular-nums text-white/75">{money(month.total.usd)}</span></li>)}
              </ul><p className="mt-3 text-xs leading-relaxed text-white/45">Recorded amounts only. The current month is still in progress.</p></div>}
            </div>
          </details>}
        </div>;
      })}
      <p className="mt-6 border-t border-white/[.08] pt-4 text-xs leading-relaxed text-white/50">API-equivalent costs, not subscription charges. PCC records local Codex requests, compaction and cache keepalive. Machine ledgers stay separate because imported session history can overlap. These amounts are not added to the profile's session totals.</p>
    </div>
  </section>;
}

function Stat({ label, value, note, small = false }: { label: string; value: string; note: string; small?: boolean }) {
  return <div><dt className="text-xs text-white/50">{label}</dt><dd className={`mt-2 tracking-tight text-white/90 ${small ? "text-lg" : "text-2xl"}`}>{value}</dd><dd className="mt-2 text-xs leading-relaxed text-white/45">{note}</dd></div>;
}
