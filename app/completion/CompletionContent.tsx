'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function CompletionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const timeParam = searchParams.get('time')
  const authorParam = searchParams.get('author')

  const author = authorParam
    ? decodeURIComponent(authorParam)
    : null

  const time = timeParam ? Number(timeParam) : null

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60)
      .toString()
      .padStart(2, '0')}`
  }

  if (!time) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg font-semibold">
          Invalid completion state.
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-4 mb-14">
        <img
          src="/logo.png"
          alt="Daily Malarkey"
          className="w-14 h-14 object-contain"
        />
        <div>
          <div className="text-sm tracking-[0.25em] uppercase text-neutral-500">
            Daily Malarkey
          </div>
          <div className="text-2xl font-bold">
            The Mini Crossword
          </div>
        </div>
      </div>

      <div className="w-full max-w-md border border-neutral-300 bg-white p-10 text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Puzzle Completed
        </h1>

        <div className="text-5xl font-mono text-red-900">
          {formatTime(time)}
        </div>

        <div className="w-16 h-px bg-neutral-300 mx-auto"></div>

        {author && (
          <div className="text-sm text-neutral-600 italic">
            Written by{' '}
            <span className="not-italic font-medium text-red-900">
              {author}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 pt-2">
          <button
            onClick={() => router.push('/leaderboard')}
            className="w-full bg-neutral-900 text-white py-3 text-sm uppercase tracking-wide hover:bg-black transition"
          >
            View Leaderboard
          </button>

          <button
            onClick={() => router.push('/puzzle')}
            className="w-full border border-neutral-900 py-3 text-sm uppercase tracking-wide hover:bg-neutral-100 transition"
          >
            Return to Puzzle
          </button>
        </div>
      </div>
    </main>
  )
}