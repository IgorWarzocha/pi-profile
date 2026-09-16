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
