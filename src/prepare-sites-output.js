import { copyFile, mkdir } from "node:fs/promises";

const outputDirectory = new URL("../dist/.openai/", import.meta.url);

await mkdir(outputDirectory, { recursive: true });
await copyFile(
  new URL("../.openai/hosting.json", import.meta.url),
  new URL("hosting.json", outputDirectory),
);
