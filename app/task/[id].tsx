import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClearIcon } from "@/components/ClearIcon";
import { DatePicker } from "@/components/DatePicker";
import { DeleteIcon } from "@/components/DeleteIcon";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { ListPickerModal } from "@/components/ListPickerModal";
import { RecurrencePicker } from "@/components/RecurrencePicker";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { TimePicker } from "@/components/TimePicker";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import {
  formatRecurrence,
  type Recurrence,
  useReminders,
} from "@/contexts/RemindersContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import {
  digitsToTime,
  formatDisplayDate,
  formatDisplayTime,
  timeToDisplayParts,
} from "@/utils/dateTime";
import { triggerHaptic } from "@/utils/haptics";
import { n } from "@/utils/scaling";

export default function TaskScreen() {
  const { id, confirmed, action } = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();
  const { invertColors } = useInvertColors();
  const {
    tasks,
    lists,
    updateTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    deleteSubtask,
  } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  const task = tasks.find((t) => t.id === id);

  // Handle returning from confirm screen
  useEffect(() => {
    if (confirmed === "true" && action === `delete-task:${id}`) {
      deleteTask(id);
      router.back();
    }
  }, [confirmed, action, id, deleteTask]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [listId, setListId] = useState(task?.listId ?? "");
  const [date, setDate] = useState<string | undefined>(task?.date);
  const [confirmedTime, setConfirmedTime] = useState<string | undefined>(
    task?.time
  );
  const initTimeParts = task?.time
    ? timeToDisplayParts(task.time)
    : { digits: "", ampm: "AM" as const };
  const [timeDigits, setTimeDigits] = useState(initTimeParts.digits);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initTimeParts.ampm);
  const [newSubtask, setNewSubtask] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(
    task?.recurrence
  );
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const subtaskInputRef = useRef<RNTextInput>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const selectedList = lists.find((l) => l.id === listId);

  const handleSave = useCallback(() => {
    if (!(task && title.trim())) {
      return;
    }
    updateTask(task.id, {
      title: title.trim(),
      listId,
      date,
      time: confirmedTime,
      recurrence,
    });
    router.back();
  }, [task, title, listId, date, confirmedTime, recurrence, updateTask]);

  const handleDelete = useCallback(() => {
    if (!task) {
      return;
    }
    const message = task.recurrence
      ? "This is a recurring task. Delete all occurrences?"
      : `Are you sure you want to delete "${task.title}"?`;
    router.push({
      pathname: "/confirm",
      params: {
        message,
        confirmText: "Delete",
        action: `delete-task:${task.id}`,
        // biome-ignore lint/suspicious/noExplicitAny: expo-router navigate with dynamic pathname requires any
        returnPath: `/task/${id}` as any,
      },
    });
  }, [task, id]);

  const handleRenameSubtask = useCallback(
    (subtaskId: string) => {
      const t = editingSubtaskTitle.trim();
      setEditingSubtaskId(null);
      if (!(t && task)) {
        return;
      }
      const subtask = task.subtasks.find((s) => s.id === subtaskId);
      if (!subtask || t === subtask.title) {
        return;
      }
      const updatedSubtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, title: t } : s
      );
      updateTask(task.id, { subtasks: updatedSubtasks });
    },
    [editingSubtaskTitle, task, updateTask]
  );

  const handleAddSubtask = useCallback(() => {
    const t = newSubtask.trim();
    if (!(t && task)) {
      return;
    }
    addSubtask(task.id, t);
    setNewSubtask("");
  }, [newSubtask, task, addSubtask]);

  const handleTimeConfirm = useCallback(() => {
    if (timeDigits.length !== 3 && timeDigits.length !== 4) {
      return;
    }
    setConfirmedTime(digitsToTime(timeDigits, ampm));
    setShowTimePicker(false);
  }, [timeDigits, ampm]);

  if (!task) {
    return (
      <SwipeBackContainer onSwipeBack={() => router.back()}>
        <SafeAreaView
          edges={["top"]}
          style={[styles.container, { backgroundColor: bg }]}
        >
          <Header />
          <View style={styles.empty}>
            <StyledText style={styles.emptyText}>task not found</StyledText>
          </View>
        </SafeAreaView>
      </SwipeBackContainer>
    );
  }

  return (
    <SwipeBackContainer onSwipeBack={handleSave}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header
          headerTitle="Edit"
          rightAction={{ icon: "check", onPress: handleSave }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "android" ? "height" : "padding"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback
            accessible={false}
            onPress={Keyboard.dismiss}
          >
            <View style={styles.scrollWrapper}>
              <Animated.ScrollView
                keyboardShouldPersistTaps="handled"
                onLayout={(e) =>
                  setScrollViewHeight(e.nativeEvent.layout.height)
                }
                onScroll={handleScroll}
                overScrollMode="never"
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
              >
                <View
                  onLayout={(e) =>
                    setContentHeight(e.nativeEvent.layout.height)
                  }
                >
                  <View style={styles.field}>
                    <RNTextInput
                      allowFontScaling={false}
                      blurOnSubmit
                      cursorColor={textColor}
                      multiline
                      onChangeText={setTitle}
                      onSubmitEditing={Keyboard.dismiss}
                      placeholder="Task name"
                      placeholderTextColor={dimColor}
                      returnKeyType="done"
                      selectionColor={textColor}
                      style={[styles.titleInput, { color: textColor }]}
                      value={title}
                    />
                  </View>

                  <HapticPressable
                    onPress={() => setShowListPicker(true)}
                    style={styles.field}
                  >
                    <StyledText style={styles.fieldLabel}>List</StyledText>
                    <StyledText style={styles.fieldValue}>
                      {selectedList?.title ?? "Inbox"}
                    </StyledText>
                  </HapticPressable>

                  <HapticPressable
                    onPress={() => setShowDatePicker(true)}
                    style={styles.field}
                  >
                    <StyledText style={styles.fieldLabel}>Date</StyledText>
                    {date ? (
                      <View style={styles.fieldValueRow}>
                        <StyledText style={styles.fieldValue}>
                          {formatDisplayDate(date)}
                        </StyledText>
                        <HapticPressable
                          onPress={() => {
                            setDate(undefined);
                            setConfirmedTime(undefined);
                            setTimeDigits("");
                            setAmPm("AM");
                            setRecurrence(undefined);
                          }}
                          style={styles.clearBtn}
                        >
                          <ClearIcon />
                        </HapticPressable>
                      </View>
                    ) : (
                      <StyledText style={styles.fieldValue}>None</StyledText>
                    )}
                  </HapticPressable>

                  {date && (
                    <HapticPressable
                      onPress={() => setShowTimePicker(true)}
                      style={styles.field}
                    >
                      <StyledText style={styles.fieldLabel}>Time</StyledText>
                      {confirmedTime ? (
                        <View style={styles.fieldValueRow}>
                          <StyledText style={styles.fieldValue}>
                            {formatDisplayTime(timeDigits, ampm)}
                          </StyledText>
                          <HapticPressable
                            onPress={() => {
                              setConfirmedTime(undefined);
                              setTimeDigits("");
                              setAmPm("AM");
                            }}
                            style={styles.clearBtn}
                          >
                            <ClearIcon />
                          </HapticPressable>
                        </View>
                      ) : (
                        <StyledText style={styles.fieldValue}>None</StyledText>
                      )}
                    </HapticPressable>
                  )}

                  {/* Recurring — only if date is set */}
                  {date && (
                    <HapticPressable
                      onPress={() => setShowRecurrencePicker(true)}
                      style={styles.field}
                    >
                      <StyledText style={styles.fieldLabel}>
                        Recurring
                      </StyledText>
                      {recurrence ? (
                        <View style={styles.fieldValueRow}>
                          <StyledText
                            style={[styles.fieldValue, { color: textColor }]}
                          >
                            {formatRecurrence(recurrence)}
                          </StyledText>
                          <HapticPressable
                            onPress={() => setRecurrence(undefined)}
                            style={styles.clearBtn}
                          >
                            <ClearIcon />
                          </HapticPressable>
                        </View>
                      ) : (
                        <StyledText
                          style={[styles.fieldValue, { color: textColor }]}
                        >
                          None
                        </StyledText>
                      )}
                    </HapticPressable>
                  )}

                  <View style={styles.sectionHeader}>
                    <StyledText style={styles.sectionLabel}>
                      Subtasks
                    </StyledText>
                  </View>

                  {task.subtasks.map((sub) => (
                    <View key={sub.id} style={styles.subtaskRow}>
                      <View style={styles.subtaskCheckboxIcon}>
                        <TaskCheckbox
                          checked={sub.completed}
                          onToggle={() => toggleSubtask(task.id, sub.id)}
                          paddingBottom={0}
                          paddingTop={0}
                          size={20}
                        />
                      </View>
                      {editingSubtaskId === sub.id ? (
                        <RNTextInput
                          allowFontScaling={false}
                          autoFocus
                          blurOnSubmit
                          cursorColor={textColor}
                          multiline
                          onBlur={() => handleRenameSubtask(sub.id)}
                          onChangeText={setEditingSubtaskTitle}
                          onSubmitEditing={() => handleRenameSubtask(sub.id)}
                          returnKeyType="done"
                          selectionColor={textColor}
                          style={[styles.subtaskTitle, { color: textColor }]}
                          value={editingSubtaskTitle}
                        />
                      ) : (
                        <HapticPressable
                          onPress={() => {
                            setEditingSubtaskId(sub.id);
                            setEditingSubtaskTitle(sub.title);
                          }}
                          style={{ flex: 1 }}
                        >
                          <StyledText
                            style={[
                              styles.subtaskTitle,
                              sub.completed && styles.taskDone,
                            ]}
                          >
                            {sub.title}
                          </StyledText>
                        </HapticPressable>
                      )}
                      <View style={styles.subtaskDeleteIcon}>
                        <HapticPressable
                          onPress={() => deleteSubtask(task.id, sub.id)}
                          style={styles.deleteSubtask}
                        >
                          <DeleteIcon />
                        </HapticPressable>
                      </View>
                    </View>
                  ))}

                  <View style={styles.subtaskInputRow}>
                    <RNTextInput
                      allowFontScaling={false}
                      cursorColor={textColor}
                      onChangeText={setNewSubtask}
                      onFocus={triggerHaptic}
                      onSubmitEditing={handleAddSubtask}
                      placeholder="Add subtask…"
                      placeholderTextColor={dimColor}
                      ref={subtaskInputRef}
                      returnKeyType="done"
                      selectionColor={textColor}
                      style={[styles.subtaskField, { color: textColor }]}
                      value={newSubtask}
                    />
                  </View>

                  <HapticPressable
                    onPress={handleDelete}
                    style={styles.deleteRow}
                  >
                    <StyledText style={styles.deleteText}>DELETE</StyledText>
                  </HapticPressable>
                </View>
              </Animated.ScrollView>
              {scrollIndicatorHeight > 0 && (
                <View
                  style={[styles.scrollTrack, { backgroundColor: textColor }]}
                >
                  <Animated.View
                    style={[
                      styles.scrollThumb,
                      {
                        backgroundColor: textColor,
                        height: scrollIndicatorHeight,
                        transform: [{ translateY: scrollIndicatorPosition }],
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <RecurrencePicker
          onDismiss={() => setShowRecurrencePicker(false)}
          onSave={(r) => {
            setRecurrence(r);
            setShowRecurrencePicker(false);
          }}
          value={recurrence}
          visible={showRecurrencePicker}
        />
        <DatePicker
          onDismiss={() => setShowDatePicker(false)}
          onNextMonth={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          onPrevMonth={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          onSelect={(d) => {
            setDate(d);
            setShowDatePicker(false);
          }}
          value={date}
          viewMonth={viewMonth}
          viewYear={viewYear}
          visible={showDatePicker}
        />
        <TimePicker
          ampm={ampm}
          digits={timeDigits}
          onAmPm={setAmPm}
          onBackspace={() => setTimeDigits((prev) => prev.slice(0, -1))}
          onConfirm={handleTimeConfirm}
          onDigit={(d) =>
            setTimeDigits((prev) => (prev.length < 4 ? prev + d : prev))
          }
          onDismiss={() => {
            setShowTimePicker(false);
            if (!confirmedTime) {
              setTimeDigits("");
              setAmPm("AM");
            }
          }}
          visible={showTimePicker}
        />
        <ListPickerModal
          lists={lists}
          onDismiss={() => setShowListPicker(false)}
          onSelect={(list) => {
            setListId(list.id);
            setShowListPicker(false);
          }}
          selectedId={listId}
          visible={showListPicker}
        />
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  field: { paddingHorizontal: n(22), paddingVertical: n(13) },
  subtasksField: { paddingTop: n(28) },
  fieldLabel: { fontSize: n(14), marginBottom: n(4) },
  fieldValue: { fontSize: n(24), fontFamily: "PublicSans-Regular" },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearBtn: { paddingRight: n(18) },
  titleInput: {
    fontSize: n(30),
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(4),
  },
  sectionHeader: { paddingHorizontal: n(22), paddingVertical: n(12) },
  sectionLabel: { fontSize: n(14) },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: n(22),
  },
  subtaskCheckboxIcon: { alignSelf: "flex-start", paddingTop: n(14) },
  subtaskDeleteIcon: { alignSelf: "flex-start", paddingTop: n(17) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(10) },
  taskDone: { textDecorationLine: "line-through", opacity: 0.4 },
  deleteSubtask: {
    paddingLeft: n(8),
    paddingRight: n(18),
    paddingBottom: n(8),
  },
  subtaskInputRow: { paddingHorizontal: n(22), paddingVertical: n(10) },
  subtaskField: { fontSize: n(22), fontFamily: "PublicSans-Regular" },
  deleteRow: {
    paddingHorizontal: n(22),
    paddingVertical: n(28),
    alignItems: "center",
  },
  deleteText: { fontSize: n(24), letterSpacing: n(5) },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(20), opacity: 0.4 },
});
