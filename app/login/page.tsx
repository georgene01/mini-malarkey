'use client'

import { useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (!error) router.push('/')
    else alert(error.message)
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
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition"
          />
  
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition"
          />
  
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
  
        <div className="text-center pt-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-neutral-600 hover:text-red-800 transition"
          >
            Continue as Guest
          </button>
        </div>
  
      </div>
  
    </main>
  )
}