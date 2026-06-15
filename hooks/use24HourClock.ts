import { getCalendars } from "expo-localization";

const uses24HourClock = getCalendars()[0]?.uses24hourClock ?? false;

export function use24HourClock(): boolean {
  return uses24HourClock;
}
