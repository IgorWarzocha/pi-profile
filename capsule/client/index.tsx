import { useQuery } from "lakebed/client";
import { useEffect, useMemo, useState } from "preact/hooks";

type NumberMap = Record<string, number>;
type DailyMetric = { sessions: number; tokens: number; outputTokens: number; toolCalls: number; messages: number; cost: number; courtesy: number; collaboration: number; friction: number };
type Profile = {
  generatedAt: string;
  profile: { name: string; handle: string; monogram: string; subtitle: string };
  headline: { lifetimeTokens: number; peakTokens: number; peakDay?: string; longestSessionMs: number; currentStreak: number; longestStreak: number };
  totals: Record<string, number>;
  daily: Record<string, DailyMetric>;
  machines: Array<{ machine: string; ok: boolean; sourceSessions: number; selectedSessions: number; malformedLines: number; error?: string }>;
  models: Array<{ modelId: string; provider?: string; sessions: number; messages: number; tokens: number; outputTokens: number; cost: number; toolCalls: number }>;
  projects: Array<{ name: string; sessions: number; tokens: number; toolCalls: number; messages: number; activeDurationMs: number; lastActive: string; machines: string[]; models: string[] }>;
  tools: Array<{ name: string; calls: number; results: number; errors: number; sessions: number }>;
  reasoningLevels: NumberMap;
  language: Record<string, NumberMap>;
  languageSummary: { courtesy: number; collaboration: number; friction: number; ragio: number; userMessages: number };
  insights: Record<string, string | number | undefined>;
  recentSessions: Array<{ project: string; machine: string; startedAt: string; endedAt: string; observedDurationMs: number; activeDurationMs: number; messages: number; toolCalls: number; tokens: number; model?: string; compactions: number }>;
};
type HeatMetric = "tokens" | "sessions" | "toolCalls" | "collaboration" | "friction";

export function App() {
  const data = useQuery<Profile>("profile");
  const [heatMetric, setHeatMetric] = useState<HeatMetric>("tokens");
  useEffect(() => { if (data?.profile) document.title = `${data.profile.name} · Pi Profile`; }, [data?.profile?.name]);
  if (!data?.profile) return <Loading />;
  const p = data;
  const t = p.totals;

  return <main className="min-h-screen bg-[#0d0f0f] text-[#f2f1eb] selection:bg-[#8eb7ff] selection:text-black">
    <style>{styles}</style>
    <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <nav className="mb-14 flex items-center justify-between border-b border-white/[.08] pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.24em] text-white/45"><PiMark /> Pi profile</div>
        <div className="flex items-center gap-2 text-xs text-white/40"><span className="h-1.5 w-1.5 rounded-full bg-[#80d49c] shadow-[0_0_10px_#80d49c]" /> synced {relativeTime(p.generatedAt)}</div>
      </nav>

      <header className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-white/10 bg-[#232827] text-2xl font-medium text-[#d9e5df] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">{p.profile.monogram}</div>
          <div><h1 className="text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{p.profile.name}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/45"><span>{p.profile.handle}</span><span>·</span><span>{p.profile.subtitle}</span></div></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40"><span className="rounded-full border border-white/10 px-3 py-1.5">{p.machines.filter((m) => m.ok).length} machines</span><span className="rounded-full border border-white/10 px-3 py-1.5">UTC activity</span></div>
      </header>

      <section aria-label="Profile highlights" className="mt-12 grid overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414] sm:grid-cols-2 lg:grid-cols-5">
        <HeroStat label="Lifetime tokens" value={compact(p.headline.lifetimeTokens)} detail={`${compact(t.outputTokens)} output`} />
        <HeroStat label="Peak tokens" value={compact(p.headline.peakTokens)} detail={prettyDate(p.headline.peakDay)} />
        <HeroStat label="Longest active session" value={duration(p.headline.longestSessionMs)} detail={`${String(p.insights.longestSessionProject ?? "session")} · gap estimate`} />
        <HeroStat label="Current streak" value={`${p.headline.currentStreak} days`} detail="active through latest day" />
        <HeroStat label="Longest streak" value={`${p.headline.longestStreak} days`} detail={`${t.activeDays} active days`} />
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="Activity" title="A year in Pi" aside={<MetricTabs value={heatMetric} onChange={setHeatMetric} />} />
        <div className="rounded-2xl border border-white/[.08] bg-[#111414] p-5 sm:p-7">
          <Heatmap daily={p.daily} metric={heatMetric} />
          <div className="mt-6 grid gap-6 border-t border-white/[.07] pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <InlineStat label="Sessions" value={integer(t.sessions)} note={`${integer(t.duplicatesRemoved)} duplicates removed`} />
            <InlineStat label="Messages" value={integer(t.userMessages + t.assistantMessages)} note={`${integer(t.userMessages)} from you`} />
            <InlineStat label="Tool calls" value={integer(t.toolCalls)} note={`${percent(t.toolErrors / Math.max(t.toolResults, 1))} result errors`} />
            <InlineStat label="Active time" value={duration(t.activeDurationMs)} note="30-minute gap estimate" />
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <SectionHeading eyebrow="Activity insights" title="How the work happens" />
          <div className="rounded-2xl border border-white/[.08] bg-[#111414]">
            <InsightRow label="Most used model" value={prettyModel(String(p.insights.mostUsedModel ?? "—"))} meta={`${percent((p.models[0]?.tokens ?? 0) / Math.max(t.totalTokens, 1))} of tokens`} color="#8eb7ff" />
            <InsightRow label="Most active project" value={String(p.insights.mostActiveProject ?? "—")} meta={`${p.projects[0]?.sessions ?? 0} sessions`} color="#cab5ff" />
            <InsightRow label="Most called tool" value={String(p.insights.mostUsedTool ?? "—")} meta={`${integer(p.tools[0]?.calls ?? 0)} calls`} color="#f4ca73" />
            <InsightRow label="Most selected reasoning level" value={titleCase(String(p.insights.primaryReasoning ?? "not recorded"))} meta={`${integer(sumMap(p.reasoningLevels))} changes recorded`} color="#80d49c" />
            <InsightRow label="Deepest thread" value={`${integer(Number(p.insights.deepestSessionMessages ?? 0))} messages`} meta={`${integer(t.compactions)} lifetime compactions`} color="#ef8f77" last />
          </div>
        </div>
        <div>
          <SectionHeading eyebrow="Sources" title="Three machines, one history" />
          <div className="rounded-2xl border border-white/[.08] bg-[#111414] p-5">
            {p.machines.map((machine) => <Machine key={machine.machine} machine={machine} />)}
            <div className="mt-4 rounded-xl bg-white/[.035] px-4 py-3 text-xs leading-relaxed text-white/40">Exact session IDs are deduplicated with server → desktop → laptop precedence. Raw transcripts never enter Lakebed.</div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="Work map" title="Projects with momentum" aside={<span className="text-xs text-white/35">Ranked by tokens</span>} />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {p.projects.slice(0, 9).map((project, index) => <ProjectCard key={`${project.name}-${index}`} project={project} max={p.projects[0]?.tokens ?? 1} rank={index + 1} />)}
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <SectionHeading eyebrow="Model mix" title="Where the tokens went" />
          <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/30"><span>Model</span><span>Sessions</span><span className="w-20 text-right">Tokens</span></div>
            {p.models.slice(0, 8).map((model, i) => <ModelRow key={model.modelId} model={model} total={t.totalTokens} last={i === Math.min(p.models.length, 8) - 1} />)}
          </div>
        </div>
        <div>
          <SectionHeading eyebrow="Tool surface" title="What Pi reached for" />
          <div className="rounded-2xl border border-white/[.08] bg-[#111414] p-5">
            <Bars values={Object.fromEntries(p.tools.slice(0, 9).map((tool) => [tool.name, tool.calls]))} accent="#f4ca73" />
            <div className="mt-5 flex gap-6 border-t border-white/[.07] pt-4"><Mini label="Results" value={integer(t.toolResults)} /><Mini label="Errors" value={integer(t.toolErrors)} /><Mini label="Compactions" value={integer(t.compactions)} /></div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="Devragio, expanded" title="The way you talk to your agent" aside={<span className="text-xs text-white/35">{integer(p.languageSummary.userMessages)} user messages · heuristics, not judgment</span>} />
        <div className="grid gap-4 lg:grid-cols-3">
          <SignalCard title="Courtesy" count={p.languageSummary.courtesy} messageCount={p.languageSummary.userMessages} values={p.language.courtesy} accent="#80d49c" summary="Requests, thanks, apologies and warmth." />
          <SignalCard title="Collaboration" count={p.languageSummary.collaboration} messageCount={p.languageSummary.userMessages} values={p.language.collaboration} accent="#8eb7ff" summary="Context, delegation, review and repair." />
          <SignalCard title="Friction" count={p.languageSummary.friction} messageCount={p.languageSummary.userMessages} values={p.language.friction} accent="#ef8f77" summary="Corrections, urgency, confusion and swearing." />
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-white/[.08] bg-[#111414] px-5 py-4 sm:flex-row sm:items-center"><div><span className="font-medium">Ragio</span><span className="ml-2 text-sm text-white/40">profanity ÷ all courtesy signals</span></div><div className="font-mono text-xl text-[#ef8f77]">{p.languageSummary.ragio.toFixed(2)}</div></div>
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="Recent threads" title="Latest activity" />
        <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414]">
          {p.recentSessions.map((session, i) => <SessionRow key={`${session.startedAt}-${session.project}-${i}`} session={session} last={i === p.recentSessions.length - 1} />)}
        </div>
      </section>

      <footer className="mt-14 flex flex-col justify-between gap-2 border-t border-white/[.08] pt-5 text-xs text-white/30 sm:flex-row"><span>Generated from Pi session metadata on server, desktop and laptop.</span><span>Cache read share {percent(t.cacheReadShare)} · provider-reported cost {money(t.cost)}</span></footer>
    </div>
  </main>;
}

function Heatmap({ daily, metric }: { daily: Record<string, DailyMetric>; metric: HeatMetric }) {
  const days = useMemo(() => calendarDays(Object.keys(daily).sort().at(-1)), [daily]);
  const values = days.map((day) => heatValue(daily[day], metric));
  const max = Math.max(...values, 1);
  return <div className="overflow-x-auto pb-2"><div className="heat-grid min-w-[760px]" role="img" aria-label={`Daily ${metric} activity over the latest year`}>
    {days.map((day, index) => { const value = values[index]; const intensity = value ? Math.max(.2, Math.log1p(value) / Math.log1p(max)) : 0; return <div key={day} className="heat-cell" title={`${prettyDate(day)} · ${heatLabel(value, metric)}`} style={{ backgroundColor: value ? heatColor(metric, intensity) : "#1a1e1d" }} />; })}
  </div><div className="mt-3 flex min-w-[760px] justify-between text-[10px] uppercase tracking-wider text-white/25"><span>{prettyDate(days[0])}</span><span>{metric === "tokens" ? "Token intensity" : titleCase(metric)}</span><span>{prettyDate(days.at(-1))}</span></div></div>;
}

function MetricTabs({ value, onChange }: { value: HeatMetric; onChange: (metric: HeatMetric) => void }) {
  const tabs: HeatMetric[] = ["tokens", "sessions", "toolCalls", "collaboration", "friction"];
  return <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-white/[.035] p-1">{tabs.map((tab) => <button key={tab} onClick={() => onChange(tab)} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition focus:outline-none focus:ring-2 focus:ring-[#8eb7ff]/50 ${value === tab ? "bg-white/[.1] text-white" : "text-white/35 hover:text-white/70"}`}>{tab === "toolCalls" ? "Tools" : titleCase(tab)}</button>)}</div>;
}
function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="border-b border-white/[.07] p-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"><div className="text-2xl font-medium tracking-[-.035em]">{value}</div><div className="mt-1 text-sm text-white/55">{label}</div><div className="mt-3 truncate text-[11px] text-white/25">{detail}</div></div>; }
function InlineStat({ label, value, note }: { label: string; value: string; note: string }) { return <div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">{label}</div><div className="mt-1 text-2xl tracking-tight">{value}</div><div className="mt-1 text-xs text-white/30">{note}</div></div>; }
function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: any }) { return <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#8eb7ff]">{eyebrow}</div><h2 className="mt-1 text-xl font-medium tracking-[-.025em]">{title}</h2></div>{aside}</div>; }
function InsightRow({ label, value, meta, color, last }: { label: string; value: string; meta: string; color: string; last?: boolean }) { return <div className={`grid grid-cols-[8px_1fr_auto] items-center gap-3 px-5 py-4 ${last ? "" : "border-b border-white/[.07]"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><div><div className="text-xs text-white/35">{label}</div><div className="mt-0.5 truncate text-sm">{value}</div></div><span className="text-xs text-white/35">{meta}</span></div>; }
function Machine({ machine }: { machine: Profile["machines"][number] }) { return <div className="flex items-center justify-between border-b border-white/[.07] px-1 py-4 last:border-0"><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${machine.ok ? "bg-[#80d49c]" : "bg-[#ef8f77]"}`} /><div><div className="text-sm capitalize">{machine.machine}</div><div className="mt-0.5 text-xs text-white/30">{machine.ok ? `${integer(machine.selectedSessions)} canonical` : machine.error}</div></div></div><div className="text-right"><div className="font-mono text-sm">{integer(machine.sourceSessions)}</div><div className="text-[10px] uppercase tracking-wider text-white/25">source sessions</div></div></div>; }
function ProjectCard({ project, max, rank }: { project: Profile["projects"][number]; max: number; rank: number }) { return <article className="group rounded-2xl border border-white/[.08] bg-[#111414] p-5 transition hover:-translate-y-0.5 hover:border-white/[.16]"><div className="flex items-start justify-between"><div className="min-w-0"><div className="truncate font-medium">{project.name}</div><div className="mt-1 text-xs text-white/30">active {relativeTime(project.lastActive)}</div></div><span className="font-mono text-xs text-white/20">{String(rank).padStart(2, "0")}</span></div><div className="mt-6 h-1 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-[#cab5ff]" style={{ width: `${Math.max(4, project.tokens / max * 100)}%` }} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><ProjectMetric label="Sessions" value={integer(project.sessions)} /><ProjectMetric label="Tokens" value={compact(project.tokens)} /><ProjectMetric label="Tools" value={compact(project.toolCalls)} /></div><div className="mt-4 truncate text-[11px] text-white/25">{project.models.slice(0, 2).map(prettyModel).join(" · ") || "No model metadata"}</div></article>; }
function ProjectMetric({ label, value }: { label: string; value: string }) { return <div><div className="text-white/25">{label}</div><div className="mt-0.5 text-white/65">{value}</div></div>; }
function ModelRow({ model, total, last }: { model: Profile["models"][number]; total: number; last: boolean }) { return <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5 ${last ? "" : "border-b border-white/[.06]"}`}><div className="min-w-0"><div className="truncate text-sm">{prettyModel(model.modelId)}</div><div className="mt-1 h-0.5 max-w-40 overflow-hidden rounded bg-white/[.05]"><div className="h-full bg-[#8eb7ff]" style={{ width: `${model.tokens / Math.max(total, 1) * 100}%` }} /></div></div><div className="font-mono text-xs text-white/35">{integer(model.sessions)}</div><div className="w-20 text-right font-mono text-xs">{compact(model.tokens)}</div></div>; }
function Bars({ values, accent }: { values: NumberMap; accent: string }) { const entries = Object.entries(values); const max = Math.max(...entries.map(([, v]) => v), 1); return <div className="space-y-3">{entries.map(([name, value]) => <div key={name}><div className="mb-1.5 flex justify-between gap-4 text-xs"><span className="truncate text-white/55">{titleCase(name)}</span><span className="font-mono text-white/35">{integer(value)}</span></div><div className="h-1 rounded bg-white/[.05]"><div className="h-full rounded" style={{ width: `${value / max * 100}%`, backgroundColor: accent }} /></div></div>)}</div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] uppercase tracking-wider text-white/25">{label}</div><div className="mt-1 font-mono text-sm text-white/65">{value}</div></div>; }
function SignalCard({ title, count, messageCount, values, accent, summary }: { title: string; count: number; messageCount: number; values?: NumberMap; accent: string; summary: string }) { return <article className="rounded-2xl border border-white/[.08] bg-[#111414] p-5"><div className="flex items-baseline justify-between"><h3 className="font-medium">{title}</h3><span className="font-mono text-2xl" style={{ color: accent }}>{integer(count)}</span></div><p className="mt-2 text-xs leading-relaxed text-white/35">{summary}</p><div className="my-5 h-px bg-white/[.07]" /><Bars values={values ?? {}} accent={accent} /><div className="mt-5 text-[11px] text-white/25">{(count / Math.max(messageCount, 1) * 100).toFixed(1)} signals per 100 messages</div></article>; }
function SessionRow({ session, last }: { session: Profile["recentSessions"][number]; last: boolean }) { return <div className={`grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center ${last ? "" : "border-b border-white/[.06]"}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm">{session.project}</span><span className="shrink-0 rounded-full border border-white/[.08] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/30">{session.machine}</span></div><div className="mt-1 truncate text-xs text-white/30">{prettyModel(session.model ?? "unknown")} · {relativeTime(session.endedAt)}</div></div><div className="flex gap-4 text-xs text-white/35"><span>{session.messages} msgs</span><span>{session.toolCalls} tools</span><span>{compact(session.tokens)} tok</span><span>{duration(session.activeDurationMs)}</span></div></div>; }
function PiMark() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 3.5h10M4.5 3.5v7M9.5 3.5v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>; }
function Loading() { return <main className="grid min-h-screen place-items-center bg-[#0d0f0f] text-sm text-white/45">Loading profile…</main>; }

function calendarDays(last?: string) { const end = last ? new Date(`${last}T00:00:00Z`) : new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay()); const days: string[] = []; for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10)); return days; }
function heatValue(day: DailyMetric | undefined, metric: HeatMetric) { if (!day) return 0; return metric === "collaboration" ? day.collaboration : metric === "friction" ? day.friction : day[metric] ?? 0; }
function heatColor(metric: HeatMetric, intensity: number) { const rgb = metric === "friction" ? [239,143,119] : metric === "collaboration" ? [142,183,255] : metric === "toolCalls" ? [244,202,115] : metric === "sessions" ? [128,212,156] : [114,166,255]; return `rgba(${rgb.join(",")},${(.18 + intensity * .82).toFixed(2)})`; }
function heatLabel(value: number, metric: HeatMetric) { return metric === "tokens" ? `${compact(value)} tokens` : `${integer(value)} ${metric === "toolCalls" ? "tool calls" : metric}`; }
function compact(value = 0) { const abs = Math.abs(value); return abs >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : integer(value); }
function integer(value = 0) { return Math.round(value).toLocaleString(); }
function percent(value = 0) { return `${(value * 100).toFixed(value >= .1 ? 1 : 2)}%`; }
function money(value = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function duration(ms = 0) { if (!ms) return "0m"; const mins = Math.round(ms / 60000); if (mins < 60) return `${mins}m`; const hours = Math.floor(mins / 60), rem = mins % 60; if (hours < 24) return `${hours}h ${rem}m`; return `${Math.floor(hours / 24)}d ${hours % 24}h`; }
function prettyDate(value?: string) { if (!value) return "—"; return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: value.slice(0,4) === new Date().getUTCFullYear().toString() ? undefined : "numeric", timeZone: "UTC" }); }
function relativeTime(value: string) { const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000); if (seconds < 90) return "just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`; return prettyDate(value); }
function prettyModel(value: string) { return value === "unknown" ? "Unknown model" : value.replace(/[-_]/g, " ").replace(/\b(?:gpt|glm|ai)\b/gi, (m) => m.toUpperCase()).replace(/\b\w/g, (m) => m.toUpperCase()); }
function titleCase(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
function sumMap(map: NumberMap) { return Object.values(map ?? {}).reduce((sum, value) => sum + value, 0); }

const styles = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0f0f; }
  button { font: inherit; }
  .heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr); grid-auto-columns: minmax(9px, 1fr); gap: 4px; }
  .heat-cell { aspect-ratio: 1; min-width: 8px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.025); transition: transform 120ms ease, filter 120ms ease; }
  .heat-cell:hover { transform: scale(1.35); filter: brightness(1.25); z-index: 2; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
