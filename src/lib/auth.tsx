import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type AllowedUser } from './supabase'

type Status = 'loading' | 'signed_out' | 'ready'

interface AuthState {
  status: Status
  session: Session | null
  me: AllowedUser | null
  isAdmin: boolean
  /** Set when the last Google sign-in used an email that isn't on the allowlist. */
  rejectedEmail: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const REJECTED_KEY = 'bb-rejected-email'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<AllowedUser | null>(null)
  const [rejectedEmail, setRejectedEmail] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(REJECTED_KEY)
    } catch {
      return null
    }
  })

  // RLS only returns rows to listed users, so an empty result means "not allowed".
  const loadMe = useCallback(async (s: Session | null) => {
    if (!s) {
      setMe(null)
      setStatus('signed_out')
      return
    }
    const email = (s.user.email ?? '').toLowerCase()
    const { data, error } = await supabase
      .from('allowed_users')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error || !data) {
      try {
        sessionStorage.setItem(REJECTED_KEY, email)
      } catch {
        /* ignore */
      }
      setRejectedEmail(email)
      setMe(null)
      await supabase.auth.signOut()
      setStatus('signed_out')
      return
    }
    try {
      sessionStorage.removeItem(REJECTED_KEY)
    } catch {
      /* ignore */
    }
    setRejectedEmail(null)
    setMe(data as AllowedUser)
    setStatus('ready')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadMe(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // defer so we don't call Supabase inside its own callback
        setTimeout(() => loadMe(s), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadMe])

  const signIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshMe = useCallback(() => loadMe(session), [loadMe, session])

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        me,
        isAdmin: me?.role === 'admin',
        rejectedEmail,
        signIn,
        signOut,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
