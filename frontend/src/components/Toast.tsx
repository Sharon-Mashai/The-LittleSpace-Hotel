import { useEffect } from "react";

type ToastProps = {
  message: string;
  onDismiss: () => void;
};

function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(onDismiss, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="success-toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
