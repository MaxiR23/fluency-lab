import { IconButton } from "@/components/icon-button";

export function BackButton({
  onPress,
  label = "Back to Home",
}: {
  onPress: () => void;
  label?: string;
}) {
  return <IconButton icon="back" label={label} onPress={onPress} />;
}
