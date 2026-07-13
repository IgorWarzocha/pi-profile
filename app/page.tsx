"use client";

import { useEffect, useMemo, useState } from "react";
import { PROFILE_OVERVIEW } from "./generated/profile-overview";
import type { DailyMetric, NumberMap, Profile } from "./profile-types";
type HeatMetric = "tokens" | "sessions" | "friction";

export default function App() {
  const p = PROFILE_OVERVIEW;
  const [heatMetric, setHeatMetric] = useState<HeatMetric>("tokens");
  useEffect(() => { document.title = `${p.profile.name} · Pi Profile`; }, [p.profile.name]);
  const t = p.totals;

  return <main className="min-h-screen bg-[#0d0f0f] text-[#f2f1eb] selection:bg-[#8eb7ff] selection:text-black">
    <style>{styles}</style>
    <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <header className="grid gap-8 border-b border-white/[.08] pb-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-5">
          <img src={p.profile.avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full border border-white/10 object-cover shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" />
          <div className="min-w-0"><h1 className="text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{p.profile.name}</h1><SocialLinks profile={p.profile} /></div>
        </div>
        <div className="sm:text-right"><div className="text-xs font-semibold uppercase tracking-[.24em] text-white/45">Pi profile</div><div className="mt-2 flex items-center gap-2 text-xs text-white/35 sm:justify-end"><span className="h-1.5 w-1.5 rounded-full bg-[#80d49c] shadow-[0_0_10px_#80d49c]" /> synced <RelativeTime value={p.generatedAt} /></div></div>
      </header>

      <section aria-label="Profile highlights" className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414] lg:grid-cols-4">
        <HeroStat label="Lifetime tokens" value={compact(p.headline.lifetimeTokens)} detail={`${compact(t.outputTokens)} output`} />
        <HeroStat label="Cache read" value={percent(t.cacheReadShare)} detail={`${compact(t.cacheReadTokens)} cached`} />
        <HeroStat label="Reported cost" value={money(t.cost)} detail={`${money(t.cost / Math.max(t.sessions, 1), 2)} per session`} />
        <HeroStat label="Current streak" value={`${p.headline.currentStreak} days`} detail={`${p.headline.longestStreak} day record`} />
      </section>

      <section className="mt-12">
        <SectionHeading title="Activity" aside={<MetricTabs value={heatMetric} onChange={setHeatMetric} />} />
        <div className="rounded-2xl border border-white/[.08] bg-[#111414] p-5 sm:p-7">
          <Heatmap daily={p.daily} metric={heatMetric} />
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/[.07] pt-6 md:grid-cols-6 md:gap-x-3 xl:gap-x-6">
            <InlineStat label="Sessions" value={integer(t.sessions)} note={`${integer(t.activeDays)} active days`} />
            <InlineStat label="Active time" value={duration(t.activeDurationMs)} note="estimated" />
            <InlineStat label="Messages" value={integer(t.userMessages + t.assistantMessages)} note={`${integer(t.userMessages)} prompts`} />
            <InlineStat label="Tool calls" value={integer(t.toolCalls)} note={`${integer(t.toolErrors)} errors`} />
            <InlineStat label="Peak day" value={compact(p.headline.peakTokens)} note={prettyDate(p.headline.peakDay)} />
            <InlineStat label="Longest session" value={duration(p.headline.longestSessionMs)} note={String(p.insights.longestSessionProject ?? "session")} />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading title="Insights" />
        <div className="rounded-2xl border border-white/[.08] bg-[#111414]">
          <InsightRow label="Most used model" value={prettyModel(String(p.insights.mostUsedModel ?? "—"))} meta={`${percent((p.models[0]?.tokens ?? 0) / Math.max(t.totalTokens, 1))} of tokens`} color="#8eb7ff" />
          <InsightRow label="Most active project" value={String(p.insights.mostActiveProject ?? "—")} meta={`${p.projects[0]?.sessions ?? 0} sessions`} color="#cab5ff" />
          <InsightRow label="Most called tool" value={String(p.insights.mostUsedTool ?? "—")} meta={`${integer(p.tools[0]?.calls ?? 0)} calls`} color="#f4ca73" />
          <InsightRow label="Reasoning level" value={titleCase(String(p.insights.primaryReasoning ?? "not recorded"))} meta={`${integer(sumMap(p.reasoningLevels))} changes`} color="#80d49c" />
          <InsightRow label="Deepest thread" value={`${integer(Number(p.insights.deepestSessionMessages ?? 0))} messages`} meta={`${integer(t.compactions)} compactions`} color="#ef8f77" last />
        </div>
      </section>

      <DeferredDetails />
      <ProfileFooter />
    </div>
  </main>;
}

function DeferredDetails() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const idle = (window as any).requestIdleCallback;
    const id = idle ? idle(() => setEnabled(true), { timeout: 1200 }) : window.setTimeout(() => setEnabled(true), 0);
    return () => { const cancel = (window as any).cancelIdleCallback; cancel ? cancel(id) : window.clearTimeout(id); };
  }, []);
  return enabled ? <ProfileDetailsLoader /> : null;
}

function ProfileDetailsLoader() {
  const [profile, setProfile] = useState<Profile>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    import("./generated/profile").then(({ DEFAULT_PROFILE }) => {
      if (active) setProfile(DEFAULT_PROFILE);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);
  if (failed) return <DetailsError onRetry={() => setAttempt((value) => value + 1)} />;
  return profile?.profile ? <ProfileDetails profile={profile} /> : <DetailsLoading />;
}

function DetailsLoading() { return <section className="mt-12 grid gap-5 lg:grid-cols-3" aria-label="Loading profile details"><span className="sr-only">Loading profile details</span>{[0, 1, 2].map((item) => <div key={item} className="h-72 rounded-2xl border border-white/[.06] bg-[#111414] p-5"><div className="h-4 w-20 rounded bg-white/[.07]" /><div className="mt-8 space-y-5">{[0, 1, 2, 3].map((line) => <div key={line} className="h-2 rounded bg-white/[.045]" style={{ width: `${88 - line * 9}%` }} />)}</div></div>)}</section>; }
function DetailsError({ onRetry }: { onRetry: () => void }) { return <section className="mt-12 rounded-2xl border border-white/[.08] bg-[#111414] p-6 text-sm text-white/55"><p>Profile details could not be loaded.</p><button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-white transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-[#8eb7ff]/50">Try again</button></section>; }

function ProfileDetails({ profile: p }: { profile: Profile }) {
  const t = p.totals;
  return <div className="details-enter">
      <section className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col">
          <SectionHeading title="Models" />
          <div className="flex-1 overflow-hidden rounded-2xl border border-white/[.08] bg-[#111414] lg:min-h-[400px]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/30"><span>Model</span><span>Sessions</span><span className="w-20 text-right">Tokens</span></div>
            {p.models.slice(0, 6).map((model, i) => <ModelRow key={model.modelId} model={model} total={t.totalTokens} last={i === Math.min(p.models.length, 6) - 1} />)}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <SectionHeading title="Machines" />
          <div className="flex flex-1 flex-col rounded-2xl border border-white/[.08] bg-[#111414] p-5 lg:min-h-[400px]">
            {p.machines.map((machine) => <Machine key={machine.machine} machine={machine} />)}
            <div className="mt-auto grid grid-cols-2 gap-4 border-t border-white/[.07] pt-4"><Mini label="Sessions" value={integer(t.sessions)} /><Mini label="Active days" value={integer(t.activeDays)} /></div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <SectionHeading title="Tools" />
          <div className="flex flex-1 flex-col rounded-2xl border border-white/[.08] bg-[#111414] p-5 lg:min-h-[400px]">
            <Bars values={Object.fromEntries(p.tools.slice(0, 9).map((tool) => [tool.name, tool.calls]))} accent="#f4ca73" />
            <div className="mt-auto flex gap-6 border-t border-white/[.07] pt-4"><Mini label="Results" value={integer(t.toolResults)} /><Mini label="Errors" value={integer(t.toolErrors)} /><Mini label="Compactions" value={integer(t.compactions)} /></div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading title={<span className="flex items-baseline gap-3">Language <span className="text-xs font-normal text-white/30">{integer(p.languageSummary.userMessages)} messages</span></span>} aside={<span className="text-xs text-white/35" title="Profanity divided by courtesy signals">Rage factor <strong className="ml-2 font-mono text-base font-normal text-[#ef8f77]">{p.languageSummary.ragio.toFixed(2)}</strong></span>} />
        <div className="grid gap-4 lg:grid-cols-3">
          <SignalCard title="Courtesy" count={p.languageSummary.courtesy} messageCount={p.languageSummary.userMessages} values={p.language.courtesy} accent="#80d49c" />
          <SignalCard title="Collaboration" count={p.languageSummary.collaboration} messageCount={p.languageSummary.userMessages} values={p.language.collaboration} accent="#8eb7ff" />
          <SignalCard title="Rage" count={p.languageSummary.friction} messageCount={p.languageSummary.userMessages} values={p.language.friction} accent="#ef8f77" />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading title="Projects" />
        <div className="overflow-x-auto rounded-2xl border border-white/[.08] bg-[#111414]">
          <div className="min-w-[720px]"><div className="grid grid-cols-[minmax(180px,1fr)_90px_100px_90px_150px_90px] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/30"><span>Project</span><span>Sessions</span><span>Tokens</span><span>Tools</span><span>Model</span><span className="text-right">Active</span></div>
          {p.projects.slice(0, 12).map((project, i) => <ProjectRow key={`${project.name}-${i}`} project={project} last={i === Math.min(p.projects.length, 12) - 1} />)}</div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading title="Recent sessions" />
        <div tabIndex={0} aria-label="Recent sessions table" className="overflow-x-auto rounded-2xl border border-white/[.08] bg-[#111414] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8eb7ff]/50"><table className="w-full min-w-[820px] table-fixed"><colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 76 }} /><col style={{ width: 58 }} /><col style={{ width: 58 }} /><col style={{ width: 76 }} /><col style={{ width: 78 }} /></colgroup><thead><tr className="border-b border-white/[.07] text-[10px] font-semibold uppercase tracking-[.14em] text-white/30"><th scope="col" className="py-3 pl-5 pr-2 text-left">Session</th><th scope="col" className="px-2 py-3 text-left">Model</th><th scope="col" className="px-2 py-3 text-left">Updated</th><th scope="col" className="px-2 py-3 text-right">Msgs</th><th scope="col" className="px-2 py-3 text-right">Tools</th><th scope="col" className="px-2 py-3 text-right">Tokens</th><th scope="col" className="py-3 pl-2 pr-5 text-right">Duration</th></tr></thead><tbody>{p.recentSessions.map((session, i) => <SessionRow key={`${session.startedAt}-${session.project}-${i}`} session={session} last={i === p.recentSessions.length - 1} />)}</tbody></table></div>
      </section>

    </div>;
}

function ProfileFooter() { return <footer className="mt-14 flex flex-col justify-between gap-3 border-t border-white/[.08] pt-5 text-xs text-white/30 sm:flex-row"><a href="https://developers.openai.com/codex/sites" target="_blank" rel="noreferrer" className="transition hover:text-white">Hosted with ChatGPT Sites</a><a href="https://github.com/IgorWarzocha/pi-profile" target="_blank" rel="noreferrer" className="transition hover:text-white">Want one?</a></footer>; }

function Heatmap({ daily, metric }: { daily: Record<string, DailyMetric>; metric: HeatMetric }) {
  const days = useMemo(() => calendarDays(Object.keys(daily).sort().at(-1)), [daily]);
  const values = days.map((day) => heatValue(daily[day], metric));
  const max = Math.max(...values, 1);
  return <div className="overflow-x-auto pb-2"><div className="heat-grid min-w-[760px]" role="img" aria-label={`Daily ${metricLabel(metric)} activity over the latest year`}>
    {days.map((day, index) => { const value = values[index]; const intensity = value ? Math.max(.2, Math.log1p(value) / Math.log1p(max)) : 0; return <div key={day} className="heat-cell" title={`${prettyDate(day)} · ${heatLabel(value, metric)}`} style={{ backgroundColor: value ? heatColor(metric, intensity) : "#1a1e1d" }} />; })}
  </div><div className="mt-3 flex min-w-[760px] justify-between text-[10px] uppercase tracking-wider text-white/25"><span>{prettyDate(days[0])}</span><span>{metric === "tokens" ? "Token intensity" : metricLabel(metric)}</span><span>{prettyDate(days.at(-1))}</span></div></div>;
}

function MetricTabs({ value, onChange }: { value: HeatMetric; onChange: (metric: HeatMetric) => void }) {
  const tabs: HeatMetric[] = ["tokens", "sessions", "friction"];
  return <div className="flex max-w-full gap-3 overflow-x-auto">{tabs.map((tab) => <button key={tab} onClick={() => onChange(tab)} className={`whitespace-nowrap border-b px-0.5 py-1 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-[#8eb7ff]/50 ${value === tab ? "border-[#8eb7ff] text-white" : "border-transparent text-white/30 hover:text-white/65"}`}>{metricLabel(tab)}</button>)}</div>;
}
function SocialLinks({ profile }: { profile: Profile["profile"] }) {
  const links = [
    { href: profile.links.x, label: `X ${profile.handle}`, icon: "x" },
    { href: profile.links.github, label: "GitHub @IgorWarzocha", icon: "github" },
    { href: profile.links.linkedin, label: "LinkedIn igorwarzocha", icon: "linkedin" },
    { href: profile.links.website, label: "howaboua.dev" },
  ];
  return <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/40">{links.map(({ href, label, icon }) => <a key={href} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="inline-flex h-5 items-center transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#8eb7ff]/50">{icon ? <SocialIcon name={icon} /> : label}</a>)}</div>;
}
function HeroStat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="border-b border-white/[.07] p-5 last:border-b-0 [&:nth-child(odd)]:border-r [&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"><div className="text-2xl font-medium tabular-nums tracking-[-.035em]">{value}</div><div className="mt-1 text-sm text-white/55">{label}</div>{detail && <div className="mt-3 truncate text-[11px] text-white/25">{detail}</div>}</div>; }
function InlineStat({ label, value, note }: { label: string; value: string; note: string }) { return <div className="min-w-0"><div className="truncate text-[10px] font-semibold uppercase tracking-[.18em] text-white/30 md:text-[9px] md:tracking-[.1em] xl:text-[10px] xl:tracking-[.18em]">{label}</div><div className="mt-1 truncate text-xl tabular-nums tracking-tight md:text-[clamp(1rem,2vw,1.5rem)] xl:text-2xl">{value}</div><div className="mt-1 truncate text-[11px] text-white/30 xl:text-xs">{note}</div></div>; }
function SectionHeading({ title, aside }: { title: any; aside?: any }) { return <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><h2 className="text-xl font-medium tracking-[-.025em]">{title}</h2>{aside}</div>; }
function InsightRow({ label, value, meta, color, last }: { label: string; value: string; meta: string; color: string; last?: boolean }) { return <div className={`grid grid-cols-[8px_minmax(90px,.9fr)_minmax(70px,1fr)] items-center gap-3 px-5 py-3.5 sm:grid-cols-[8px_180px_minmax(0,1fr)_180px] ${last ? "" : "border-b border-white/[.07]"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="truncate text-xs text-white/35">{label}</span><span className="truncate text-sm">{value}</span><span className="hidden truncate text-right text-xs text-white/35 sm:block">{meta}</span></div>; }
function Machine({ machine }: { machine: Profile["machines"][number] }) { return <div className="flex items-center justify-between border-b border-white/[.07] px-1 py-4 last:border-0"><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${machine.ok ? "bg-[#80d49c]" : "bg-[#ef8f77]"}`} /><div className="text-sm capitalize">{machine.machine}</div></div><div className="font-mono text-sm text-white/55">{machine.ok ? `${integer(machine.sourceSessions)} sessions` : "offline"}</div></div>; }
function ProjectRow({ project, last }: { project: Profile["projects"][number]; last: boolean }) { return <div className={`grid grid-cols-[minmax(180px,1fr)_90px_100px_90px_150px_90px] items-center gap-4 px-5 py-3 text-sm ${last ? "" : "border-b border-white/[.06]"}`}><span className="truncate font-medium">{project.name}</span><span className="font-mono text-xs text-white/45">{integer(project.sessions)}</span><span className="font-mono text-xs">{compact(project.tokens)}</span><span className="font-mono text-xs text-white/45">{compact(project.toolCalls)}</span><span className="truncate text-xs text-white/45">{prettyModel(project.models[0] ?? "unknown")}</span><span className="text-right text-xs text-white/30"><RelativeTime value={project.lastActive} /></span></div>; }
function ModelRow({ model, total, last }: { model: Profile["models"][number]; total: number; last: boolean }) { return <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5 ${last ? "" : "border-b border-white/[.06]"}`}><div className="min-w-0"><div className="truncate text-sm">{prettyModel(model.modelId)}</div><div className="mt-1 h-0.5 max-w-40 overflow-hidden rounded bg-white/[.05]"><div className="h-full bg-[#8eb7ff]" style={{ width: `${model.tokens / Math.max(total, 1) * 100}%` }} /></div></div><div className="font-mono text-xs text-white/35">{integer(model.sessions)}</div><div className="w-20 text-right font-mono text-xs">{compact(model.tokens)}</div></div>; }
function Bars({ values, accent }: { values: NumberMap; accent: string }) { const entries = Object.entries(values); const max = Math.max(...entries.map(([, v]) => v), 1); return <div className="space-y-3">{entries.map(([name, value]) => <div key={name}><div className="mb-1.5 flex justify-between gap-4 text-xs"><span className="truncate text-white/55">{titleCase(name)}</span><span className="font-mono text-white/35">{integer(value)}</span></div><div className="h-1 rounded bg-white/[.05]"><div className="h-full rounded" style={{ width: `${value / max * 100}%`, backgroundColor: accent }} /></div></div>)}</div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] uppercase tracking-wider text-white/25">{label}</div><div className="mt-1 font-mono text-sm text-white/65">{value}</div></div>; }
function SignalCard({ title, count, messageCount, values, accent }: { title: string; count: number; messageCount: number; values?: NumberMap; accent: string }) { return <article className="rounded-2xl border border-white/[.08] bg-[#111414] p-5"><div className="flex items-baseline justify-between"><h3 className="font-medium">{title}</h3><span className="font-mono text-2xl" style={{ color: accent }}>{integer(count)}</span></div><div className="my-5 h-px bg-white/[.07]" /><Bars values={values ?? {}} accent={accent} /><div className="mt-5 text-[11px] text-white/25">{(count / Math.max(messageCount, 1) * 100).toFixed(1)} per 100 messages</div></article>; }
function SessionRow({ session, last }: { session: Profile["recentSessions"][number]; last: boolean }) { return <tr className={`text-xs ${last ? "" : "border-b border-white/[.06]"}`}><td className="py-3 pl-5 pr-2"><div className="flex min-w-0 items-center gap-2"><span className="truncate text-sm">{session.project}</span><span className="shrink-0 rounded-full border border-white/[.08] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/30">{session.machine}</span></div></td><td className="truncate px-2 py-3 text-white/35">{prettyModel(session.model ?? "unknown")}</td><td className="truncate px-2 py-3 text-white/30"><RelativeTime value={session.endedAt} /></td><td className="px-2 py-3 text-right font-mono tabular-nums text-white/35">{session.messages}</td><td className="px-2 py-3 text-right font-mono tabular-nums text-white/35">{session.toolCalls}</td><td className="px-2 py-3 text-right font-mono tabular-nums text-white/35">{compact(session.tokens)}</td><td className="py-3 pl-2 pr-5 text-right font-mono tabular-nums text-white/35">{duration(session.activeDurationMs)}</td></tr>; }
function SocialIcon({ name }: { name: string }) {
  if (name === "x") return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>;
  if (name === "github") return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.42v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.1 20.45H3.54V8.98H7.1v11.47Z" /></svg>;
}
function calendarDays(last?: string) { const end = last ? new Date(`${last}T00:00:00Z`) : new Date(PROFILE_OVERVIEW.generatedAt); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay()); const days: string[] = []; for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10)); return days; }
function heatValue(day: DailyMetric | undefined, metric: HeatMetric) { if (!day) return 0; return metric === "friction" ? day.friction : day[metric] ?? 0; }
function heatColor(metric: HeatMetric, intensity: number) { const rgb = metric === "friction" ? [239,143,119] : metric === "sessions" ? [128,212,156] : [114,166,255]; return `rgba(${rgb.join(",")},${(.18 + intensity * .82).toFixed(2)})`; }
function heatLabel(value: number, metric: HeatMetric) { return metric === "tokens" ? `${compact(value)} tokens` : `${integer(value)} ${metricLabel(metric).toLowerCase()}`; }
function metricLabel(metric: HeatMetric) { return metric === "friction" ? "Rage" : titleCase(metric); }
function compact(value = 0) { const abs = Math.abs(value); return abs >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : integer(value); }
function integer(value = 0) { return Math.round(value).toLocaleString("en-US"); }
function percent(value = 0) { return `${(value * 100).toFixed(value >= .1 ? 1 : 2)}%`; }
function money(value = 0, digits = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function duration(ms = 0) { if (!ms) return "0m"; const mins = Math.round(ms / 60000); if (mins < 60) return `${mins}m`; const hours = Math.floor(mins / 60), rem = mins % 60; if (hours < 24) return `${hours}h ${rem}m`; return `${Math.floor(hours / 24)}d ${hours % 24}h`; }
function prettyDate(value?: string) { if (!value) return "—"; return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: value.slice(0,4) === new Date(PROFILE_OVERVIEW.generatedAt).getUTCFullYear().toString() ? undefined : "numeric", timeZone: "UTC" }); }
function RelativeTime({ value }: { value: string }) { const [now, setNow] = useState<number>(); useEffect(() => { const update = () => setNow(Date.now()); update(); const timer = window.setInterval(update, 60000); return () => window.clearInterval(timer); }, []); return <>{now === undefined ? prettyDate(value) : relativeTime(value, now)}</>; }
function relativeTime(value: string, now: number) { const seconds = Math.max(0, (now - Date.parse(value)) / 1000); if (seconds < 90) return "just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`; return prettyDate(value); }
function prettyModel(value: string) { return value === "unknown" ? "Unknown model" : value.replace(/[-_]/g, " ").replace(/\b(?:gpt|glm|ai)\b/gi, (m) => m.toUpperCase()).replace(/\b\w/g, (m) => m.toUpperCase()); }
function titleCase(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
function sumMap(map: NumberMap) { return Object.values(map ?? {}).reduce((sum, value) => sum + value, 0); }

const styles = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0f0f; }
  button { font: inherit; }
  .details-enter { animation: details-in 220ms ease-out both; }
  @keyframes details-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr); grid-auto-columns: minmax(9px, 1fr); gap: 4px; }
  .heat-cell { aspect-ratio: 1; min-width: 8px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.025); transition: transform 120ms ease, filter 120ms ease; }
  .heat-cell:hover { transform: scale(1.35); filter: brightness(1.25); z-index: 2; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;
