import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { TimePicker } from "@/components/TimePicker";
import { Toast } from "@/components/Toast";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import {
  formatRecurrence,
  generateId,
  type Recurrence,
  useReminders,
} from "@/contexts/RemindersContext";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import { useTimePickerState } from "@/hooks/useTimePickerState";
import { formatDisplayDate } from "@/utils/dateTime";
import { triggerHaptic } from "@/utils/haptics";
import { n } from "@/utils/scaling";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TaskFormProps {
  defaultDate?: string; // "YYYY-MM-DD"
  defaultListId?: string;
  isModal?: boolean; // when true, hides header back/check and shows bottom × / SAVE footer
  onBack?: () => void; // override back button behavior (e.g. when used inside a Modal)
  onSaved: () => void; // called after task is saved (and toast dismissed if shown)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskForm({
  defaultListId,
  defaultDate,
  onSaved,
  onBack,
  isModal,
}: TaskFormProps) {
  const { invertColors } = useInvertColors();
  const { lists, settings, addTask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";

  const resolvedListId = defaultListId ?? settings.defaultListId;
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();
  const { viewYear, viewMonth, goToPrevMonth, goToNextMonth } =
    useMonthNavigation();
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
  } = useTimePickerState();

  const [title, setTitle] = useState("");
  const [selectedListId, setSelectedListId] = useState(resolvedListId);
  const [date, setDate] = useState<string | undefined>(defaultDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [subtasks, setSubtasks] = useState<
    Array<{ id: string; title: string; completed: boolean }>
  >([]);
  const [newSubtask, setNewSubtask] = useState("");
  const newSubtaskRef = useRef("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(
    undefined
  );
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);

  const selectedList = lists.find((l) => l.id === selectedListId) ?? lists[0];
  const canSave = title.trim().length > 0;

  const resetForm = useCallback(
    (keepList = false) => {
      setTitle("");
      if (!keepList) {
        setSelectedListId(resolvedListId);
      }
      setDate(defaultDate);
      clearTime();
      setSubtasks([]);
      setNewSubtask("");
      newSubtaskRef.current = "";
      setShowSubtaskInput(false);
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
      setRecurrence(undefined);
    },
    [resolvedListId, defaultDate, clearTime]
  );

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    Keyboard.dismiss();
    const pending = newSubtaskRef.current.trim();
    const finalSubtasks = pending
      ? [...subtasks, { id: generateId(), title: pending, completed: false }]
      : subtasks;
    newSubtaskRef.current = "";
    addTask({
      title: title.trim(),
      listId: selectedListId,
      date,
      time: confirmedTime,
      recurrence,
      subtasks: finalSubtasks.map((s) => ({
        id: s.id,
        title: s.title,
        completed: s.completed,
        createdAt: Date.now(),
      })),
    });

    if (settings.afterAddBehavior === "toast") {
      setToastVisible(true);
    } else {
      const listId = selectedListId;
      resetForm(false);
      onSaved();
      router.navigate("/(tabs)/");
      router.push({ pathname: "/list/[id]", params: { id: listId } });
    }
  }, [
    canSave,
    title,
    selectedListId,
    date,
    confirmedTime,
    recurrence,
    subtasks,
    settings,
    addTask,
    resetForm,
    onSaved,
  ]);

  const handleTimeConfirm = useCallback(() => {
    if (confirmTime()) {
      setShowTimePicker(false);
    }
  }, [confirmTime]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: bg }]}
    >
      {isModal ? (
        <Header headerTitle="Add Task" hideBackButton />
      ) : (
        <Header
          headerTitle="Add Task"
          onBack={onBack}
          rightAction={{ icon: "check", onPress: handleSave, show: canSave }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "android" ? "height" : "padding"}
        style={styles.flex}
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
              {/* Task name */}
              <View style={styles.field}>
                <RNTextInput
                  allowFontScaling={false}
                  autoFocus
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

              {/* List */}
              <HapticPressable
                onPress={() => setShowListPicker(true)}
                style={styles.field}
              >
                <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                  List
                </StyledText>
                <StyledText style={styles.fieldValue}>
                  {selectedList?.title ?? "Inbox"}
                </StyledText>
              </HapticPressable>

              {/* Date */}
              <HapticPressable
                onPress={() => setShowDatePicker(true)}
                style={styles.field}
              >
                <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                  Date
                </StyledText>
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

              {/* Time — only if date is set */}
              {date && (
                <HapticPressable
                  onPress={() => setShowTimePicker(true)}
                  style={styles.field}
                >
                  <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                    Time
                  </StyledText>
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
                  <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                    Recurring
                  </StyledText>
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

              {/* Subtasks */}
              <View style={styles.subtasksHeader}>
                <StyledText style={[styles.fieldLabel, { color: textColor }]}>
                  Subtasks
                </StyledText>
              </View>
              {subtasks.map((sub) => (
                <View key={sub.id} style={styles.subtaskRow}>
                  <View
                    style={[
                      styles.subtaskCheckboxIcon,
                      sub.completed && styles.taskDone,
                    ]}
                  >
                    <TaskCheckbox
                      checked={sub.completed}
                      onToggle={() =>
                        setSubtasks((prev) =>
                          prev.map((s) =>
                            s.id === sub.id
                              ? { ...s, completed: !s.completed }
                              : s
                          )
                        )
                      }
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
                      onBlur={() => {
                        const t = editingSubtaskTitle.trim();
                        setEditingSubtaskId(null);
                        if (t) {
                          setSubtasks((prev) =>
                            prev.map((s) =>
                              s.id === sub.id ? { ...s, title: t } : s
                            )
                          );
                        }
                      }}
                      onChangeText={setEditingSubtaskTitle}
                      onSubmitEditing={() => {
                        const t = editingSubtaskTitle.trim();
                        setEditingSubtaskId(null);
                        if (t) {
                          setSubtasks((prev) =>
                            prev.map((s) =>
                              s.id === sub.id ? { ...s, title: t } : s
                            )
                          );
                        }
                      }}
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
                      onPress={() =>
                        setSubtasks((prev) =>
                          prev.filter((s) => s.id !== sub.id)
                        )
                      }
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
                        if (t) {
                          setSubtasks((prev) => [
                            ...prev,
                            { id: generateId(), title: t, completed: false },
                          ]);
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
                      if (t) {
                        setSubtasks((prev) => [
                          ...prev,
                          { id: generateId(), title: t, completed: false },
                        ]);
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
                      if (t) {
                        setSubtasks((prev) => [
                          ...prev,
                          { id: generateId(), title: t, completed: false },
                        ]);
                      }
                      newSubtaskRef.current = "";
                      setNewSubtask("");
                      setShowSubtaskInput(false);
                    }}
                    placeholder="Add subtask…"
                    placeholderTextColor={textColor}
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
            </View>
          </Animated.ScrollView>
          {scrollIndicatorHeight > 0 && (
            <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
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
        visible={showTimePicker}
      />

      <RecurrencePicker
        onDismiss={() => setShowRecurrencePicker(false)}
        onSave={(r) => {
          setRecurrence(r);
          setShowRecurrencePicker(false);
        }}
        value={recurrence}
        visible={showRecurrencePicker}
      />

      <ListPickerModal
        lists={lists}
        onDismiss={() => setShowListPicker(false)}
        onSelect={(list) => {
          setSelectedListId(list.id);
          setShowListPicker(false);
        }}
        selectedId={selectedListId}
        visible={showListPicker}
      />

      {isModal && (
        <View style={styles.modalFooter}>
          <View style={styles.modalFooterSide} />
          <HapticPressable onPress={onBack} style={styles.modalFooterBtn}>
            <StyledText style={styles.modalDismissX}>✕</StyledText>
          </HapticPressable>
          <View style={styles.modalFooterSide}>
            <HapticPressable onPress={handleSave} style={styles.modalSaveBtn}>
              <StyledText style={styles.modalSave}>SAVE</StyledText>
            </HapticPressable>
          </View>
        </View>
      )}

      <Toast
        message="added"
        onHide={() => {
          setToastVisible(false);
          resetForm(true);
          onSaved();
        }}
        visible={toastVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  scrollWrapper: { flex: 1, position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  subtasksHeader: {
    paddingHorizontal: n(22),
    paddingTop: n(28),
    paddingBottom: n(12),
  },
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
  subtaskInputRow: {
    paddingLeft: n(48),
    paddingRight: n(22),
    paddingVertical: n(10),
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: n(14),
  },
  modalFooterSide: { flex: 1, alignItems: "flex-end", paddingRight: n(24) },
  modalFooterBtn: { padding: n(8) },
  modalSaveBtn: { padding: n(8) },
  modalDismissX: { fontSize: n(28) },
  modalSave: {
    fontSize: n(24),
    letterSpacing: n(5),
    fontFamily: "PublicSans-Regular",
  },
});
