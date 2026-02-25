'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ChooseUsername() {
  const [username, setUsername] = useState('')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
      }
    })
  }, [])

  async function saveUsername() {
    if (!username) {
      alert('Enter a username')
      return
    }

    const { error } = await supabase
  .from('profiles')
  .insert({
    id: user.id,
    username: username.toLowerCase().trim()
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