import { TaskForm } from "@/components/TaskForm";

export default function AddScreen() {
  return (
    <TaskForm
      onSaved={() => {
        // ADD tab stays on screen after saving — form resets itself
      }}
    />
  );
}
