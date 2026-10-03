# Pi Profile

A personal activity profile built from [Pi](https://github.com/badlogic/pi-mono) session logs and published to [Lakebed](https://lakebed.dev) and [ChatGPT Sites](https://developers.openai.com/codex/sites).

It combines sessions from several machines, removes synced duplicates, and shows token activity, cache use, cost, streaks, projects, models, tools, and language patterns.

## The specific setup this was built for

The collector runs on one always-on Linux server. That server reads its own Pi sessions directly and reads two other machines over SSH:

```text
server ──────────────── local Pi sessions
   ├── ssh desktop ─── desktop Pi sessions
   └── ssh laptop  ─── laptop Pi sessions
```

Only the server needs this repository. The other machines need:

- Pi sessions under `~/.pi/agent/sessions`
- SSH access from the server without an interactive password prompt
- `find` and `cat`

You can use one machine, two machines, different hostnames, or different session paths. Configure them in `profile.config.js`.

## Requirements

- Node.js 22.18 or newer
- Pi session logs
- SSH key access for remote machines
- A Lakebed account for a permanent deployment; anonymous previews also work
- ChatGPT Sites access through Pi's authenticated Sites tools

## Set up

```bash
git clone https://github.com/IgorWarzocha/pi-profile.git
cd pi-profile
npm ci
```

Edit `profile.config.js` with your identity and machines:

```js
export default {
  profile: {
    name: "Your name",
    handle: "@yourhandle",
    avatarUrl: "https://example.com/avatar.jpg",
    links: {
      x: "https://x.com/yourhandle",
      github: "https://github.com/yourhandle",
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/yourhandle",
    },
  },
  machines: [
    { name: "server", host: null, sessionsDir: "~/.pi/agent/sessions" },
    { name: "desktop", host: "desktop", sessionsDir: "~/.pi/agent/sessions" },
    { name: "laptop", host: "laptop", sessionsDir: "~/.pi/agent/sessions" },
  ],
};
```

`host: null` means the collector's current machine. Any other value is passed to `ssh`, so it may be an SSH alias, hostname, user-qualified host, or IP address.

Test remote access before publishing:

```bash
ssh desktop 'find ~/.pi/agent/sessions -name "*.jsonl" | head'
ssh laptop  'find ~/.pi/agent/sessions -name "*.jsonl" | head'
```

Build and inspect the profile locally before publishing:

```bash
npm run aggregate
npm run check
npm run preview
```

Open the local URL printed by Lakebed, or use `npm run dev:sites` for the Sites app. Both apps live on `master` and consume the same privacy-checked snapshot in `shared/`. A fresh checkout can build that committed snapshot without contacting the source machines. Run aggregation to refresh it.

## Publish

The Pi notebook binding is defined in `src/publish-binding.js`. Load it from this repository:

```js
async function publishPiProfile(options = {}) {
  const { createPiProfileBinding } = await import("file:///home/igorw/Work/pi-profile/src/publish-binding.js");
  return createPiProfileBinding(tools, "/home/igorw/Work/pi-profile").publish(options);
}
text(await publishPiProfile());
```

Adjust the absolute path for another checkout. Publication updates both **public** sites. Run it only when that publication is intended.

The binding requires clean `master`, locks out overlapping runs, collects all machines once, and runs `npm run check`. It commits only the two public snapshots and pushes `master`. It then updates Lakebed and saves and deploys a Sites version, returning each result independently. A failure on one host does not roll back the other. Inspect the returned Sites deployment status; a pending deployment is not a completed publication.

Lakebed uses the local ignored `capsule/lakebed.json`. Sites uses the committed `.openai/hosting.json`. Neither binding contains credentials. For your own profile, bind your own deployments before publishing rather than reusing these IDs.

To retry publication of the committed snapshot without recollecting, use `publishPiProfile({ refresh: false })`. This still runs the full validation gate.

For Lakebed alone, `npm run publish:lakebed` collects and publishes. `npm run deploy` publishes the existing shared snapshot without recollecting.

An unclaimed Lakebed deployment eventually expires. Attach it to your Lakebed account to keep it and allow later publishes to update the same app:

```bash
npm run claim
```

## Automatic refreshes

The repository does not install a scheduler. The dual-site binding runs inside Pi because Sites authentication belongs to Pi's tools. It rejects dirty source trees rather than committing unrelated work.

## Machine configurations

### One machine

```js
machines: [
  { name: "desktop", host: null, sessionsDir: "~/.pi/agent/sessions" },
]
```

### Remote server collecting a workstation

```js
machines: [
  { name: "server", host: null, sessionsDir: "~/.pi/agent/sessions" },
  { name: "workstation", host: "igor@192.168.1.20", sessionsDir: "~/.pi/agent/sessions" },
]
```

### Different session location

```js
machines: [
  { name: "archive", host: "archive-box", sessionsDir: "/srv/pi/sessions" },
]
```

Machine order is significant. When the same session exists on several machines, the first configured copy wins. If one machine cannot be read, publishing stops rather than replacing lifetime totals with a partial profile. Set `PI_ALLOW_PARTIAL=1` only when a partial deployment is deliberate.

## Keeping history after deleting sessions

Each aggregation retains previously collected session statistics in the local, ignored `data/profile.json`. Live sessions update their saved statistics by session ID without being counted twice. A stale copy with fewer recorded events cannot replace a fuller saved summary. Sessions no longer found on any machine keep contributing to lifetime totals, daily activity, projects, models, and tools.

Before deleting old session logs, run `npm run aggregate` successfully so their statistics are saved. Keep `data/profile.json` on the collector server. It contains session IDs and statistics, not conversation text or full working-directory paths. Existing local snapshots are adopted automatically on the first run. Deleted logs cannot be reconstructed from these summaries.

This file is now persistent history, not a disposable build artifact. A fresh checkout or removal of `data/profile.json` loses retained history that is no longer present in source logs. Public snapshots cannot restore it. An unreadable or unsupported history file stops aggregation rather than silently replacing it.

Concurrent aggregations are blocked by `data/profile.json.lock`. If a run is killed and leaves this directory behind, first verify that no `node src/server-aggregate.js` process is running, then remove the empty lock directory with `rmdir data/profile.json.lock` and retry.

## What is extracted

- Sessions, active days, streaks, duration, and estimated active time
- Input, output, cache, reasoning, and total tokens
- Provider-reported cost
- PCC's recorded Codex spend, model tokens, reset windows and monthly totals
- Models and reasoning levels
- Tool calls, results, failures, and compactions
- Projects derived from working-directory names
- Courtesy, collaboration, correction, urgency, and profanity patterns in user messages

Pi Profile does not attempt to invent acceptance rates, lines changed, commits, or outcomes that Pi sessions do not reliably provide.

### Codex usage ledgers

For machines running Pi Codex Conversion, set `codexUsageFile: "~/.pi/agent/codex-usage.json"` alongside `sessionsDir` in `profile.config.js`. Aggregation reads PCC's existing version-1 ledger locally or over SSH. It never contacts OpenAI, reads credentials, redeems resets or modifies PCC files. A missing ledger means usage is untracked. An unreadable or invalid ledger stops publication.

The Codex usage section shows each machine and account separately. PCC can import the same session history on multiple machines, so those ledgers cannot safely be summed. Their amounts also overlap the profile's session costs and are not added to lifetime totals. Accounts are numbered only within each machine. Account hashes are never published.

Costs are API equivalents, not subscription charges. PCC records local Codex responses, native compaction and generated cache keepalive, but not every app or device using the account. Quota percentages are timestamped observations, not live readings. Reset boundaries retain PCC's manual, inferred or imported provenance. Approximate windows, incomplete history, missing prices and recording gaps remain visible. Only the latest eight completed windows and twelve calendar months are published.

Banked reset credits and five-hour limits are not persisted in this ledger and are not shown. The profile consumes only JSON PCC already generates.

## Privacy

Remote JSONL is streamed over SSH and is not mirrored to disk. User text is inspected in memory for aggregate language counts and then discarded.

Both hosts and Git receive only the compact public snapshots, not raw transcripts, full working-directory paths, session UUIDs, or session titles. `src/public-profile.js` rejects private fields and unbounded snapshots before writing them. The local ignored `data/profile.json` retains normalized session statistics so deleting source logs does not erase profile history.

Project basenames and aggregate activity are public in Git and both deployed profiles. Remove or rename projects before committing if those names are sensitive.

## Metrics

**Cache read** is calculated as:

```text
cacheRead / (input + cacheRead)
```

**Active time** sums gaps of up to 30 minutes between events. It is an estimate, not a stopwatch.

**Rage factor** is profanity matches divided by all courtesy matches. Language counts are phrase heuristics rather than sentiment analysis.

Daily activity uses event timestamps in UTC. Session totals remain exact even when a session spans several days.

Model usage is attributed to each assistant message. Recent sessions show the latest responding model, while projects show the model with the most reported tokens. Hover over either model name, focus it with the keyboard, or tap it to see the full token split. A `+N` suffix counts the other models used. Selecting a model without receiving a response does not count as usage.

## Development

```bash
npm run aggregate # refresh local metadata and both shared public snapshots
npm run check     # tests, Sites types, and both production builds
npm run preview   # Lakebed development server
npm run dev:sites # Sites development server
npm run deploy    # deploy the existing snapshot to Lakebed
```

The Lakebed interface is in `capsule/client/index.tsx`; the Sites interface is in `app/page.tsx`. Both preserve overview-first loading. Lakebed fetches deferred details from `/profile.json` over HTTP, with a timeout and retry state. Sites loads a deferred snapshot chunk. Lakebed's build copies `shared/` into its ignored capsule-local source boundary.

Collection and aggregation live in `src/server-aggregate.js` and `src/profile-lib.js`.
