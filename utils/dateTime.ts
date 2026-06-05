const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a Date object as "YYYY-MM-DD" */
export function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parse "YYYY-MM-DD" into numeric parts */
export function parseDateStr(dateStr: string): {
  y: number;
  mo: number;
  d: number;
} {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return { y, mo, d };
}

export function getTodayStr(): string {
  return formatISODate(new Date());
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatISODate(d);
}

/** "HH:MM" 24h → "h:mm AM/PM" */
export function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = Number.parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

/** "YYYY-MM-DD" → "Jan 5" */
export function formatDate(dateStr: string): string {
  const [, mo, d] = dateStr.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${d}`;
}

/** "YYYY-MM-DD" → "Jan 5, 2024" */
export function formatDisplayDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

/** TimePicker digits + ampm → "h:mm AM/PM" */
export function formatDisplayTime(digits: string, ampm: "AM" | "PM"): string {
  const h =
    digits.length === 3
      ? Number.parseInt(digits[0], 10)
      : Number.parseInt(digits.slice(0, 2), 10);
  const m = digits.length === 3 ? digits.slice(1) : digits.slice(2, 4);
  return `${h}:${m} ${ampm}`;
}

/** TimePicker digits + ampm → "HH:MM" 24h for storage */
export function digitsToTime(digits: string, ampm: "AM" | "PM"): string {
  let h: number;
  let m: string;
  if (digits.length === 3) {
    h = Number.parseInt(digits[0], 10);
    m = digits.slice(1);
  } else {
    h = Number.parseInt(digits.slice(0, 2), 10);
    m = digits.slice(2, 4);
  }
  if (ampm === "PM" && h !== 12) {
    h += 12;
  }
  if (ampm === "AM" && h === 12) {
    h = 0;
  }
  return `${String(h).padStart(2, "0")}:${m}`;
}

/** Returns true if the task's date/time is in the past. */
export function isOverdue(task: { date?: string; time?: string }): boolean {
  if (!task.date) {
    return false;
  }
  const todayStr = getTodayStr();
  if (task.time) {
    const { y, mo, d } = parseDateStr(task.date);
    const [h, m] = task.time.split(":").map(Number);
    return new Date(y, mo - 1, d, h, m, 0) < new Date();
  }
  return task.date < todayStr;
}

/**
 * Sort comparator for tasks within the same date: timed tasks before untimed,
 * untimed tasks by their manual order field.
 */
export function compareTasksByDateTime(
  a: { time?: string; order: number },
  b: { time?: string; order: number }
): number {
  if (!(a.time || b.time)) {
    return a.order - b.order;
  }
  if (!a.time) {
    return -1;
  }
  if (!b.time) {
    return 1;
  }
  return a.time.localeCompare(b.time);
}

/** Sort comparator across dates, then by time within a date. */
export function compareTasksByDateThenTime(
  a: { date?: string; time?: string; order: number },
  b: { date?: string; time?: string; order: number }
): number {
  if (a.date !== b.date) {
    return (a.date ?? "") < (b.date ?? "") ? -1 : 1;
  }
  return compareTasksByDateTime(a, b);
}

/** "HH:MM" 24h → TimePicker { digits, ampm } */
export function timeToDisplayParts(time24: string): {
  digits: string;
  ampm: "AM" | "PM";
} {
  const [hStr, mStr] = time24.split(":");
  let h = Number.parseInt(hStr, 10);
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h > 12) {
    h -= 12;
  }
  if (h === 0) {
    h = 12;
  }
  return { digits: `${String(h).padStart(2, "0")}${mStr}`, ampm };
}
