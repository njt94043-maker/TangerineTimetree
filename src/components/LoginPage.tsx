import { useState, type FormEvent } from 'react';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      {/* Logo */}
      <img
        src="/logo.png"
        alt="The Green Tangerine"
        style={{ width: 100, height: 100, borderRadius: '50%', marginBottom: 16 }}
      />

      <h1 style={{
        fontFamily: 'var(--font-body)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--color-tangerine)',
        marginBottom: 4,
      }}>
        Tangerine Timetree
      </h1>

      <p style={{
        fontSize: 13,
        color: 'var(--color-text-dim)',
        marginBottom: 32,
      }}>
        The Green Tangerine Gig Calendar
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320 }}>
        <div className="neu-inset" style={{ marginBottom: 14 }}>
          <input
            className="input-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="neu-inset" style={{ marginBottom: 14 }}>
          <input
            className="input-field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
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
