interface LoadingSpinnerProps {
  text?: string;
  skeleton?: boolean;
}

export function LoadingSpinner({ text = 'Loading...', skeleton }: LoadingSpinnerProps) {
  if (skeleton) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-line wide" />
        <div className="skeleton-line" />
        <div className="skeleton-line narrow" />
      </div>
    );
  }

  return (
    <p className="loading-spinner-text">{text}</p>
  );
}
