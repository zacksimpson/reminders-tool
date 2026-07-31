/**
 * Sorts `items` by position in `orderIds` (a drag/reorder-written id array, e.g.
 * `Settings.listOrder` or `ReminderList.taskOrder`) when present and non-empty; items
 * whose id isn't in it are appended after, sorted by `fallback`, matches
 * reminders-web's `applyOrder()` so every client agrees on order given the same data.
 */
export function applyOrder<T>(
  items: T[],
  id: (item: T) => string,
  orderIds: string[] | null | undefined,
  fallback: (item: T) => number
): T[] {
  if (!orderIds || orderIds.length === 0) {
    return [...items].sort((a, b) => fallback(a) - fallback(b));
  }
  const rank = new Map(orderIds.map((orderId, index) => [orderId, index]));
  const known: T[] = [];
  const unknown: T[] = [];
  for (const item of items) {
    (rank.has(id(item)) ? known : unknown).push(item);
  }
  known.sort((a, b) => (rank.get(id(a)) ?? 0) - (rank.get(id(b)) ?? 0));
  unknown.sort((a, b) => fallback(a) - fallback(b));
  return [...known, ...unknown];
}

/** Move `itemId`'s position by `direction` (-1 or +1) within `sorted`, returning the
 *  reordered id array to persist, or null if the move is a no-op (already at an edge). */
export function reorderIds<T>(
  sorted: T[],
  id: (item: T) => string,
  itemId: string,
  direction: -1 | 1
): string[] | null {
  const idx = sorted.findIndex((item) => id(item) === itemId);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= sorted.length) {
    return null;
  }
  const ids = sorted.map(id);
  const [moved] = ids.splice(idx, 1);
  ids.splice(target, 0, moved);
  return ids;
}
