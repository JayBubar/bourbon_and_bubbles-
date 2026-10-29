import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn, rejectedEmail } = useAuth()
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <img
        src="/logo-badge.png"
        alt="Opa's Learning Academy — Bourbon & Bubbles, Kentucky Derby theme annual fundraiser"
        className="w-64 max-w-[75vw] drop-shadow-md"
      />
      <h1 className="mt-6 text-center text-3xl">Volunteer Hub</h1>
      <p className="mt-2 text-center text-navy/70">Friday, April 9, 2027 · The Laundry, Columbia SC</p>

      {rejectedEmail && (
        <div role="alert" className="mt-6 w-full max-w-sm rounded-lg border border-rose/40 bg-rose/10 p-4 text-sm text-burgundy">
          <strong>{rejectedEmail}</strong> isn't on the volunteer list. Ask an admin to add your email, then sign in again.
        </div>
      )}

      <button
        className="btn btn-primary mt-8 w-full max-w-sm text-base"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await signIn()
        }}
      >
        <GoogleMark />
        {busy ? 'Opening Google…' : 'Sign in with Google'}
      </button>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 rounded-full bg-white p-0.5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
