import { lineHeight, size, spacing } from "@/constants/theme";

// INFO: the library measures bottomOffset from the caret, not the field. Below a body
// line centred in a control there is half the control minus half the line; adding the
// chat's input-to-keyboard gap leaves the whole field that gap above the keyboard.
export const formKeyboardOffset = (size.control - lineHeight.body) / 2 + spacing.composerKeyboard;
