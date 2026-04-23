'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the user clicks the email link, Supabase puts a recovery token
  // in the URL hash and fires a PASSWORD_RECOVERY auth event. At that
  // point the client is authenticated well enough to call updateUser.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    // Fallback: if we already have a session (e.g. user refreshed the page),
    // allow the form too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit() {
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    alert('Password updated. You are now signed in.')
    router.push('/puzzle')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-4 mb-12">
        <img
          src="/logo.png"
          alt="Daily Malarkey"
          className="w-14 h-14 object-contain"
        />
        <div>
          <div className="text-sm tracking-[0.25em] uppercase text-neutral-500">
            Daily Malarkey
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Reset Password
          </h1>
        </div>
      </div>

      <div className="w-full max-w-md border border-neutral-300 p-8 space-y-6 bg-white">
        {!ready ? (
          <div className="text-sm text-neutral-600">
            Verifying reset link… If this screen doesn't change in a few
            seconds, the link may have expired. Request a new one from the
            login page.
          </div>
        ) : (
          <>
            <div className="text-sm text-neutral-600">
              Enter a new password for your account.
            </div>

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition"
            />

            {error && (
              <div className="text-sm text-red-800">{error}</div>
            )}

            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="w-full bg-neutral-900 text-white py-3 text-sm uppercase tracking-wide hover:bg-black transition disabled:opacity-50"
            >
              {submitting ? 'Updating…' : 'Update Password'}
            </button>

            <div className="text-center">
              <button
                onClick={() => router.push('/login')}
                className="text-sm text-neutral-600 hover:text-red-800 transition"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
