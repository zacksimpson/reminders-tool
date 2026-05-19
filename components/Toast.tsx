import { useEffect } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

interface ToastProps {
  duration?: number; // ms, defaults to 1000
  message: string;
  onHide: () => void;
  visible: boolean;
}

export function Toast({
  visible,
  message,
  duration = 1000,
  onHide,
}: ToastProps) {
  const { invertColors } = useInvertColors();

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onHide]);

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: invertColors ? "white" : "black" },
        ]}
      >
        <StyledText
          style={[styles.text, { color: invertColors ? "black" : "white" }]}
        >
          {message}
        </StyledText>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: n(40),
  },
});
