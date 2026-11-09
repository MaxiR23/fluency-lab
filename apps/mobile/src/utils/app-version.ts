import Constants from "expo-constants";

type ConfigVersion = { version?: string } | null;

// INFO: like time-zone.ts, the device read is injectable so a test needs no native module.
// The version comes from the app config (app.config.ts), the one place that holds it.
export function appVersion(readConfig: () => ConfigVersion = () => Constants.expoConfig): string {
  const version = readConfig()?.version;
  return version === undefined || version === "" ? "Unknown" : version;
}
