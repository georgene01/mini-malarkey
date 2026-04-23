'use client'

import { useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'

// Always send password-reset emails pointing at production, even if the user
// clicks "Forgot password" on localhost. You can override with
// NEXT_PUBLIC_SITE_URL at build time if you ever change domains.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://mini-malarkey.vercel.app'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (!error) router.push('/puzzle')
    else alert(error.message)
  }

  async function handleForgotPassword() {
    const target = email.trim().toLowerCase()
    if (!target) {
      alert('Enter your email above first, then tap "Forgot password".')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${SITE_URL}/reset-password`
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('If an account exists for that email, a reset link is on its way. Check your inbox (and spam).')
  }

  async function handleSignup() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

    if (data.user) {
      router.push('/choose-username')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">

      {/* Masthead */}
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
            Account Access
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md border border-neutral-300 p-8 space-y-6 bg-white">

        <div className="space-y-4">

          <input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-neutral-400 px-4 py-3 pr-12 outline-none focus:border-red-800 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-900 transition"
            >
              {showPassword ? (
                /* eye-off */
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-2.16 3.19"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                /* eye */
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

        </div>

        <div className="space-y-3 pt-2">

          <button
            onClick={handleLogin}
            className="w-full bg-neutral-900 text-white py-3 text-sm uppercase tracking-wide hover:bg-black transition"
          >
            Login
          </button>

          <button
            onClick={handleSignup}
            className="w-full border border-neutral-900 py-3 text-sm uppercase tracking-wide hover:bg-neutral-100 transition"
          >
            Sign Up
          </button>

        </div>

        <div className="text-center pt-2">
          <button
            onClick={handleForgotPassword}
            className="text-sm text-neutral-600 hover:text-red-800 transition"
          >
            Forgot password?
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => router.push('/puzzle')}
            className="text-sm text-neutral-600 hover:text-red-800 transition"
          >
            Continue as Guest
          </button>
        </div>

      </div>

    </main>
  )
}
