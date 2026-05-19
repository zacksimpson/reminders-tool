import { Modal } from "react-native";
import { TaskForm } from "@/components/TaskForm";

interface AddTaskModalProps {
  defaultDate?: string;
  defaultListId?: string;
  onDismiss: () => void;
  visible: boolean;
}

export function AddTaskModal({
  visible,
  defaultListId,
  defaultDate,
  onDismiss,
}: AddTaskModalProps) {
  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <TaskForm
        defaultDate={defaultDate}
        defaultListId={defaultListId}
        isModal
        onBack={onDismiss}
        onSaved={onDismiss}
      />
    </Modal>
  );
}
