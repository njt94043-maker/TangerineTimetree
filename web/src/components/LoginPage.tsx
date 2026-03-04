import { useState, type FormEvent } from 'react';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      {/* Logo with neon glow */}
      <img
        src="/logo.png"
        alt="The Green Tangerine"
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          marginBottom: 20,
          boxShadow: '0 0 20px rgba(243,156,18,0.35), 0 0 50px rgba(243,156,18,0.12)',
        }}
      />

      <h1 style={{
        fontFamily: 'var(--font-body)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--color-tangerine)',
        marginBottom: 4,
        textShadow: '0 0 20px rgba(243,156,18,0.3)',
      }}>
        Tangerine Timetree
      </h1>

      <p style={{
        fontSize: 13,
        color: 'var(--color-text-dim)',
        marginBottom: 36,
        letterSpacing: '0.5px',
      }}>
        The Green Tangerine
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320 }}>
        <label htmlFor="login-email" className="label" style={{ textAlign: 'left' }}>EMAIL</label>
        <div className="neu-inset" style={{ marginBottom: 14 }}>
          <input
            id="login-email"
            className="input-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <label htmlFor="login-password" className="label" style={{ textAlign: 'left' }}>PASSWORD</label>
        <div className="neu-inset" style={{ marginBottom: 14, position: 'relative' }}>
          <input
            id="login-password"
            className="input-field"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--color-text-dim)',
              cursor: 'pointer', fontSize: 13, padding: 6, minWidth: 32, minHeight: 32,
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <p role="alert" style={{
            color: 'var(--color-danger)',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 14,
            textShadow: '0 0 8px rgba(255,82,82,0.3)',
          }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
