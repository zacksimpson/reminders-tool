import Constants from "expo-constants";
import { getDocumentAsync } from "expo-document-picker";
import {
  cacheDirectory,
  EncodingType,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system";
import { shareAsync } from "expo-sharing";
import type { ReminderList, Settings, Task } from "@/contexts/RemindersContext";

const BACKUP_VERSION = 1;

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

export async function exportBackup(
  lists: ReminderList[],
  tasks: Task[],
  settings: Settings
): Promise<void> {
  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    lists,
    tasks,
    settings,
  };

  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `reminders-backup-${date}.json`;
  const fileUri = `${cacheDirectory}${filename}`;

  await writeAsStringAsync(fileUri, json, {
    encoding: EncodingType.UTF8,
  });

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

  const file = result.assets[0];
  const json = await readAsStringAsync(file.uri, {
    encoding: EncodingType.UTF8,
  });

  const raw = JSON.parse(json) as BackupFile;

  if (
    typeof raw.version !== "number" ||
    !Array.isArray(raw.lists) ||
    !Array.isArray(raw.tasks)
  ) {
    throw new Error("Invalid backup file.");
  }

  const migrated = migrate(raw);

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
