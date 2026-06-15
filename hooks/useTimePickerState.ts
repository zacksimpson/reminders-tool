import { useCallback, useState } from "react";
import {
  digitsToTime,
  formatTime,
  timeToDisplayParts,
} from "@/utils/dateTime";

export function useTimePickerState(initialTime?: string, use24Hour = false) {
  const initParts = initialTime
    ? timeToDisplayParts(initialTime, use24Hour)
    : { digits: "", ampm: "AM" as const };

  const [confirmedTime, setConfirmedTime] = useState<string | undefined>(
    initialTime
  );
  const [timeDigits, setTimeDigits] = useState(initParts.digits);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initParts.ampm);

  // Returns true if digits were valid and time was confirmed, false otherwise.
  const confirm = useCallback((): boolean => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) {
      return false;
    }
    setConfirmedTime(digitsToTime(timeDigits, ampm, use24Hour));
    return true;
  }, [timeDigits, ampm, use24Hour]);

  const clear = useCallback(() => {
    setConfirmedTime(undefined);
    setTimeDigits("");
    setAmPm("AM");
  }, []);

  // Call when the picker modal is dismissed without confirming — clears in-progress input if nothing was confirmed.
  const onPickerDismiss = useCallback(() => {
    if (!confirmedTime) {
      setTimeDigits("");
      setAmPm("AM");
    }
  }, [confirmedTime]);

  const appendDigit = useCallback((d: string) => {
    setTimeDigits((prev) => (prev.length < 4 ? prev + d : prev));
  }, []);

  const backspace = useCallback(() => {
    setTimeDigits((prev) => prev.slice(0, -1));
  }, []);

  return {
    ampm,
    appendDigit,
    backspace,
    clear,
    confirm,
    confirmedTime,
    displayTime: confirmedTime ? formatTime(confirmedTime, use24Hour) : null,
    onPickerDismiss,
    setAmPm,
    timeDigits,
  };
}
