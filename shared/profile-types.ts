export type NumberMap = Readonly<Record<string, number>>;

export type ModelUsage = { modelId: string; tokens: number; messages: number };

export type DailyMetric = {
  sessions: number;
  tokens: number;
  outputTokens: number;
  toolCalls: number;
  messages: number;
  cost: number;
  courtesy: number;
  collaboration: number;
  friction: number;
};

export type Profile = {
  schemaVersion: number;
  codexUsage: ReadonlyArray<CodexUsageSource>;
  generatedAt: string;
  profile: {
    name: string;
    handle: string;
    avatarUrl: string;
    links: { x: string; github: string; website: string; linkedin: string };
  };
  headline: {
    lifetimeTokens: number;
    peakTokens: number;
    peakDay?: string;
    longestSessionMs: number;
    currentStreak: number;
    longestStreak: number;
  };
  totals: Readonly<Record<string, number>>;
  daily: Readonly<Record<string, DailyMetric>>;
  machines: ReadonlyArray<{
    machine: string;
    ok: boolean;
    sourceSessions: number;
    selectedSessions: number;
    malformedLines: number;
    error?: string;
  }>;
  models: ReadonlyArray<{
    modelId: string;
    provider?: string;
    sessions: number;
    messages: number;
    tokens: number;
    outputTokens: number;
    cost: number;
    toolCalls: number;
  }>;
  projects: ReadonlyArray<{
    name: string;
    sessions: number;
    tokens: number;
    toolCalls: number;
    messages: number;
    activeDurationMs: number;
    lastActive: string;
    machines: ReadonlyArray<string>;
    models: ReadonlyArray<ModelUsage>;
  }>;
  tools: ReadonlyArray<{
    name: string;
    calls: number;
    results: number;
    errors: number;
    sessions: number;
  }>;
  reasoningLevels: NumberMap;
  language: Readonly<Record<string, NumberMap>>;
  languageSummary: {
    courtesy: number;
    collaboration: number;
    friction: number;
    ragio: number;
    userMessages: number;
  };
  insights: Readonly<Record<string, string | number | undefined>>;
  recentSessions: ReadonlyArray<{
    project: string;
    machine: string;
    startedAt: string;
    endedAt: string;
    observedDurationMs: number;
    activeDurationMs: number;
    messages: number;
    toolCalls: number;
    tokens: number;
    latestModel?: string;
    models: ReadonlyArray<ModelUsage>;
    compactions: number;
  }>;
};

export type Overview = Pick<
  Profile,
  | "generatedAt"
  | "profile"
  | "headline"
  | "totals"
  | "daily"
  | "insights"
  | "models"
  | "projects"
  | "tools"
  | "reasoningLevels"
>;

export type CodexSpend = {
  usd: number; tokens: number; input: number; output: number; cacheRead: number; cacheWrite: number;
  requests: number; unpriced: number;
};
export type CodexSummary = {
  total: CodexSpend;
  models: ReadonlyArray<CodexSpend & { modelId: string }>;
};
export type CodexWindow = CodexSummary & {
  start: string; expectedReset: string; source: "manual" | "inferred" | "session-history";
  partial: boolean; approximate: boolean;
  observedQuota?: { at: string; usedPercent: number };
};
export type CodexUsageSource = {
  machine: string;
  accounts: ReadonlyArray<{
    since: string; lifetime: CodexSummary;
    current?: CodexWindow;
    closed: ReadonlyArray<CodexWindow & { end: string; reason: "scheduled" | "early" | "gap" | "backfill" }>;
    months: ReadonlyArray<CodexSummary & { month: string }>;
    spendPerDay?: number; vsPreviousWindowPercent?: number;
    diagnostics: {
      unassignedUsd: number; recordingGaps: number; missingWeeklyObservations: number;
      incompleteEntries: number; unattributedUsage: number; unreadablePaths: number;
      unverifiedHistory: boolean; nonstandard: boolean;
    };
  }>;
};
