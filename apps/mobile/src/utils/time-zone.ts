import { getCalendars } from "expo-localization";

type CalendarZone = { timeZone: string | null };

// INFO: expo-localization getCalendars() is the documented source of the device's IANA zone and
// ships in Expo Go. The Hermes Intl zone is undocumented and reported to return UTC, so it is
// only the second choice. When neither gives an IANA name, UTC keeps the week readable instead
// of failing Home.
const IANA_ZONE = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;

function usable(zone: string | null | undefined): zone is string {
  return zone !== null && zone !== undefined && IANA_ZONE.test(zone);
}

export function deviceTimeZone(
  readCalendars: () => readonly CalendarZone[] = getCalendars,
  readIntl: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const fromCalendar = readCalendars().at(0)?.timeZone;
  if (usable(fromCalendar)) return fromCalendar;
  const fromIntl = readIntl();
  return usable(fromIntl) ? fromIntl : "UTC";
}
