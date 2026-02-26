'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'
import { isUsernameProfane } from '@/src/lib/usernameModeration'

export default function ChooseUsername() {
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const bannedWords = [
    'admin',
    'moderator',
    'support',
    'fuck',
    'shit',
    'bitch',
    'nazi',
    'racist',
    'sexist',
    'slut',
    'whore',
    'retard',
    'kys'
  ]

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
      }
    })
  }, [])

  function normalizeUsername(name: string) {
    return name
      .toLowerCase()
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's')
      .replace(/_/g, '')
      .replace(/\./g, '')
  }
  function isUsernameAllowed(name: string) {
    const normalized = normalizeUsername(name)
  
    return !bannedWords.some(word =>
      normalized.includes(word)
    )
  }

  async function saveUsername() {
    if (!user) return
  
    const clean = username.toLowerCase().trim()
  
    if (!clean) {
      alert('Enter a username')
      return
    }
  
    if (clean.length < 3) {
      alert('Username must be at least 3 characters')
      return
    }
  
    if (!/^[a-z0-9._]+$/.test(clean)) {
      alert('Only lowercase letters, numbers, dots and underscores allowed')
      return
    }
  
    // ✅ PROFANITY CHECK GOES RIGHT HERE
    if (isUsernameProfane(clean)) {
      alert('That username is not allowed')
      return
    }
  
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: clean
      })
  
    if (error) {
      if (error.code === '23505') {
        alert('Username already taken')
      } else {
        alert('Something went wrong')
      }
      return
    }
  
    router.push('/')
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
            Choose a Username
          </h1>
        </div>
      </div>
  
      {/* Form Card */}
      <div className="w-full max-w-md border border-neutral-300 p-8 space-y-6 bg-white">
  
        <div className="text-sm text-neutral-600">
          Your username will appear on the public leaderboard.
        </div>
  
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full border border-neutral-400 px-4 py-3 outline-none focus:border-red-800 transition lowercase"
        />
  
        <button
          onClick={saveUsername}
          className="w-full bg-neutral-900 text-white py-3 text-sm uppercase tracking-wide hover:bg-black transition"
        >
          Continue
        </button>
  
      </div>
  
    </main>
  )
}