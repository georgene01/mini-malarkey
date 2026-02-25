'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function LeaderboardPage() {
  const router = useRouter()

  const [tab, setTab] = useState(0) // 0 = public, 1 = friends
  const [user, setUser] = useState<any>(null)
  const [publicScores, setPublicScores] = useState<any[]>([])
  const [friendScores, setFriendScores] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [friendRelations, setFriendRelations] = useState<any[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [incomingRequests, setIncomingRequests] = useState<any[]>([])
  

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  useEffect(() => {
    loadPublic()
  }, [])

  useEffect(() => {
    if (user) loadFriends()
  }, [user])

  async function loadPublic() {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('solves')
      .select(`
  user_id,
  solve_time,
  profiles ( username )
`)
      .eq('puzzle_date', today)
      .order('solve_time', { ascending: true })

    setPublicScores(data || [])
  }

  async function loadFriends() {
    const today = new Date().toISOString().split('T')[0]
  
    // 1️⃣ Get ALL relations involving current user
    const { data: allRelations } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
  
    setFriendRelations(allRelations || [])
    const incoming =
  allRelations?.filter(r =>
    r.receiver_id === user.id &&
    r.status === 'pending'
  ) || []

if (incoming.length > 0) {
  const senderIds = incoming.map(r => r.sender_id)

  const { data: senders } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', senderIds)

  const enriched = incoming.map(req => ({
    ...req,
    username: senders?.find(s => s.id === req.sender_id)?.username
  }))

  setIncomingRequests(enriched)
} else {
  setIncomingRequests([])
}
  
    // 2️⃣ Extract accepted ones only
    const accepted =
      allRelations?.filter(r => r.status === 'accepted') || []
  
    const friendIds =
      accepted.map(r =>
        r.sender_id === user.id
          ? r.receiver_id
          : r.sender_id
      )
  
    const ids = [user.id, ...friendIds]
  
    // 3️⃣ Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids)
  
    // 4️⃣ Get today solves
    const { data: solves } = await supabase
      .from('solves')
      .select('user_id, solve_time')
      .eq('puzzle_date', today)
      .in('user_id', ids)
  
    const merged = profiles?.map(profile => {
      const solve = solves?.find(s => s.user_id === profile.id)
      return {
        id: profile.id,
        username: profile.username,
        solve_time: solve?.solve_time ?? null
      }
    }) || []
  
    merged.sort((a, b) => {
      if (a.solve_time === null) return 1
      if (b.solve_time === null) return -1
      return a.solve_time - b.solve_time
    })
  
    setFriendScores(merged)
  }
  async function handleSearch() {
    if (!searchTerm.trim()) return
  
    setLoadingSearch(true)
  
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${searchTerm.toLowerCase()}%`)
  
    setSearchResults(
      data?.filter(p => p.id !== user.id) || []
    )
  
    setLoadingSearch(false)
  }

  async function sendFriendRequest(receiverId: string) {
    if (!user) return
  
    await supabase.from('friend_requests').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: 'pending'
    })
  
    await loadFriends()
  }

  async function acceptRequest(senderId: string) {
    if (!user) return
  
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
  
    await loadFriends()
  }
  async function removeFriend(friendId: string) {
    if (!user) return
  
    const confirmed = window.confirm(
      "Are you sure you want to remove this friend?"
    )
  
    if (!confirmed) return
  
    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      )
  
    await loadFriends()
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)
  .toString()
  .padStart(2,'0')}:${(s % 60)
  .toString()
  .padStart(2,'0')}`
  }

  return (
    <div className="max-w-xl mx-auto mt-20 font-serif text-neutral-900">

      <button
        onClick={() => router.push('/puzzle')}
        className="mb-4 text-sm underline"
      >
        ← Back to Puzzle
      </button>
      <h1 className="text-2xl mb-8 tracking-tight">
  Daily Malarkey Leaderboard
</h1>
      {/* Tabs */}
      <div className="flex justify-center gap-12 mb-10 text-sm tracking-wide uppercase">
  <button
    onClick={() => setTab(0)}
    className={`pb-1 border-b ${
      tab === 0
        ? 'border-black'
        : 'border-transparent text-neutral-400'
    }`}
  >
    Public
  </button>

  {user && (
    <button
      onClick={() => setTab(1)}
      className={`pb-1 border-b ${
        tab === 1
          ? 'border-black'
          : 'border-transparent text-neutral-400'
      }`}
    >
      Friends
      {incomingRequests.length > 0 && (
        <span className="ml-2 text-xs text-neutral-500">
          ({incomingRequests.length})
        </span>
      )}
    </button>
  )}
</div>

      {/* Public Leaderboard */}
      <div className="relative overflow-hidden w-full">

      <motion.div
  className="flex w-full"
  animate={{ x: tab === 0 ? 0 : '-50%' }}
    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    style={{ width: '200%' }}
  >

    {/* Public */}
    <div className="w-1/2 px-2">
      {publicScores.map((s, i) => (
        <div
        key={i}
        className={`flex justify-between py-3 border-t ${
          s.user_id === user?.id
            ? 'bg-neutral-200 font-medium'
            : ''
        }`}
      >
          <span>#{i + 1}</span>
          <span>{s.profiles?.username}</span>
          <span>{formatTime(s.solve_time)}</span>
        </div>
      ))}
    </div>

    {/* Friends */}
{/* Friends */}
<div className="w-1/2 px-2 space-y-4">
{/* 🔔 Pending Requests Section */}
{incomingRequests.length > 0 && (
    <div className="border-t pt-4">
    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
      Friend Requests
    </div>

      {incomingRequests.map(r => (
        <div
          key={r.sender_id}
          className="flex justify-between items-center"
        >
          <span>{r.username}</span>

          <button
            onClick={() => acceptRequest(r.sender_id)}
            className="bg-green-600 text-white px-2 py-1 rounded text-sm"
          >
            Accept
          </button>
        </div>
      ))}
    </div>
  )}

  {/* 🔎 Search */}
  <div className="flex gap-2">
    <input
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      placeholder="Search username..."
      className="border px-2 py-1 flex-1 rounded"
    />
    <button
      onClick={handleSearch}
      className="border border-black px-3 py-1 text-xs uppercase tracking-wide hover:bg-neutral-100"
    >
      Search
    </button>
  </div>

  {/* 🔍 Search Results */}
  {loadingSearch && <div>Searching...</div>}

  {searchResults.map(result => {
    const relation = friendRelations.find(r =>
      (r.sender_id === user.id && r.receiver_id === result.id) ||
      (r.sender_id === result.id && r.receiver_id === user.id)
    )

    const isAccepted = relation?.status === 'accepted'
    const isPendingSent =
      relation?.sender_id === user.id &&
      relation?.status === 'pending'
    const isPendingReceived =
      relation?.receiver_id === user.id &&
      relation?.status === 'pending'

    return (
      <div key={result.id} className="flex justify-between border p-2 rounded">

        <span>{result.username}</span>

        {isAccepted && (
          <span className="text-green-600 text-sm">
            Friends
          </span>
        )}

        {isPendingSent && (
          <span className="text-gray-500 text-sm">
            Request Sent
          </span>
        )}

        {isPendingReceived && (
          <button
            onClick={() => acceptRequest(result.id)}
            className="bg-green-600 text-white px-2 py-1 rounded text-sm"
          >
            Accept
          </button>
        )}

        {!relation && (
          <button
            onClick={() => sendFriendRequest(result.id)}
            className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
          >
            Add
          </button>
        )}

      </div>
    )
  })}

  {/* 🏆 Leaderboard List */}
  <div className="mt-6">
    {friendScores.map((s, i) => (
      <div
      key={s.id}
      className={`flex items-center py-3 border-t ${
        s.id === user.id
          ? 'bg-neutral-200 font-medium'
          : ''
      }`}
    >
      {/* Rank */}
      <span className="w-8 text-neutral-500">
        {i + 1}.
      </span>
    
      {/* Username */}
      <span
        className={`flex-1 ${
          s.id === user?.id ? 'italic' : ''
        }`}
      >
        {s.username}
      </span>
    
      {/* Time + Remove */}
      <div className="flex items-center gap-3 w-28 justify-end">
    
        {/* Time (fixed width for perfect alignment) */}
        <span className="tabular-nums w-16 text-right">
          {s.solve_time !== null
            ? formatTime(s.solve_time)
            : '—'}
        </span>
    
        {/* Remove slot ALWAYS exists */}
        <div className="w-6 flex justify-center">
          {s.id !== user?.id && (
            <button
              onClick={() => removeFriend(s.id)}
              className="w-4 h-4 flex items-center justify-center 
                         border border-neutral-300 rounded-full 
                         text-neutral-400 text-xs 
                         hover:border-red-900 hover:text-red-900 
                         transition"
              title="Remove friend"
            >
              ×
            </button>
          )}
        </div>
    
      </div>
    </div>
    ))}
  </div>
  {friendScores.length === 1 && (
  <div className="text-gray-500 text-sm">
    No friends yet — search above to add some.
  </div>
)}
</div>

  </motion.div>

</div>

    </div>
  )
}