"use client";

import { useState } from "react";
import { prettyModel } from "./model-split";
import type { CodexUsageSource } from "./profile-types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const tokens = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));

export function CodexUsage({ sources, generatedAt }: { sources: ReadonlyArray<CodexUsageSource>; generatedAt: string }) {
  const machines = sources.filter((source) => source.accounts.length > 0);
  const [selected, setSelected] = useState(0);
  if (!machines.length) return null;
  const source = machines[selected] ?? machines[0];
  return <section className="mt-12" aria-label="Codex usage">
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <h2 className="text-xl font-medium tracking-[-.025em]">Codex</h2>
      {machines.length > 1 && <div className="flex gap-3" aria-label="Usage machine">
        {machines.map((item, index) => <button key={item.machine} type="button" aria-pressed={index === selected}
          onClick={() => setSelected(index)} className={"border-b px-0.5 py-1 text-[11px] capitalize transition focus:outline-none focus:ring-2 focus:ring-[#8eb7ff]/50 " + (index === selected ? "border-[#8eb7ff] text-white" : "border-transparent text-white/30 hover:text-white/65")}>
          {item.machine}
        </button>)}
      </div>}
    </div>
    <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414]">
      {source.accounts.map((account, index) => {
        const current = account.current;
        const summary = current?.models.length ? current : account.lifetime;
        const expired = current && Date.parse(current.expectedReset) <= Date.parse(generatedAt);
        return <div key={index} className={index ? "border-t border-white/[.08]" : ""}>
          {source.accounts.length > 1 && <h3 className="px-5 pt-4 text-sm">Account {index + 1}</h3>}
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4">
            <p className="text-sm text-white/55"><strong className="mr-2 text-2xl font-medium tabular-nums tracking-tight text-white">{money(summary.total.usd)}</strong>{" "}{summary === current ? expired ? "last window" : "this window" : "recorded"}</p>
            {current && !expired && <p className="text-xs text-white/35">resets <time dateTime={current.expectedReset}>{date(current.expectedReset)}</time></p>}
          </div>
          {summary.models.length > 0 && <table className="w-full text-left">
            <thead className="border-y border-white/[.07] text-[10px] font-semibold uppercase tracking-[.16em] text-white/30">
              <tr><th scope="col" className="px-5 py-3 font-semibold">Model</th><th scope="col" className="px-3 text-right font-semibold">Tokens</th><th scope="col" className="pr-5 text-right font-semibold">API cost</th></tr>
            </thead>
            <tbody>{summary.models.slice(0, 6).map((model) => <tr key={model.modelId} className="border-b border-white/[.06] last:border-b-0">
              <th scope="row" className="break-words px-5 py-3.5 text-sm font-normal">{prettyModel(model.modelId)}</th>
              <td className="px-3 text-right font-mono text-xs text-white/35">{tokens(model.tokens)}</td>
              <td className="pr-5 text-right font-mono text-xs">{money(model.usd)}</td>
            </tr>)}</tbody>
          </table>}
        </div>;
      })}
    </div>
  </section>;
}
