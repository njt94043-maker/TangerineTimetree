import { useState, type FormEvent } from 'react';
import { ErrorAlert } from './ErrorAlert';

interface LoginModalProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onClose: () => void;
}

export function LoginModal({ onSignIn, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const err = await onSignIn(email.trim().toLowerCase(), password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <img
          src="/logo.png"
          alt="The Green Tangerine"
          className="login-modal-logo"
        />

        <h2 className="login-modal-title">Band Login</h2>
        <p className="login-modal-subtitle">Tangerine Timetree</p>

        <form onSubmit={handleSubmit} className="login-modal-form">
          <label htmlFor="modal-email" className="label">EMAIL</label>
          <div className="neu-inset neu-inset-mb">
            <input
              id="modal-email"
              className="input-field"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <label htmlFor="modal-password" className="label">PASSWORD</label>
          <div className="neu-inset neu-inset-mb-relative">
            <input
              id="modal-password"
              className="input-field input-pad-right"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="password-toggle"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <ErrorAlert message={error} compact />}

          <button
            className="btn btn-primary btn-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
