const PUBLIC_PROFILE_KEYS = new Set([
  "schemaVersion",
  "generatedAt",
  "profile",
  "headline",
  "totals",
  "daily",
  "machines",
  "models",
  "projects",
  "tools",
  "reasoningLevels",
  "language",
  "languageSummary",
  "insights",
  "recentSessions",
]);

const FORBIDDEN_KEYS = new Set([
  "accessToken",
  "apiKey",
  "authorization",
  "body",
  "content",
  "cwd",
  "id",
  "password",
  "path",
  "prompt",
  "refreshToken",
  "response",
  "secret",
  "sessionId",
  "sessionTitle",
  "text",
  "transcript",
  "uuid",
  "workingDirectory",
]);

const MAX_PUBLIC_PROFILE_BYTES = 512 * 1024;

export function assertPublicProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Public profile must be an object");
  }
  const keys = Object.keys(profile);
  const unexpected = keys.filter((key) => !PUBLIC_PROFILE_KEYS.has(key));
  const missing = [...PUBLIC_PROFILE_KEYS].filter((key) => !(key in profile));
  if (unexpected.length || missing.length) {
    throw new Error(
      `Public profile schema mismatch; unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}`,
    );
  }
  assertNoForbiddenKeys(profile);
  for (const project of [...(profile.projects ?? []), ...(profile.recentSessions ?? [])]) {
    if (typeof project?.name === "string" && /[\\/]/.test(project.name)) {
      throw new Error(`Public project name looks like a path: ${project.name}`);
    }
    if (typeof project?.project === "string" && /[\\/]/.test(project.project)) {
      throw new Error(`Public project name looks like a path: ${project.project}`);
    }
  }
  const bytes = Buffer.byteLength(JSON.stringify(profile));
  if (bytes > MAX_PUBLIC_PROFILE_BYTES) {
    throw new Error(`Public profile is ${bytes} bytes; limit is ${MAX_PUBLIC_PROFILE_BYTES}`);
  }
  return profile;
}

function assertNoForbiddenKeys(value, path = "profile") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Public profile contains forbidden field ${path}.${key}`);
    assertNoForbiddenKeys(child, `${path}.${key}`);
  }
}
