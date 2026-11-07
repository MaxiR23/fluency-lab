import { getLocales } from "expo-localization";

type LocaleTag = { languageTag: string; languageCode: string | null };

// INFO: expo-localization getLocales() is the documented source of the device's
// languages, as getCalendars() is of its zone. null means the exercises that need
// a language (translate) are not asked: English or an unreadable language.
export function deviceLanguage(
  readLocales: () => readonly LocaleTag[] = getLocales,
): string | null {
  const first = readLocales().at(0);
  if (first === undefined || first.languageCode === null || first.languageCode === "en") {
    return null;
  }
  return first.languageTag;
}
