#!/usr/bin/env node
/**
 * import-to-apple-reminders.mjs
 *
 * Imports a reminders-tool JSON backup into Apple Reminders on macOS.
 * - List matching is case-insensitive; existing lists are reused, not duplicated.
 * - Deduplication: skips reminders already present by matching title + list +
 *   due date (title + list alone for undated tasks).
 * - Recurring tasks: pending instances import with a recurrence rule; completed
 *   instances import as plain one-off completed reminders.
 *
 * Usage (run on macOS):
 *   node scripts/import-to-apple-reminders.mjs path/to/reminders-backup.json
 *   bun run scripts/import-to-apple-reminders.mjs path/to/reminders-backup.json
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP_DATA = join(tmpdir(), 'rt-import-data.json');
const TMP_SCRIPT = join(tmpdir(), 'rt-import.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRRule({ interval, unit }) {
  const freq = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[unit];
  return `FREQ=${freq};INTERVAL=${interval}`;
}

// ── Parse & validate backup ───────────────────────────────────────────────────

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node scripts/import-to-apple-reminders.mjs <backup.json>');
  process.exit(1);
}

let backup;
try {
  backup = JSON.parse(readFileSync(backupPath, 'utf8'));
} catch (err) {
  console.error(`Could not read backup file: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(backup.lists) || !Array.isArray(backup.tasks)) {
  console.error('Invalid backup: missing lists or tasks arrays.');
  process.exit(1);
}

// ── Build work items ──────────────────────────────────────────────────────────

const listTitleById = Object.fromEntries(backup.lists.map((l) => [l.id, l.title]));

const workItems = {
  lists: backup.lists.map((l) => ({ id: l.id, title: l.title })),
  tasks: backup.tasks.map((t) => ({
    title: t.title,
    listTitle: listTitleById[t.listId] ?? 'Inbox',
    dueDate: t.date ? `${t.date}T${t.time ?? '00:00'}:00` : null,
    dueDateOnly: t.date ?? null,
    hasTime: !!t.time,
    completed: t.completed,
    completedAt: t.completedAt ?? null,
    // Completed instances of recurring tasks are historical — import as one-offs
    rrule: (!t.completed && t.recurrence) ? toRRule(t.recurrence) : null,
    subtasks: t.subtasks.map((s) => ({ title: s.title, completed: s.completed })),
  })),
};

writeFileSync(TMP_DATA, JSON.stringify(workItems), 'utf8');

// ── JXA automation script ─────────────────────────────────────────────────────

const jxa = `
ObjC.import('Foundation');

function readJSON(path) {
  const str = $.NSString.stringWithContentsOfFileEncodingError(
    path, $.NSUTF8StringEncoding, null
  );
  return JSON.parse(ObjC.unwrap(str));
}

function findListByName(app, name) {
  for (const list of app.lists()) {
    if (list.name() === name) return list;
  }
  return null;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isDuplicate(list, title, dueDateOnly) {
  for (const r of list.reminders()) {
    if (r.name() !== title) continue;
    if (!dueDateOnly) return true;
    const rDate = r.dueDate();
    if (rDate && sameDay(rDate, new Date(dueDateOnly))) return true;
  }
  return false;
}

function run() {
  const data = readJSON('${TMP_DATA}');
  const app = Application('Reminders');

  // ── 1. Build lowercase → actual-name map of existing lists ────────────────
  const existingLists = {};
  for (const list of app.lists()) {
    existingLists[list.name().toLowerCase()] = list.name();
  }

  // ── 2. Find or create each list (case-insensitive) ────────────────────────
  const listMap = {};
  for (const { title } of data.lists) {
    const key = title.toLowerCase();
    if (existingLists[key]) {
      listMap[key] = existingLists[key];
    } else {
      app.lists.push(app.List({ name: title }));
      listMap[key] = title;
      existingLists[key] = title;
    }
  }

  // ── 3. Import tasks ────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const task of data.tasks) {
    const targetListName = listMap[task.listTitle.toLowerCase()];
    if (!targetListName) { skipped++; continue; }

    const list = findListByName(app, targetListName);
    if (!list) { skipped++; continue; }

    if (isDuplicate(list, task.title, task.dueDateOnly)) { skipped++; continue; }

    const props = { name: task.title, completed: task.completed };

    if (task.dueDate) {
      const d = new Date(task.dueDate);
      props.dueDate = d;
      if (task.hasTime) props.remindMeDate = d;
    }

    if (task.completed && task.completedAt) {
      props.completionDate = new Date(task.completedAt);
    }

    if (task.rrule) {
      props.recurrence = task.rrule;
    }

    const reminder = app.Reminder(props);
    list.reminders.push(reminder);
    created++;

    for (const sub of task.subtasks) {
      try {
        reminder.reminders.push(app.Reminder({ name: sub.title, completed: sub.completed }));
      } catch (_) {}
    }
  }

  return JSON.stringify({ created, skipped });
}
`;

writeFileSync(TMP_SCRIPT, jxa, 'utf8');

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`Importing ${workItems.tasks.length} task(s) across ${workItems.lists.length} list(s)...`);

try {
  const result = execSync(`osascript -l JavaScript "${TMP_SCRIPT}"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  const { created, skipped } = JSON.parse(result);
  console.log(`Done.`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
} catch (err) {
  console.error('Import failed.');
  console.error(err.stderr || err.message);
  process.exit(1);
}
