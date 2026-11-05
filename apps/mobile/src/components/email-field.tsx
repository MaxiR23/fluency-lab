import type { ComponentProps } from "react";

import { TextField } from "@/components/text-field";

// INFO: the keyboard props are what stop iOS from capitalizing or correcting an address.
export function EmailField({
  value,
  onChangeText,
  error,
}: Pick<ComponentProps<typeof TextField>, "value" | "onChangeText" | "error">) {
  return (
    <TextField
      label="Email"
      placeholder="name@email.com"
      value={value}
      onChangeText={onChangeText}
      error={error}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      autoComplete="email"
      textContentType="emailAddress"
    />
  );
}
