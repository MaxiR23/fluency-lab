import type { HapticsPort } from "@/haptics/haptics-port";
import { describeAuthCause } from "@/utils/auth-error";

export function createExpoHaptics<S, N>(deps: {
  impactAsync(style: S): Promise<void>;
  selectionAsync(): Promise<void>;
  notificationAsync(type: N): Promise<void>;
  light: S;
  success: N;
  error: N;
}): HapticsPort {
  return {
    async play(kind) {
      try {
        if (kind === "tab") await deps.selectionAsync();
        else if (kind === "right") await deps.notificationAsync(deps.success);
        else if (kind === "miss") await deps.notificationAsync(deps.error);
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
