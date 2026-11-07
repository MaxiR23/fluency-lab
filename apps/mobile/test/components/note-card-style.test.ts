// apps/mobile/test/components/note-card-style.test.ts
//
// Tests for the style functions of the chat note card.
//
// Tested:
// - noteCardStyle gives the card, the icon tile, the preview and the saved line of note-in-chat.html from the tokens
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/note-card-style.test.ts
//
// SEE: apps/mobile/src/components/note-card-style.ts

import { describe, expect, it } from "@jest/globals";

import { noteCardStyle } from "@/components/note-card-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("noteCardStyle", () => {
  const style = noteCardStyle();

  it("draws the card sunken with a 12 padding, a 10 gap, a 14 radius and a thin border", () => {
    expect(style.card).toEqual({
      gap: spacing.cluster,
      padding: spacing.group,
      borderRadius: radius.note,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
  });

  it("draws the top row with a 10 gap and the texts with a 2 gap", () => {
    expect(style.top).toEqual({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.cluster,
    });
    expect(style.texts).toEqual({ flex: 1, gap: spacing.tight });
  });

  it("draws the icon tile 32 square with a 10 radius on the accent tag", () => {
    expect(style.tile).toEqual({
      width: size.noteIcon,
      height: size.noteIcon,
      borderRadius: radius.noteIcon,
      backgroundColor: colors.accentTag,
      alignItems: "center",
      justifyContent: "center",
    });
  });

  it("spaces the preview lines by 6", () => {
    expect(style.preview).toEqual({ gap: spacing.stack });
  });

  it("draws the saved line as a row with a 6 gap that hugs its content", () => {
    expect(style.saved).toEqual({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.stack,
      alignSelf: "flex-start",
    });
  });
});
