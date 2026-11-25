'use client';
import { useState } from 'react';

export default function Login() {
  const [user, setUser] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, password: pw }) });
    if (r.ok) { try { localStorage.setItem('sc_user', user); } catch {} location.href = '/'; }
    else { setErr('Wrong password.'); setBusy(false); }
  }
  return (
    <main className="login">
      <form onSubmit={submit} className="card loginCard">
        <div className="brand"><span className="dot" />Admate</div>
        <h1>Slick City Local Pack Rankings</h1>
        <p className="muted">Sign in with any name and the team password.</p>
        <label>Name<input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Your name" autoFocus /></label>
        <label>Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Team password" /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}
