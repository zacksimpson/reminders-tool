import { useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { setNotificationScheduler, useReminders } from "@/contexts/RemindersContext";

/**
 * Bridges NotificationsContext into RemindersContext so task operations
 * auto-schedule/cancel notifications without circular dependencies.
 */
export function NotificationsBridge() {
  const { scheduleForTask, cancelForTask, rescheduleAll, refreshBundles } = useNotifications();
  const { tasks, lists } = useReminders();

  useEffect(() => {
    setNotificationScheduler({ scheduleForTask, cancelForTask, rescheduleAll, refreshBundles });
    return () => setNotificationScheduler(null);
  }, [scheduleForTask, cancelForTask, rescheduleAll, refreshBundles]);

  // Reschedule all when app loads
  useEffect(() => {
    rescheduleAll(tasks, lists);
  }, []); // intentionally run once on mount

  return null;
}
