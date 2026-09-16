## Invariants

- `profile.config.js` owns identity, machine sources, and deduplication priority; the first machine wins exact-ID duplicates.
- Raw JSONL MUST stay streamed and in memory. Never persist transcripts or user text in generated/public output.
- `data/profile.json`, `capsule/shared/*.ts`, `.lakebed/`, and `capsule/lakebed.json` are generated or local deployment state and MUST remain untracked.
- Publishing fails closed when any machine is unavailable. Use `PI_ALLOW_PARTIAL=1` only for an explicitly partial profile.
- `shared/profile.ts` and `shared/profile-overview.ts` are intentionally committed public snapshots for Sites remote builds. Write them only through aggregation's privacy guard.
- Both hosts belong on `master`; do not revive the historical Sites branch. The publish binding source and loading instructions are in `src/publish-binding.js` and README.
- User-facing changes include deploying and verifying both public hosts. Do not stop at Git push or seek separate deployment approval unless Igor asks to keep the change local.

## Change paths

- Collection and profile contracts: `src/server-aggregate.js`, `src/profile-lib.js`.
- Language classifiers: `src/analyzer.js` with regression cases in `test/analyzer.test.js`.
- Preserve overview-first, deferred-detail loading in both UIs.
- Lakebed cannot import outside `capsule/`; use the preparation script's generated copies, not a second collection path.
- Use `npm run check` as the umbrella gate before dual publication. The binding requires clean source and stages only its two generated public snapshots.
