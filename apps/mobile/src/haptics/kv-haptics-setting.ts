import type { HapticsSettingPort } from "@/haptics/haptics-port";
import { describeAuthCause } from "@/utils/auth-error";
import { parseHapticsSetting } from "@/utils/haptics-setting";

export const HAPTICS_ITEM = "haptics";

export function createKvHapticsSetting(deps: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}): HapticsSettingPort {
  return {
    async read() {
      try {
        return { ok: true, value: parseHapticsSetting(await deps.getItem(HAPTICS_ITEM)) };
      } catch (thrown) {
        return {
          ok: false,
          failure: "not_read",
          cause: { ...describeAuthCause(thrown), detail: null },
        };
      }
    },
    async save(on) {
      try {
        await deps.setItem(HAPTICS_ITEM, on ? "on" : "off");
        return { ok: true, value: null };
      } catch (thrown) {
        return {
          ok: false,
          failure: "not_saved",
          cause: { ...describeAuthCause(thrown), detail: null },
        };
      }
    },
  };
}
