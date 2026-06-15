import { MaterialIcons } from "@expo/vector-icons";
import type React from "react";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { OverdueAsterisk } from "@/components/OverdueAsterisk";
import { StyledText } from "@/components/StyledText";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { formatRecurrence, type Task } from "@/contexts/RemindersContext";
import { use24HourClock } from "@/hooks/use24HourClock";
import { formatDate, formatTime } from "@/utils/dateTime";
import { n } from "@/utils/scaling";

export interface TaskRowProps {
  dimmed?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isReordering?: boolean;
  listTitle: string;
  onLongPress?: () => void;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onPress: () => void;
  onToggle: () => void;
  overdue?: boolean;
  task: Task;
}

function buildMeta(task: Task, listTitle: string, use24Hour: boolean): string {
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskLabel =
    subtaskCount > 0
      ? `${subtaskCount} ${subtaskCount === 1 ? "Subtask" : "Subtasks"}`
      : null;
  return [
    listTitle,
    task.date ? formatDate(task.date) : null,
    task.time ? formatTime(task.time, use24Hour) : null,
    subtaskLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function TaskRow({
  task,
  listTitle,
  overdue,
  isReordering = false,
  isFirst = false,
  isLast = false,
  onToggle,
  onPress,
  onLongPress,
  onMoveUp,
  onMoveDown,
  dimmed,
}: TaskRowProps) {
  const { invertColors } = useInvertColors();
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";
  const use24Hour = use24HourClock();

  const meta = buildMeta(task, listTitle, use24Hour);
  const recurrenceLabel = task.recurrence
    ? formatRecurrence(task.recurrence)
    : null;

  let leftControl: React.ReactNode = null;
  if (!isReordering) {
    if (overdue && !task.completed) {
      leftControl = (
        <HapticPressable onPress={onToggle} style={styles.asteriskHitArea}>
          <OverdueAsterisk size={22} />
        </HapticPressable>
      );
    } else {
      leftControl = (
        <TaskCheckbox checked={task.completed} onToggle={onToggle} />
      );
    }
  }

  return (
    <View style={[styles.taskRow, dimmed && styles.taskRowDimmed]}>
      {leftControl}
      <HapticPressable
        {...(onLongPress ? { delayLongPress: 400, onLongPress } : {})}
        onPress={onPress}
        style={[
          styles.taskContent,
          isReordering && styles.taskContentReordering,
        ]}
      >
        <StyledText style={styles.taskTitle}>{task.title}</StyledText>
        {meta ? <StyledText style={styles.taskMeta}>{meta}</StyledText> : null}
        {recurrenceLabel ? (
          <StyledText style={styles.taskMeta}>{recurrenceLabel}</StyledText>
        ) : null}
      </HapticPressable>
      {isReordering && (
        <View style={styles.arrowGroup}>
          <HapticPressable disabled={isFirst} onPress={onMoveUp}>
            <MaterialIcons
              color={isFirst ? dimColor : textColor}
              name="keyboard-arrow-up"
              size={n(32)}
            />
          </HapticPressable>
          <HapticPressable disabled={isLast} onPress={onMoveDown}>
            <MaterialIcons
              color={isLast ? dimColor : textColor}
              name="keyboard-arrow-down"
              size={n(32)}
            />
          </HapticPressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: n(32),
  },
  taskRowDimmed: { opacity: 0.4 },
  taskContent: { flex: 1, paddingVertical: n(11) },
  taskContentReordering: { paddingLeft: n(22) },
  taskTitle: { fontSize: n(23) },
  taskMeta: { fontSize: n(16), marginTop: n(2) },
  asteriskHitArea: {
    paddingHorizontal: n(14),
    paddingTop: n(17),
    paddingBottom: n(8),
    alignSelf: "flex-start",
  },
  arrowGroup: {
    flexDirection: "row",
    gap: n(8),
    paddingRight: n(12),
    paddingTop: n(11),
  },
});
