import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

export default function RenameListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invertColors } = useInvertColors();
  const { lists, renameList } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const list = lists.find((l) => l.id === id);
  const [title, setTitle] = useState(list?.title ?? "");
  const canSave = title.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!(canSave && id)) {
      return;
    }
    renameList(id, title.trim());
    router.navigate("/(tabs)/");
  }, [canSave, id, title, renameList]);

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <View style={[styles.modalFill, { backgroundColor: bg }]}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalFill}>
          <SafeAreaView edges={["top"]} style={styles.modalFill}>
            <Header
              headerTitle="Rename"
              rightAction={{
                icon: "check",
                onPress: handleSave,
                show: canSave,
              }}
            />
            <View style={styles.inputArea}>
              <TextInput
                allowFontScaling={false}
                autoFocus
                onChangeText={setTitle}
                onSubmitEditing={handleSave}
                placeholderTextColor={dimColor}
                returnKeyType="done"
                style={[styles.input, { color: textColor }]}
                value={title}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  modalFill: { flex: 1 },
  inputArea: { paddingHorizontal: n(22), paddingTop: n(24) },
  input: {
    fontSize: n(30),
    fontFamily: "PublicSans-Regular",
    paddingBottom: n(8),
  },
});
