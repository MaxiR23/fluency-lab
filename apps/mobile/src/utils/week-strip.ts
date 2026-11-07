import { weekDates, type SessionWeek } from "@fluency-lab/shared";

export type DayCell = {
  date: string;
  letter: string;
  label: string;
  practiced: boolean;
  perfect: boolean;
  isToday: boolean;
  isFuture: boolean;
};

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function weekStrip(week: SessionWeek): { days: DayCell[]; countLabel: string } {
  const days = weekDates(week.weekStart).map((date, index): DayCell => {
    const name = DAY_NAMES[index];
    const practiced = week.days.includes(date);
    const perfect = practiced && week.perfectDays.includes(date);
    return {
      date,
      letter: name.charAt(0),
      label: `${name}, ${perfect ? "perfect practice" : practiced ? "practiced" : "not practiced"}`,
      practiced,
      perfect,
      isToday: date === week.today,
      // INFO: ISO dates compare as strings.
      isFuture: date > week.today,
    };
  });
  const count = days.filter((cell) => cell.practiced).length;
  const perfect = days.filter((cell) => cell.perfect).length;
  return {
    days,
    countLabel: perfect === 0 ? `${count} of 7 days` : `${count} of 7 days · ${perfect} perfect`,
  };
}
