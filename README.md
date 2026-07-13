# Pi Profile

A personal Pi activity profile across server, desktop, and laptop. One script runs on the server, streams each machine's Pi JSONL over SSH, computes privacy-safe metadata, deduplicates exact session IDs using `server > desktop > laptop`, and prepares a Lakebed display snapshot.

Raw transcripts are never saved by Pi Profile or sent to Lakebed. User text is scanned in memory for aggregate language signals and then discarded.

## Publish

```bash
npm run publish
```

This performs the whole path:

1. Read `~/.pi/agent/sessions` locally.
2. Read the same path from `desktop` and `laptop` through SSH streams.
3. Write the full normalized local profile to `data/profile.json`.
4. Write the compact display snapshot to `capsule/shared/default-profile.ts`.
5. Deploy the capsule to Lakebed.

Publishing aborts if any configured machine is unavailable, so a temporary SSH failure cannot replace lifetime totals with a partial profile. For deliberate recovery work only, `PI_ALLOW_PARTIAL=1` permits a partial snapshot.

Override SSH aliases when needed:

```bash
PI_DESKTOP_HOST=desktop PI_LAPTOP_HOST=laptop npm run publish
```

## What is measured

- Sessions, active days, streaks, observed duration, and estimated active time
- Input/output/cache/reasoning tokens and provider-reported cost
- Models, reasoning levels, embedded tool calls/results/errors, and compactions
- Projects derived from session working directories without publishing full paths
- Courtesy, collaboration, review, repair, correction, urgency, and profanity signals in user-authored prose

The cache metric is explicitly a **cache read share**: `cacheRead / (input + cacheRead)`. Language metrics are phrase-counting heuristics, not sentiment or personality judgments.
