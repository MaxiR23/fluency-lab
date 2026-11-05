import * as AppleAuthentication from "expo-apple-authentication";
import { StyleSheet } from "react-native";

import { radius, size } from "@/constants/theme";

// INFO: Apple requires its own native button. Its style must not set a background
// or a border radius, and without a width and a height it does not appear.
export function AppleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      testID="apple-button"
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.control}
      style={styles.button}
      onPress={() => {
        if (disabled !== true) onPress();
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: "stretch", height: size.control },
});
