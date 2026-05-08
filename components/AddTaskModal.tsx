import { Modal } from "react-native";
import { TaskForm } from "@/components/TaskForm";
import { useInvertColors } from "@/contexts/InvertColorsContext";

interface AddTaskModalProps {
  visible: boolean;
  defaultListId?: string;
  defaultDate?: string;
  onDismiss: () => void;
}

export function AddTaskModal({ visible, defaultListId, defaultDate, onDismiss }: AddTaskModalProps) {
  const { invertColors } = useInvertColors();

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      statusBarTranslucent
    >
      <TaskForm
        defaultListId={defaultListId}
        defaultDate={defaultDate}
        onSaved={onDismiss}
        onBack={onDismiss}
        isModal
      />
    </Modal>
  );
}
