import { MaterialIcons } from "@expo/vector-icons";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import type { ReminderList } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

interface ListPickerModalProps {
  lists: ReminderList[];
  onDismiss: () => void;
  onSelect: (list: ReminderList) => void;
  selectedId?: string;
  visible: boolean;
}

export function ListPickerModal({
  visible,
  lists,
  selectedId,
  onSelect,
  onDismiss,
}: ListPickerModalProps) {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const sorted = [...lists].sort((a, b) => a.order - b.order);

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <StyledText style={styles.headerTitle}>List</StyledText>
          <HapticPressable onPress={onDismiss} style={styles.headerClose}>
            <MaterialIcons color={textColor} name="close" size={n(28)} />
          </HapticPressable>
        </View>
        <ScrollView overScrollMode="never" showsVerticalScrollIndicator={false}>
          {sorted.map((list) => {
            const isSelected = list.id === selectedId;
            return (
              <HapticPressable
                key={list.id}
                onPress={() => onSelect(list)}
                style={styles.item}
              >
                <StyledText
                  style={[styles.itemText, isSelected && styles.itemSelected]}
                >
                  {list.title}
                </StyledText>
              </HapticPressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: n(22),
    paddingVertical: n(14),
  },
  headerSpacer: { width: n(32) },
  headerTitle: { fontSize: n(20) },
  headerClose: { width: n(32), alignItems: "flex-end" },
  item: {
    paddingHorizontal: n(22),
    paddingVertical: n(12),
  },
  itemText: { fontSize: n(30) },
  itemSelected: { textDecorationLine: "underline" },
});
