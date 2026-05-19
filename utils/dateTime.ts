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

export function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
