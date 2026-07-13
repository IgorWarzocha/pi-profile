# Pi Profile

Local, multi-machine Pi activity profile. The server is authoritative: it collects its own sessions and optionally collects desktop/laptop sessions over SSH, then selects duplicates using `server > desktop > laptop`.

## Commands

```bash
npm run aggregate
PI_DESKTOP_HOST=desktop PI_LAPTOP_HOST=laptop npm run aggregate
```

The canonical snapshot is written to `data/scan.json`. Nothing is written outside this repository by this project.

For remote machines, install this repository there and expose the collector:

```bash
node src/remote-collector.js --json
```

The Lakebed capsule in `capsule/` is the display/import layer. It receives the normalized snapshot; it does not SSH, read Pi files, or deduplicate sessions.
