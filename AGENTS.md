## Invariants

- `profile.config.js` owns identity, machine sources, and deduplication priority; the first machine wins exact-ID duplicates.
- Raw JSONL MUST stay streamed and in memory. Never persist transcripts or user text in generated/public output.
- `data/profile.json`, `capsule/shared/*.ts`, `.lakebed/`, and `capsule/lakebed.json` are generated or local deployment state and MUST remain untracked.
- Publishing fails closed when any machine is unavailable. Use `PI_ALLOW_PARTIAL=1` only for an explicitly partial profile.

## Change paths

- Collection and profile contracts: `src/server-aggregate.js`, `src/profile-lib.js`.
- Language classifiers: `src/analyzer.js` with regression cases in `test/analyzer.test.js`.
- Lakebed UI: `capsule/client/index.tsx`; preserve the overview-first, deferred-detail loading boundary.
- A fresh checkout MUST run `npm run aggregate` before Lakebed build, preview, or deploy.
- Run `npm test` after parser/classifier changes and `npm run build` after aggregation or UI changes.
