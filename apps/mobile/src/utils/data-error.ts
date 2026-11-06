import type { DataFailure } from "@/data/data-port";

export function toDataFailure(status: number): DataFailure {
  switch (status) {
    case 400:
      return "invalid_input";
    case 401:
      return "unauthorized";
    case 404:
      return "not_found";
    default:
      return "unavailable";
  }
}
