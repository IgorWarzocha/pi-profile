import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

// Lakebed's source store cannot resolve imports outside the capsule.
const destination = new URL("../capsule/shared/", import.meta.url);
await mkdir(destination, { recursive: true });
await rm(new URL("default-profile.ts", destination), { force: true });
for (const file of ["profile.ts", "profile-overview.ts", "profile-types.ts"]) {
  await copyFile(new URL(`../shared/${file}`, import.meta.url), new URL(file, destination));
}
// Lakebed validates shared/ as server code, so this browser-only copy lives in client/.
for (const file of ["model-split.tsx", "codex-usage.tsx"]) {
  const source = await readFile(new URL(`../shared/${file}`, import.meta.url), "utf8");
  await writeFile(new URL(`../capsule/client/${file}`, import.meta.url), source
    .replace('from "react"', 'from "preact/hooks"')
    .replace('from "./profile-types"', 'from "../shared/profile-types"'));
}
