type ConfirmationModalProps = {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  icon?: string;
  variant?: "confirm" | "danger";
  isBusy?: boolean;
  busyText?: string;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmationModal({
  title,
  message,
  confirmText,
  cancelText = "Go back",
  icon = "!",
  variant = "danger",
  isBusy = false,
  busyText = "Please wait...",
  error,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <div className="confirmation-modal-overlay">
      <section
        className="confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
      >
        <div className="confirmation-modal-icon" aria-hidden="true">
          {icon}
        </div>

        <h2 id="confirmation-modal-title">{title}</h2>
        <p id="confirmation-modal-description">{message}</p>

        {error && (
          <p className="confirmation-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="confirmation-modal-actions">
          <button
            type="button"
            className="confirmation-modal-back"
            disabled={isBusy}
            onClick={onCancel}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={`confirmation-modal-action confirmation-modal-${variant}`}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? busyText : confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmationModal;
