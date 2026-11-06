import { Pressable, View } from "react-native";

import { toggleSwitchStyle } from "@/components/toggle-switch-style";

export function ToggleSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { track, knob } = toggleSwitchStyle(value);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={track}
    >
      <View style={knob} />
    </Pressable>
  );
}
