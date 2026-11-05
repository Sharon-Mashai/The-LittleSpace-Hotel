import { useEffect, useRef } from "react";

type ToastProps = {
  message: string;
  onDismiss: () => void;
};

function Toast({ message, onDismiss }: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => onDismissRef.current(), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

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
