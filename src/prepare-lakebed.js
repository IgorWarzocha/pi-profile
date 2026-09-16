import { copyFile, mkdir, rm } from "node:fs/promises";

// Lakebed's source store cannot resolve imports outside the capsule.
const destination = new URL("../capsule/shared/", import.meta.url);
await mkdir(destination, { recursive: true });
await rm(new URL("default-profile.ts", destination), { force: true });
for (const file of ["profile.ts", "profile-overview.ts", "profile-types.ts"]) {
  await copyFile(new URL(`../shared/${file}`, import.meta.url), new URL(file, destination));
}
