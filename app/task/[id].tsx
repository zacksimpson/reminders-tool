import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClearIcon } from "@/components/ClearIcon";
import { DatePicker } from "@/components/DatePicker";
import { DeleteIcon } from "@/components/DeleteIcon";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { ListPickerModal } from "@/components/ListPickerModal";
import { PlusCircleIcon } from "@/components/PlusCircleIcon";
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
import { use24HourClock } from "@/hooks/use24HourClock";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import { useTimePickerState } from "@/hooks/useTimePickerState";
import { formatDisplayDate } from "@/utils/dateTime";
import { triggerHaptic } from "@/utils/haptics";
import { n } from "@/utils/scaling";

export default function TaskScreen() {
  const { id, confirmed, action } = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();
  const { invertColors } = useInvertColors();
  const use24Hour = use24HourClock();
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

  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();
  const { viewYear, viewMonth, goToPrevMonth, goToNextMonth } =
    useMonthNavigation();

  const task = tasks.find((t) => t.id === id);

  const {
    confirmedTime,
    timeDigits,
    ampm,
    setAmPm,
    confirm: confirmTime,
    clear: clearTime,
    onPickerDismiss: onTimePickerDismiss,
    appendDigit,
    backspace,
    displayTime,
  } = useTimePickerState(task?.time, use24Hour);

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
  const [newSubtask, setNewSubtask] = useState("");
  const newSubtaskRef = useRef("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(
    task?.recurrence
  );
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const subtaskInputRef = useRef<RNTextInput>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const selectedList = lists.find((l) => l.id === listId);

  const handleSave = useCallback(() => {
    if (!(task && title.trim())) {
      return;
    }
    const pending = newSubtaskRef.current.trim();
    if (pending) {
      addSubtask(task.id, pending);
      newSubtaskRef.current = "";
    }
    updateTask(task.id, {
      title: title.trim(),
      listId,
      date,
      time: confirmedTime,
      recurrence,
    });
    router.back();
  }, [
    task,
    title,
    listId,
    date,
    confirmedTime,
    recurrence,
    updateTask,
    addSubtask,
  ]);

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

  const handleTimeConfirm = useCallback(() => {
    if (confirmTime()) {
      setShowTimePicker(false);
    }
  }, [confirmTime]);

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
          <View style={styles.scrollWrapper}>
            <Animated.ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              onScroll={handleScroll}
              overScrollMode="never"
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              <View
                onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
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
                    placeholderTextColor={textColor}
                    returnKeyType="done"
                    selectionColor={textColor}
                    style={[
                      styles.titleInput,
                      { color: textColor, borderBottomColor: textColor },
                    ]}
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
                          clearTime();
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
                          {displayTime}
                        </StyledText>
                        <HapticPressable
                          onPress={clearTime}
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
                    <StyledText style={styles.fieldLabel}>Recurring</StyledText>
                    {recurrence ? (
                      <View style={styles.fieldValueRow}>
                        <StyledText style={styles.fieldValue}>
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
                      <StyledText style={styles.fieldValue}>None</StyledText>
                    )}
                  </HapticPressable>
                )}

                <View style={styles.sectionHeader}>
                  <StyledText style={styles.sectionLabel}>Subtasks</StyledText>
                </View>

                {task.subtasks.map((sub) => (
                  <View key={sub.id} style={styles.subtaskRow}>
                    <View
                      style={[
                        styles.subtaskCheckboxIcon,
                        sub.completed && styles.taskDone,
                      ]}
                    >
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
                        style={[
                          styles.subtaskTitle,
                          { color: textColor, paddingLeft: 0 },
                        ]}
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

                {showSubtaskInput ? (
                  <View style={styles.subtaskRow}>
                    <View style={styles.subtaskCheckboxIcon}>
                      <HapticPressable
                        onPress={() => {
                          const t = newSubtaskRef.current.trim();
                          if (t && task) {
                            addSubtask(task.id, t);
                          }
                          newSubtaskRef.current = "";
                          setNewSubtask("");
                          setShowSubtaskInput(false);
                        }}
                        style={styles.plusIconWrapper}
                      >
                        <PlusCircleIcon color={textColor} />
                      </HapticPressable>
                    </View>
                    <RNTextInput
                      allowFontScaling={false}
                      autoFocus
                      cursorColor={textColor}
                      onBlur={() => {
                        const t = newSubtaskRef.current.trim();
                        if (t && task) {
                          addSubtask(task.id, t);
                        }
                        newSubtaskRef.current = "";
                        setNewSubtask("");
                        setShowSubtaskInput(false);
                      }}
                      onChangeText={(text) => {
                        newSubtaskRef.current = text;
                        setNewSubtask(text);
                      }}
                      onFocus={triggerHaptic}
                      onSubmitEditing={() => {
                        const t = newSubtaskRef.current.trim();
                        if (t && task) {
                          addSubtask(task.id, t);
                        }
                        newSubtaskRef.current = "";
                        setNewSubtask("");
                        setShowSubtaskInput(false);
                      }}
                      placeholder="Add subtask…"
                      placeholderTextColor={textColor}
                      ref={subtaskInputRef}
                      returnKeyType="done"
                      selectionColor={textColor}
                      style={[
                        styles.subtaskTitle,
                        { color: textColor, paddingLeft: 0 },
                      ]}
                      value={newSubtask}
                    />
                  </View>
                ) : (
                  <HapticPressable
                    onPress={() => setShowSubtaskInput(true)}
                    style={styles.addSubtaskBtn}
                  >
                    <PlusCircleIcon color={textColor} />
                  </HapticPressable>
                )}

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
          onNextMonth={goToNextMonth}
          onPrevMonth={goToPrevMonth}
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
          onBackspace={backspace}
          onConfirm={handleTimeConfirm}
          onDigit={appendDigit}
          onDismiss={() => {
            setShowTimePicker(false);
            onTimePickerDismiss();
          }}
          use24Hour={use24Hour}
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
    paddingLeft: 0,
    borderBottomWidth: 3,
    marginRight: n(18),
  },
  sectionHeader: {
    paddingHorizontal: n(22),
    paddingTop: n(28),
    paddingBottom: n(12),
  },
  sectionLabel: { fontSize: n(14) },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: n(8),
    paddingRight: n(22),
  },
  subtaskCheckboxIcon: { alignSelf: "flex-start", paddingTop: n(15) },
  subtaskDeleteIcon: { alignSelf: "flex-start", paddingTop: n(17) },
  subtaskTitle: { flex: 1, fontSize: n(22), paddingVertical: n(10) },
  taskDone: { opacity: 0.4 },
  deleteSubtask: {
    paddingLeft: n(8),
    paddingRight: n(18),
    paddingBottom: n(8),
  },
  addSubtaskBtn: {
    marginLeft: n(8),
    paddingHorizontal: n(14),
    paddingTop: n(15),
    paddingBottom: n(14),
  },
  plusIconWrapper: { paddingHorizontal: n(14) },
  deleteRow: {
    paddingHorizontal: n(22),
    paddingVertical: n(28),
    alignItems: "center",
  },
  deleteText: { fontSize: n(24), letterSpacing: n(5) },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(20), opacity: 0.4 },
});
