interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorAlert({ message, onRetry, compact }: ErrorAlertProps) {
  if (compact) {
    return (
      <p role="alert" className="error-alert-compact">{message}</p>
    );
  }

  return (
    <div role="alert" className="error-alert">
      <p className="error-alert-text">{message}</p>
      {onRetry && (
        <button className="btn btn-small btn-green" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
