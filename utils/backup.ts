import Constants from "expo-constants";
import { getDocumentAsync } from "expo-document-picker";
import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { shareAsync } from "expo-sharing";
import type { ReminderList, Settings, Task } from "@/contexts/RemindersContext";

const BACKUP_VERSION = 1;
const AUTO_BACKUP_FILENAME = "reminders-auto-backup.json";

interface BackupFile {
  appVersion: string;
  exportedAt: string;
  lists: ReminderList[];
  settings: Settings;
  tasks: Task[];
  version: number;
}

export interface RestoredData {
  lists: ReminderList[];
  settings: Settings;
  tasks: Task[];
}

export interface AutoBackupInfo {
  exists: boolean;
  savedAt: string | null;
}

function makeBackupFile(
  lists: ReminderList[],
  tasks: Task[],
  settings: Settings
): BackupFile {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    lists,
    tasks,
    settings,
  };
}

function parseBackupFile(json: string): BackupFile {
  const raw = JSON.parse(json) as BackupFile;
  if (
    typeof raw.version !== "number" ||
    !Array.isArray(raw.lists) ||
    !Array.isArray(raw.tasks)
  ) {
    throw new Error("Invalid backup file.");
  }
  return migrate(raw);
}

export async function exportBackup(
  lists: ReminderList[],
  tasks: Task[],
  settings: Settings
): Promise<void> {
  const json = JSON.stringify(makeBackupFile(lists, tasks, settings), null, 2);
  const fileUri = `${cacheDirectory}reminders-backup.json`;
  await writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 });
  await shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Save Reminders backup",
  });
}

export async function importBackup(): Promise<RestoredData | null> {
  const result = await getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return null;
  }
  const json = await readAsStringAsync(result.assets[0].uri, {
    encoding: EncodingType.UTF8,
  });
  const migrated = parseBackupFile(json);
  return {
    lists: migrated.lists,
    tasks: migrated.tasks,
    settings: migrated.settings,
  };
}

export async function autoBackup(
  lists: ReminderList[],
  tasks: Task[],
  settings: Settings
): Promise<void> {
  const json = JSON.stringify(makeBackupFile(lists, tasks, settings), null, 2);
  await writeAsStringAsync(
    `${documentDirectory}${AUTO_BACKUP_FILENAME}`,
    json,
    {
      encoding: EncodingType.UTF8,
    }
  );
}

export async function getAutoBackupInfo(): Promise<AutoBackupInfo> {
  const info = await getInfoAsync(
    `${documentDirectory}${AUTO_BACKUP_FILENAME}`
  );
  if (!info.exists) {
    return { exists: false, savedAt: null };
  }
  try {
    const json = await readAsStringAsync(
      `${documentDirectory}${AUTO_BACKUP_FILENAME}`,
      { encoding: EncodingType.UTF8 }
    );
    const raw = JSON.parse(json) as BackupFile;
    return { exists: true, savedAt: raw.exportedAt ?? null };
  } catch {
    return { exists: true, savedAt: null };
  }
}

export async function importAutoBackup(): Promise<RestoredData | null> {
  const info = await getInfoAsync(
    `${documentDirectory}${AUTO_BACKUP_FILENAME}`
  );
  if (!info.exists) {
    return null;
  }
  const json = await readAsStringAsync(
    `${documentDirectory}${AUTO_BACKUP_FILENAME}`,
    { encoding: EncodingType.UTF8 }
  );
  const migrated = parseBackupFile(json);
  return {
    lists: migrated.lists,
    tasks: migrated.tasks,
    settings: migrated.settings,
  };
}

function migrate(backup: BackupFile): BackupFile {
  // Version 1 is the baseline — no migrations needed yet.
  // For future breaking changes add:
  //   if (backup.version < 2) { /* transform */ backup.version = 2; }
  return backup;
}
