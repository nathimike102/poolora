import { useState } from 'react';
import { signInWithEmail, signInWithGoogle, firebaseConfigured, type AdminUser } from '../lib/auth';
import { ApiError } from '../lib/api';

export function SignInPage({ onSignedIn }: { onSignedIn: (u: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<AdminUser>) => {
    setBusy(true);
    setError('');
    try {
      onSignedIn(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => signInWithEmail(email, password));
        }}
      >
        <div className="brand" style={{ padding: 0 }}>
          <img src="/mark.png" alt="" />
          Poolora Admin
        </div>
        <p className="muted">Sign in with an admin account.</p>
        {!firebaseConfigured ? (
          <div className="banner warn">Sign-in is not configured. Set the VITE_FIREBASE_* variables (see .env.example).</div>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <div className="error-text" role="alert">{error}</div> : null}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button className="btn" type="button" disabled={busy} onClick={() => run(signInWithGoogle)}>Sign in with Google</button>
      </form>
    </div>
  );
}
