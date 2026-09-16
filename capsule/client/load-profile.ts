import type { Profile } from "../shared/profile-types";

export async function loadProfile(signal: AbortSignal, request = fetch): Promise<Profile> {
  const response = await request("./profile.json", { signal });
  if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
  const profile = await response.json();
  if (!profile?.profile || !profile.totals || !Array.isArray(profile.models) ||
      !Array.isArray(profile.machines) || !Array.isArray(profile.tools) ||
      !Array.isArray(profile.projects) || !Array.isArray(profile.recentSessions) ||
      !profile.language || !profile.languageSummary) {
    throw new Error("Invalid profile response");
  }
  return profile;
}
