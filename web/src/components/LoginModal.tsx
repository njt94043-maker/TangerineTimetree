import { useState, type FormEvent } from 'react';
import { ErrorAlert } from './ErrorAlert';

interface LoginModalProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onResetPassword: (email: string) => Promise<string | null>;
  onClose: () => void;
}

export function LoginModal({ onSignIn, onResetPassword, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    if (resetMode) {
      const err = await onResetPassword(email.trim().toLowerCase());
      if (err) setError(err);
      else setResetSent(true);
    } else {
      if (!password) { setLoading(false); return; }
      const err = await onSignIn(email.trim().toLowerCase(), password);
      if (err) setError(err);
    }
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

        <h2 className="login-modal-title">{resetMode ? 'Reset Password' : 'Band Login'}</h2>
        <p className="login-modal-subtitle">Tangerine Timetree</p>

        {resetSent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--color-success)', marginBottom: 12 }}>
              Password reset email sent to <strong>{email}</strong>
            </p>
            <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              Check your inbox and follow the link to reset your password.
            </p>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 20 }}
              onClick={() => { setResetMode(false); setResetSent(false); setError(''); }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
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

            {!resetMode && (
              <>
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
              </>
            )}

            {error && <ErrorAlert message={error} compact />}

            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={loading}
            >
              {loading
                ? (resetMode ? 'Sending...' : 'Signing in...')
                : (resetMode ? 'Send Reset Link' : 'Sign In')}
            </button>

            <button
              type="button"
              onClick={() => { setResetMode(!resetMode); setError(''); setResetSent(false); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-tangerine)',
                cursor: 'pointer',
                fontSize: 13,
                marginTop: 12,
                textAlign: 'center',
                width: '100%',
                padding: 4,
              }}
            >
              {resetMode ? 'Back to Sign In' : 'Forgot password?'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
