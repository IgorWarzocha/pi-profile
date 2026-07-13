# Pi Profile

A personal activity profile built from [Pi](https://github.com/badlogic/pi-mono) session logs and displayed with [Lakebed](https://lakebed.dev).

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

- Node.js 20 or newer
- Pi session logs
- SSH key access for remote machines
- A Lakebed account for a permanent deployment; anonymous previews also work

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
npm test
npm run aggregate
npm run preview
```

Open the local URL printed by Lakebed. A fresh clone must run `npm run aggregate` before any Lakebed build, preview, or deploy because the profile snapshots are generated and intentionally absent from Git.

## Publish

```bash
npm run publish
```

That command:

1. Streams Pi JSONL from every configured machine.
2. Parses it in memory on the collector machine.
3. Deduplicates exact session IDs in the order listed in `profile.config.js`.
4. Writes the full normalized local result to `data/profile.json`.
5. Generates an instant overview and a deferred detail snapshot for Lakebed.
6. Deploys the capsule.

The generated data files are ignored by Git.

An anonymous Lakebed deployment expires after seven days. Run this from `capsule/` to attach it to your Lakebed account:

```bash
npm run claim
```

If you deploy with Lakebed's staging channel, keep that channel consistent for deploy and claim:

```bash
npm run publish:staging
npm run claim:staging
```

Staging addresses end in `.staging.lakebed.app`.

## Automatic refreshes

The repository deliberately does not install a scheduler. Run the publish command on a timer as the same Linux account that owns the SSH keys and Lakebed login:

```bash
cd /absolute/path/to/pi-profile && npm run publish
# or: npm run publish:staging
```

Cron and systemd timers both work. Choose the cadence you want and prevent overlapping runs; each publish scans every configured machine before updating Lakebed.

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

## What is extracted

- Sessions, active days, streaks, duration, and estimated active time
- Input, output, cache, reasoning, and total tokens
- Provider-reported cost
- Models and reasoning levels
- Tool calls, results, failures, and compactions
- Projects derived from working-directory names
- Courtesy, collaboration, correction, urgency, and profanity patterns in user messages

Pi Profile does not attempt to invent acceptance rates, lines changed, commits, or outcomes that Pi sessions do not reliably provide.

## Privacy

Remote JSONL is streamed over SSH and is not mirrored to disk. User text is inspected in memory for aggregate language counts and then discarded.

Lakebed receives the compact profile snapshot, not raw transcripts, full working-directory paths, session UUIDs, or session titles. The local ignored `data/profile.json` contains normalized session metadata for debugging and future analysis.

Project basenames and aggregate activity are public in the deployed profile. Remove or rename projects before publishing if those names are sensitive.

## Metrics

**Cache read** is calculated as:

```text
cacheRead / (input + cacheRead)
```

**Active time** sums gaps of up to 30 minutes between events. It is an estimate, not a stopwatch.

**Rage factor** is profanity matches divided by all courtesy matches. Language counts are phrase heuristics rather than sentiment analysis.

Daily activity uses event timestamps in UTC. Session totals remain exact even when a session spans several days.

## Development

```bash
npm test          # parser and analyzer tests
npm run aggregate # refresh local data and the capsule snapshot
npm run build     # verify the generated capsule
npm run preview   # inspect it locally
npm run deploy    # deploy the existing snapshot
```

The Lakebed interface is in `capsule/client/index.tsx`. Collection and aggregation live in `src/server-aggregate.js` and `src/profile-lib.js`.
