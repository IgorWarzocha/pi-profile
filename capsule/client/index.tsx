import { useQuery } from "lakebed/client";

type Snapshot = { summary: any; sessions: any[]; machines: any[]; generatedAt: string };

const card = (label: string, value: string) => <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="text-sm text-white/50">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>;

export function App() {
  const data = useQuery<Snapshot>("profile");
  const s = data ?? { summary: {}, sessions: [], machines: [], generatedAt: "" };
  const m = s.summary ?? {};
  const t = m.tokens ?? {};
  return <main className="min-h-screen bg-[#111] px-6 py-10 text-white md:px-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-10"><div className="text-sm uppercase tracking-[.25em] text-sky-300">Pi profile</div><h1 className="mt-2 text-4xl font-semibold tracking-tight">Howaclawa</h1><p className="mt-2 text-white/50">Aggregated Pi activity · updated {s.generatedAt || "never"}</p></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card("Sessions", String(m.sessionCount ?? 0))}{card("Lifetime tokens", format(t.total))}{card("Cache hit rate", `${((m.cacheHitRate ?? 0) * 100).toFixed(1)}%`)}{card("Estimated cost", `$${(m.cost ?? 0).toFixed(2)}`)}
      </section>
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Activity"><div className="grid grid-cols-7 gap-1">{Object.entries(m.sessionsByDay ?? {}).map(([day, count]) => <div title={`${day}: ${count}`} className="h-5 rounded-sm bg-sky-400/60" />)}</div></Panel>
        <Panel title="Machines"><div className="space-y-3">{s.machines.map((x: any) => <div className="flex justify-between border-b border-white/10 pb-2" key={x.machine}><span>{x.machine}</span><span className={x.ok ? "text-emerald-300" : "text-red-300"}>{x.ok ? `${x.sessions?.length ?? 0} sessions` : "offline"}</span></div>)}</div></Panel>
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Language signals"><pre className="overflow-auto text-sm text-white/70">{JSON.stringify(m.language ?? {}, null, 2)}</pre></Panel><Panel title="Models and projects"><pre className="overflow-auto text-sm text-white/70">{JSON.stringify({ models: m.models, projects: m.projects }, null, 2)}</pre></Panel></section>
    </div>
  </main>;
}
function Panel({ title, children }: { title: string; children: any }) { return <div className="rounded-2xl border border-white/10 bg-white/[.02] p-5"><h2 className="mb-5 font-medium">{title}</h2>{children}</div>; }
function format(n: number) { return n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString(); }
