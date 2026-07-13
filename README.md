# Pi Profile

A personal activity profile built from [Pi](https://github.com/badlogic/pi-mono) session logs and hosted with [ChatGPT Sites](https://developers.openai.com/codex/sites).

It combines sessions from several machines, removes synced duplicates, and shows token activity, cache use, cost, streaks, projects, models, tools, and language patterns. Collection happens locally; the deployed Site contains only compact generated snapshots.

## The setup this was built for

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

- Node.js 22.12 or newer
- Pi session logs
- SSH key access for remote machines
- ChatGPT Sites access for hosting

## Set up

```bash
git clone https://github.com/IgorWarzocha/pi-profile.git
cd pi-profile
npm install
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

Test remote access before generating a profile:

```bash
ssh desktop 'find ~/.pi/agent/sessions -name "*.jsonl" | head'
ssh laptop 'find ~/.pi/agent/sessions -name "*.jsonl" | head'
```

## Generate and preview

```bash
npm run aggregate
npm run check
npm run dev
```

Aggregation:

1. streams Pi JSONL from every configured machine;
2. parses it in memory on the collector machine;
3. deduplicates exact session IDs in configured machine order;
4. writes the full normalized result to ignored `data/profile.json`;
5. writes compact, deployable snapshots to tracked `app/generated/` files.

The Site build never connects to your machines. It builds entirely from the committed snapshots.

## Save and deploy with ChatGPT Sites

After refreshing the profile:

1. review changes under `app/generated/`;
2. run `npm run check`;
3. commit the source and snapshots;
4. save a reviewable Sites version;
5. deploy that saved version only after reviewing it.

`.openai/hosting.json` links the repository to its Site. Sites assigns `project_id` when the hosted project is created; do not invent or copy one from another Site. Saving and deploying are separate operations, and every deployment URL is production.

## Machine configurations

Machine order is deduplication priority. When the same session exists on several machines, the first configured copy wins. If one machine cannot be read, aggregation stops rather than replacing lifetime totals with a partial profile. Set `PI_ALLOW_PARTIAL=1` only when a partial snapshot is deliberate.

One machine:

```js
machines: [
  { name: "desktop", host: null, sessionsDir: "~/.pi/agent/sessions" },
]
```

Remote collector:

```js
machines: [
  { name: "server", host: null, sessionsDir: "~/.pi/agent/sessions" },
  { name: "workstation", host: "igor@192.168.1.20", sessionsDir: "~/.pi/agent/sessions" },
]
```

## What is extracted

- Sessions, active days, streaks, duration, and estimated active time
- Input, output, cache, reasoning, and total tokens
- Provider-reported cost
- Models and reasoning levels
- Tool calls, results, failures, and compactions
- Projects derived from working-directory names
- Courtesy, collaboration, correction, urgency, and profanity patterns in user messages

Pi Profile does not invent acceptance rates, lines changed, commits, or outcomes that Pi sessions do not reliably provide.

## Privacy

Remote JSONL is streamed over SSH and is not mirrored to disk. User text is inspected in memory for aggregate language counts and then discarded.

The committed Site snapshots do not contain raw transcripts, full working-directory paths, session UUIDs, or session titles. The ignored `data/profile.json` contains normalized session metadata for local debugging and future analysis.

Project basenames and aggregate activity are public in the deployed profile. Remove or rename projects before committing a snapshot if those names are sensitive.

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
npm run typecheck # application typecheck
npm run build     # static vinext production build
npm run dev       # local vinext development server
```

The Site is in `app/`. Collection and aggregation live in `src/server-aggregate.js` and `src/profile-lib.js`.
