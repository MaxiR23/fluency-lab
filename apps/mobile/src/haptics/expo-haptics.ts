import type { HapticsPort } from "@/haptics/haptics-port";
import { describeAuthCause } from "@/utils/auth-error";

export function createExpoHaptics<S>(deps: {
  impactAsync(style: S): Promise<void>;
  selectionAsync(): Promise<void>;
  light: S;
}): HapticsPort {
  return {
    async play(kind) {
      try {
        if (kind === "tab") await deps.selectionAsync();
        else await deps.impactAsync(deps.light);
        return { ok: true, value: null };
      } catch (thrown) {
        return {
          ok: false,
          failure: "not_played",
          cause: { ...describeAuthCause(thrown), detail: null },
        };
      }
    },
  };
}
