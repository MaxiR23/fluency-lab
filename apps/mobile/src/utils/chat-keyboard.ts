import { spacing } from "@/constants/theme";

export type ChatKeyboardLayout = {
  composerBottom: number;
  stickyOffset: number;
  listOffset: number;
};

// INFO: the sticky view moves the footer up by the keyboard height minus stickyOffset, which
// leaves the input composerKeyboard above the keyboard. The list lifts its content by the
// keyboard height minus listOffset, 6 less than the footer: that turns the closed gap (list
// padding 20 + composer top 12) into the design's open gap (16 + 10).
export function chatKeyboardLayout(bottomInset: number): ChatKeyboardLayout {
  const composerBottom = Math.max(bottomInset, spacing.composerBottom);
  const stickyOffset = composerBottom - spacing.composerKeyboard;
  const listOffset =
    stickyOffset + (spacing.screenSide + spacing.group) - (spacing.md + spacing.cluster);
  return { composerBottom, stickyOffset, listOffset };
}
