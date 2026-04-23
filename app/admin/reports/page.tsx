'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'
import { isAdminEmail } from '@/src/lib/admin'

type Report = {
  id: string
  reporter_id: string | null
  reported_user_id: string
  reported_username: string
  reason: string
  status: string
  created_at: string
  reporter_username?: string
  current_username?: string
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  async function checkAuthAndLoad() {
    const { data } = await supabase.auth.getUser()
    const email = data.user?.email

    if (!isAdminEmail(email)) {
      setAuthorized(false)
      setLoading(false)
      return
    }

    setAuthorized(true)
    await loadReports()
    setLoading(false)
  }

  async function loadReports() {
    const { data: rawReports, error } = await supabase
      .from('username_reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Failed to load reports: ' + error.message)
      return
    }

    const list = rawReports || []
    const ids = Array.from(
      new Set(
        list.flatMap((r: any) => [r.reporter_id, r.reported_user_id]).filter(Boolean)
      )
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids)

    const byId = new Map((profiles || []).map(p => [p.id, p.username]))

    setReports(
      list.map((r: any) => ({
        ...r,
        reporter_username: r.reporter_id ? byId.get(r.reporter_id) || '(unknown)' : '(deleted)',
        current_username: byId.get(r.reported_user_id) || '(deleted)',
      }))
    )
  }

  async function renameUser(r: Report) {
    const newName = prompt(
      `Current username: ${r.current_username}\n\nEnter a replacement username (e.g. "user_${r.reported_user_id.slice(0, 6)}"):`,
      `user_${r.reported_user_id.slice(0, 6)}`
    )
    if (!newName || !newName.trim()) return

    setActing(r.id)
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ username: newName.trim().toLowerCase() })
      .eq('id', r.reported_user_id)

    if (profErr) {
      setActing(null)
      alert('Rename failed: ' + profErr.message)
      return
    }

    await supabase
      .from('username_reports')
      .update({ status: 'actioned' })
      .eq('reported_user_id', r.reported_user_id)
      .eq('status', 'pending')

    setActing(null)
    await loadReports()
  }

  async function dismiss(r: Report) {
    if (!confirm('Dismiss this report (mark as "not offensive")?')) return
    setActing(r.id)
    const { error } = await supabase
      .from('username_reports')
      .update({ status: 'dismissed' })
      .eq('id', r.id)
    setActing(null)
    if (error) {
      alert('Dismiss failed: ' + error.message)
      return
    }
    await loadReports()
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading…</div>
      </main>
    )
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold mb-3">Not Authorized</h1>
        <p className="text-neutral-600 text-sm mb-6">
          This page is for admins only.
        </p>
        <button
          onClick={() => router.push('/puzzle')}
          className="border border-neutral-900 px-6 py-2 text-sm uppercase tracking-wide hover:bg-neutral-100"
        >
          Back to Puzzle
        </button>
      </main>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-6 md:pt-16 font-serif text-neutral-900">
      <button
        onClick={() => router.push('/puzzle')}
        className="mb-4 text-sm underline"
      >
        ← Back to Puzzle
      </button>

      <h1 className="text-xl md:text-2xl mb-2 tracking-tight">
        Username Reports
      </h1>
      <div className="text-sm text-neutral-500 mb-6">
        {reports.length} pending
      </div>

      {reports.length === 0 && (
        <div className="text-neutral-500 text-sm border-t pt-4">
          No pending reports. Nice and clean.
        </div>
      )}

      <div className="space-y-4">
        {reports.map(r => (
          <div
            key={r.id}
            className="border border-neutral-300 p-4 bg-white"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
                  Reported username
                </div>
                <div className="text-lg font-semibold">
                  {r.current_username}
                  {r.current_username !== r.reported_username && (
                    <span className="text-sm text-neutral-500 ml-2">
                      (was "{r.reported_username}" when reported)
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-neutral-400 text-right">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>

            <div className="text-sm text-neutral-700 mb-3">
              <span className="text-neutral-500">Reason: </span>
              {r.reason}
            </div>

            <div className="text-xs text-neutral-500 mb-4">
              Reported by: {r.reporter_username}
            </div>

            <div className="flex gap-2">
              <button
                disabled={acting === r.id}
                onClick={() => renameUser(r)}
                className="px-4 py-2 text-sm uppercase tracking-wide bg-red-900 text-white hover:bg-red-800 disabled:opacity-50"
              >
                Rename user
              </button>
              <button
                disabled={acting === r.id}
                onClick={() => dismiss(r)}
                className="px-4 py-2 text-sm uppercase tracking-wide border border-neutral-400 hover:bg-neutral-100 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
