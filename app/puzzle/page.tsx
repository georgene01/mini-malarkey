'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import Image from 'next/image'

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

type Puzzle = {
  grid: string[][]
  shaded?: boolean[][]
  circled?: boolean[][]
  clues: {
    across: Record<string, string>
    down: Record<string, string>
  }
  author: string
}

type Pos = { row: number; col: number }
type Direction = 'across' | 'down'

type NumberedCell = {
  number?: number
  startsAcross: boolean
  startsDown: boolean
}

/* ─────────────────────────────────────────────────────────────
   Pure utilities (outside component)
───────────────────────────────────────────────────────────── */

function generateNumbers(grid: string[][]): NumberedCell[][] {
  let count = 1
  const rows = grid.length
  const cols = grid[0].length
  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return { startsAcross: false, startsDown: false }
      const startsAcross =
        (c === 0 || row[c - 1] === '#') && c + 1 < cols && row[c + 1] !== '#'
      const startsDown =
        (r === 0 || grid[r - 1][c] === '#') && r + 1 < rows && grid[r + 1][c] !== '#'
      return {
        number: startsAcross || startsDown ? count++ : undefined,
        startsAcross,
        startsDown,
      }
    })
  )
}

function findStart(num: number, numbers: NumberedCell[][]): Pos {
  for (let r = 0; r < numbers.length; r++)
    for (let c = 0; c < numbers[r].length; c++)
      if (numbers[r][c].number === num) return { row: r, col: c }
  return { row: 0, col: 0 }
}

function getAvailableDirections(row: number, col: number, puzzle: Puzzle) {
  const rows = puzzle.grid.length
  const cols = puzzle.grid[0].length
  const isBlk = (r: number, c: number) =>
    r < 0 || c < 0 || r >= rows || c >= cols || puzzle.grid[r][c] === '#'
  return {
    across: !isBlk(row, col - 1) || !isBlk(row, col + 1),
    down: !isBlk(row - 1, col) || !isBlk(row + 1, col),
  }
}

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60)
    .toString()
    .padStart(2, '0')}`
}

/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */

export default function PuzzlePage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [userGrid, setUserGrid] = useState<string[][]>([])
  const [numbers, setNumbers] = useState<NumberedCell[][]>([])
  const [active, setActive] = useState<Pos>({ row: 0, col: 0 })
  const [direction, setDirection] = useState<Direction>('across')
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isReplayMode, setIsReplayMode] = useState(false)
  const [almostMessage, setAlmostMessage] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showChickenSplash, setShowChickenSplash] = useState(false)
  const [startWipe, setStartWipe] = useState(false)
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const timerRef = useRef<number | null>(null)
  const secondsRef = useRef(0)
  const inputs = useRef<(HTMLInputElement | null)[][]>([])
  const router = useRouter()

  /* ── Auth ──────────────────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) =>
      setUser(data.session?.user ?? null)
    )
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setUsername(data.username) })
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (!data) router.push('/choose-username') })
  }, [user])

  /* ── Responsive ──────────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Load puzzle ─────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/today')
      .then(r => r.json())
      .then(data => {
        if (data.error) return
        setPuzzle(data)
        setUserGrid(
          data.grid.map((row: string[]) =>
            row.map((c: string) => (c === '#' ? '#' : ''))
          )
        )
        setNumbers(generateNumbers(data.grid))
        inputs.current = data.grid.map((row: string[]) => row.map(() => null))
      })
  }, [])

  /* ── Check existing solve ────────────────────────────── */
  useEffect(() => {
    if (!user || !puzzle) return
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('solves')
      .select('solve_time')
      .eq('user_id', user.id)
      .eq('puzzle_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data && puzzle) {
          secondsRef.current = data.solve_time
          setSeconds(data.solve_time)
          setIsComplete(true)
          setTimerRunning(false)
          setUserGrid(
            puzzle.grid.map(row => row.map(c => (c === '#' ? '#' : c)))
          )
        }
      })
  }, [user, puzzle])

  /* ── Timer ───────────────────────────────────────────── */
  useEffect(() => {
    if (timerRunning && !isComplete) {
      timerRef.current = window.setInterval(() => {
        setSeconds(s => {
          const next = s + 1
          secondsRef.current = next
          return next
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning, isComplete])

  /* ── Focus desktop inputs ────────────────────────────── */
  useEffect(() => {
    if (isMobile) return
    const el = inputs.current?.[active.row]?.[active.col]
    if (el) {
      el.focus()
      el.setSelectionRange(0, el.value.length)
    }
  }, [active, isMobile])

  /* ── Pre-load chicken ────────────────────────────────── */
  useEffect(() => {
    const img = document.createElement('img')
    img.src = '/chicken.png'
  }, [])

  /* ── Loading state ───────────────────────────────────── */
  if (!puzzle) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-neutral-400 text-sm tracking-widest uppercase animate-pulse">
          Loading…
        </div>
      </div>
    )
  }

  const rows = puzzle.grid.length
  const cols = puzzle.grid[0].length

  /* ─────────────────────────────────────────────────────────
     Grid helpers (use puzzle/rows/cols from outer scope)
  ───────────────────────────────────────────────────────── */

  const isBlack = (r: number, c: number) =>
    r < 0 || c < 0 || r >= rows || c >= cols || puzzle.grid[r][c] === '#'

  const getWordStart = (pos: Pos, dir: Direction): Pos => {
    let { row: r, col: c } = pos
    while (true) {
      const pr = dir === 'across' ? r : r - 1
      const pc = dir === 'across' ? c - 1 : c
      if (isBlack(pr, pc)) break
      dir === 'across' ? c-- : r--
    }
    return { row: r, col: c }
  }

  const getWordCells = (start: Pos, dir: Direction): Pos[] => {
    const cells: Pos[] = []
    let { row: r, col: c } = start
    while (!isBlack(r, c)) {
      cells.push({ row: r, col: c })
      dir === 'across' ? c++ : r++
    }
    return cells
  }

  const collectClues = (dir: Direction): { num: number; pos: Pos }[] => {
    const list: { num: number; pos: Pos }[] = []
    for (let r = 0; r < numbers.length; r++)
      for (let c = 0; c < numbers[r].length; c++) {
        const cell = numbers[r][c]
        if (!cell?.number) continue
        if (dir === 'across' ? cell.startsAcross : cell.startsDown)
          list.push({ num: cell.number, pos: { row: r, col: c } })
      }
    return list
  }

  const moveForward = (
    pos: Pos,
    dir: Direction,
    grid: string[][],
    wasEmpty: boolean
  ): Pos | null => {
    const start = getWordStart(pos, dir)
    const cells = getWordCells(start, dir)
    const idx = cells.findIndex(p => p.row === pos.row && p.col === pos.col)

    if (wasEmpty) {
      for (let i = idx + 1; i < cells.length; i++)
        if (!grid[cells[i].row][cells[i].col]) return cells[i]
      for (let i = 0; i < cells.length; i++)
        if (!grid[cells[i].row][cells[i].col]) return cells[i]
      return null
    }
    return idx < cells.length - 1 ? cells[idx + 1] : null
  }

  const getNextClueStart = (
    grid: string[][],
    wordStart: Pos,
    dir: Direction
  ): { pos: Pos; newDir: Direction } | null => {
    const clues = collectClues(dir)
    const currentNum = numbers[wordStart.row]?.[wordStart.col]?.number
    const idx = clues.findIndex(c => c.num === currentNum)

    if (idx !== -1 && idx < clues.length - 1) {
      const next = clues[idx + 1]
      const cells = getWordCells(next.pos, dir)
      const firstEmpty = cells.find(p => !grid[p.row][p.col])
      return { pos: firstEmpty ?? cells[0], newDir: dir }
    }

    const opp: Direction = dir === 'across' ? 'down' : 'across'
    const oppClues = collectClues(opp)
    for (const clue of oppClues) {
      const cells = getWordCells(clue.pos, opp)
      const firstEmpty = cells.find(p => !grid[p.row][p.col])
      if (firstEmpty) return { pos: firstEmpty, newDir: opp }
    }
    if (oppClues.length) {
      return { pos: getWordCells(oppClues[0].pos, opp)[0], newDir: opp }
    }
    return null
  }

  const getPreviousClueEnd = (wordStart: Pos, dir: Direction): Pos | null => {
    const clues = collectClues(dir)
    const currentNum = numbers[wordStart.row]?.[wordStart.col]?.number
    const idx = clues.findIndex(c => c.num === currentNum)

    if (idx > 0) {
      const cells = getWordCells(clues[idx - 1].pos, dir)
      return cells[cells.length - 1]
    }
    const opp: Direction = dir === 'across' ? 'down' : 'across'
    const oppClues = collectClues(opp)
    if (!oppClues.length) return null
    const cells = getWordCells(oppClues[oppClues.length - 1].pos, opp)
    return cells[cells.length - 1]
  }

  const isAllFilled = (grid: string[][]) =>
    grid.every((row, r) =>
      row.every((cell, c) => (puzzle.grid[r][c] === '#' ? true : cell !== ''))
    )

  const checkSolution = (grid: string[][]) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (puzzle.grid[r][c] === '#') continue
        if (grid[r][c] !== puzzle.grid[r][c]) return false
      }
    return true
  }

  /* ─────────────────────────────────────────────────────────
     Completion
  ───────────────────────────────────────────────────────── */

  async function triggerCompletion() {
    setIsComplete(true)
    setTimerRunning(false)

    const today = new Date().toISOString().split('T')[0]
    if (user && !isReplayMode) {
      const { data: existing } = await supabase
        .from('solves')
        .select('id')
        .eq('user_id', user.id)
        .eq('puzzle_date', today)
        .maybeSingle()

      if (!existing) {
        await supabase.from('solves').insert({
          user_id: user.id,
          puzzle_date: today,
          solve_time: secondsRef.current,
        })
      }
    }

    setShowChickenSplash(true)
    setTimeout(() => setStartWipe(true), 350)
    setTimeout(() => {
      setShowChickenSplash(false)
      setShowCompletionOverlay(true)
    }, 2000)
  }

  /* ─────────────────────────────────────────────────────────
     Replay
  ───────────────────────────────────────────────────────── */

  function handleReplay() {
    if (!puzzle) return
    setIsReplayMode(true)
    setIsComplete(false)
    setSeconds(0)
    secondsRef.current = 0
    setTimerRunning(false)
    setShowCompletionOverlay(false)
    setAlmostMessage(null)
    setActive({ row: 0, col: 0 })
    setDirection('across')
    setUserGrid(puzzle.grid.map(row => row.map(c => (c === '#' ? '#' : ''))))
  }

  /* ─────────────────────────────────────────────────────────
     Backspace (shared by desktop keyboard & mobile key)
  ───────────────────────────────────────────────────────── */

  function performBackspace(r: number, c: number) {
    if (isComplete && !isReplayMode) return
    const g = structuredClone(userGrid) as string[][]
    const wordStart = getWordStart({ row: r, col: c }, direction)
    const cells = getWordCells(wordStart, direction)
    const idx = cells.findIndex(p => p.row === r && p.col === c)

    if (g[r][c]) {
      g[r][c] = ''
      setUserGrid(g)
    } else if (idx > 0) {
      const prev = cells[idx - 1]
      g[prev.row][prev.col] = ''
      setUserGrid(g)
      setActive(prev)
    } else {
      const prevEnd = getPreviousClueEnd(wordStart, direction)
      if (prevEnd) setActive(prevEnd)
    }
  }

  /* ─────────────────────────────────────────────────────────
     Cell tap (toggles direction on re-tap — NYT behaviour)
  ───────────────────────────────────────────────────────── */

  function handleCellTap(r: number, c: number) {
    if (!puzzle) return
    if (puzzle.grid[r][c] === '#') return
    const isSameCell = active.row === r && active.col === c
    const { across, down } = getAvailableDirections(r, c, puzzle)

    if (isSameCell) {
      if (across && down) setDirection(d => (d === 'across' ? 'down' : 'across'))
    } else {
      if (across && !down) setDirection('across')
      else if (!across && down) setDirection('down')
    }
    setActive({ row: r, col: c })
  }

  /* ─────────────────────────────────────────────────────────
     Keyboard handlers
  ───────────────────────────────────────────────────────── */

  async function handleChange(r: number, c: number, raw: string) {
    if (isComplete && !isReplayMode) return
    const letter = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
    if (!letter) return
    if (!timerRunning) setTimerRunning(true)

    const g = structuredClone(userGrid) as string[][]
    const wasEmpty = !g[r][c]
    const wordStart = getWordStart({ row: r, col: c }, direction)

    g[r][c] = letter
    setUserGrid(g)
    setAlmostMessage(null)

    const next = moveForward({ row: r, col: c }, direction, g, wasEmpty)
    if (next) {
      setActive(next)
    } else {
      const jump = getNextClueStart(g, wordStart, direction)
      if (jump) {
        setActive(jump.pos)
        setDirection(jump.newDir)
      }
    }

    if (isAllFilled(g)) {
      if (checkSolution(g)) {
        await triggerCompletion()
      } else {
        setAlmostMessage("Almost! Check your answers — something isn't quite right.")
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, r: number, c: number) {
    if (isComplete && !isReplayMode) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      performBackspace(r, c)
      return
    }

    if (e.key === ' ') {
      e.preventDefault()
      setDirection(d => (d === 'across' ? 'down' : 'across'))
      return
    }

    if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      const { row: nr, col: nc } = active

      if (e.key === 'ArrowRight') {
        if (direction === 'across') {
          let nc2 = nc + 1
          while (nc2 < cols && isBlack(nr, nc2)) nc2++
          if (nc2 < cols) setActive({ row: nr, col: nc2 })
        } else { setDirection('across') }

      } else if (e.key === 'ArrowLeft') {
        if (direction === 'across') {
          let nc2 = nc - 1
          while (nc2 >= 0 && isBlack(nr, nc2)) nc2--
          if (nc2 >= 0) setActive({ row: nr, col: nc2 })
        } else { setDirection('across') }

      } else if (e.key === 'ArrowDown') {
        if (direction === 'down') {
          let nr2 = nr + 1
          while (nr2 < rows && isBlack(nr2, nc)) nr2++
          if (nr2 < rows) setActive({ row: nr2, col: nc })
        } else { setDirection('down') }

      } else if (e.key === 'ArrowUp') {
        if (direction === 'down') {
          let nr2 = nr - 1
          while (nr2 >= 0 && isBlack(nr2, nc)) nr2--
          if (nr2 >= 0) setActive({ row: nr2, col: nc })
        } else { setDirection('down') }
      }
    }
  }

  /* Mobile keyboard */
  function handleMobileKey(letter: string) {
    handleChange(active.row, active.col, letter)
  }

  function handleMobileBackspace() {
    performBackspace(active.row, active.col)
  }

  /* ─────────────────────────────────────────────────────────
     Derived clue values
  ───────────────────────────────────────────────────────── */

  const activeWord = getWordCells(getWordStart(active, direction), direction)
  const activeStart = getWordStart(active, direction)
  const activeClueNumber = numbers[activeStart.row]?.[activeStart.col]?.number

  const acrossClues = Object.entries(puzzle.clues.across)
    .map(([num, clue]) => ({ num: Number(num), clue }))
    .sort((a, b) => a.num - b.num)

  const downClues = Object.entries(puzzle.clues.down)
    .map(([num, clue]) => ({ num: Number(num), clue }))
    .sort((a, b) => a.num - b.num)

  const activeClueList = direction === 'across' ? acrossClues : downClues
  const activeClueIdx = activeClueList.findIndex(c => c.num === activeClueNumber)
  const activeClueText = activeClueIdx !== -1 ? activeClueList[activeClueIdx].clue : ''

  function goToClueByIndex(index: number) {
    let newDir = direction
    let clues = activeClueList
    if (index < 0) {
      newDir = direction === 'across' ? 'down' : 'across'
      clues = newDir === 'across' ? acrossClues : downClues
      index = clues.length - 1
    } else if (index >= clues.length) {
      newDir = direction === 'across' ? 'down' : 'across'
      clues = newDir === 'across' ? acrossClues : downClues
      index = 0
    }
    const clue = clues[index]
    if (!clue) return
    setDirection(newDir)
    setActive(findStart(clue.num, numbers))
  }

  /* ─────────────────────────────────────────────────────────
     Cell renderer
  ───────────────────────────────────────────────────────── */

  function renderCell(r: number, c: number, forMobile: boolean) {
    if (!puzzle) return null
    const cell = puzzle.grid[r][c]
    const inWord = activeWord.some(p => p.row === r && p.col === c)
    const isActive = active.row === r && active.col === c
    const isShaded = puzzle.shaded?.[r]?.[c]
    const isCircled = puzzle.circled?.[r]?.[c]
    const num = numbers[r]?.[c]?.number

    if (cell === '#') {
      return <div key={`${r}-${c}`} className="aspect-square bg-neutral-900" />
    }

    const bgClass = isActive
      ? 'bg-red-300'
      : inWord
      ? 'bg-red-100'
      : isShaded
      ? 'bg-neutral-300'
      : 'bg-white'

    return (
      <div
        key={`${r}-${c}`}
        className={`relative aspect-square border border-neutral-400 ${bgClass} overflow-hidden`}
        onClick={forMobile ? () => handleCellTap(r, c) : undefined}
      >
        {/* Clue number */}
        {num !== undefined && (
          <span
            className="absolute top-px left-px font-semibold leading-none select-none text-neutral-700 pointer-events-none z-10"
            style={{ fontSize: 'clamp(7px, 1.8vw, 10px)' }}
          >
            {num}
          </span>
        )}

        {/* Circle overlay */}
        {isCircled && (
          <div
            className="absolute rounded-full border border-neutral-600 pointer-events-none z-20"
            style={{ inset: '2px' }}
          />
        )}

        {forMobile ? (
          <div
            className="w-full h-full flex items-center justify-center font-bold select-none text-neutral-900 pointer-events-none"
            style={{ fontSize: 'clamp(15px, 5.5vw, 26px)' }}
          >
            {userGrid[r][c]}
          </div>
        ) : (
          <input
            ref={el => { if (inputs.current[r]) inputs.current[r][c] = el }}
            value={userGrid[r][c]}
            onChange={e => handleChange(r, c, e.target.value)}
            onKeyDown={e => handleKeyDown(e, r, c)}
            onMouseDown={e => {
              // Fires BEFORE focus so `active` still holds the previous cell.
              // Prevent the browser's default focus so we can control it ourselves.
              e.preventDefault()
              handleCellTap(r, c)
            }}
            disabled={isComplete && !isReplayMode}
            maxLength={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full h-full text-center font-bold uppercase outline-none bg-transparent text-neutral-900 cursor-default"
            style={{ fontSize: 'clamp(13px, 2.8vw, 22px)' }}
          />
        )}
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────
     Chicken splash
  ───────────────────────────────────────────────────────── */

  if (showChickenSplash) {
    return (
      <div className="fixed inset-0 z-[90] overflow-hidden bg-white">
        <Image
          src="/chicken.png"
          alt="Solved!"
          fill
          priority
          className={`object-cover ${startWipe ? 'animate-wipe-out' : ''}`}
        />
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────
     Completion overlay
  ───────────────────────────────────────────────────────── */

  if (showCompletionOverlay) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm w-full">
          <img
            src="/logo.png"
            alt="Daily Malarkey"
            className="w-14 h-14 mx-auto object-contain"
          />
          <div>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">
              Daily Malarkey
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Puzzle Solved!</h1>
          </div>

          <div className="border border-neutral-200 rounded-2xl px-8 py-6 bg-neutral-50">
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
              Your time
            </div>
            <div className="text-6xl font-mono font-light tabular-nums text-neutral-900">
              {formatTime(seconds)}
            </div>
            {isReplayMode && (
              <div className="text-xs text-neutral-400 mt-2">Replay — unranked</div>
            )}
          </div>

          {puzzle.author && (
            <p className="text-sm text-neutral-500">
              Written by{' '}
              <span className="font-semibold text-neutral-800">{puzzle.author}</span>
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => router.push('/leaderboard')}
              className="w-full bg-neutral-900 text-white py-3 rounded-xl text-sm uppercase tracking-widest hover:bg-black transition"
            >
              View Leaderboard
            </button>
            <button
              onClick={handleReplay}
              className="w-full border border-neutral-300 py-3 rounded-xl text-sm uppercase tracking-widest hover:bg-neutral-50 transition"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────
     MOBILE layout
  ───────────────────────────────────────────────────────── */

  if (isMobile) {
    return (
      <div
        className="flex flex-col bg-white overflow-hidden"
        style={{ height: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 leading-none">
              Daily Malarkey
            </div>
            <h1 className="text-[17px] font-bold leading-tight">The Mini Malarkey</h1>
          </div>
          <div className="flex items-center gap-3">
            {isComplete && !isReplayMode && (
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                ✓ Solved
              </span>
            )}
            <span className="font-mono text-[17px] tabular-nums">{formatTime(seconds)}</span>
            {isComplete && (
              <button
                onClick={handleReplay}
                className="text-[11px] border border-neutral-300 px-2 py-1 rounded-lg text-neutral-600"
              >
                Replay
              </button>
            )}
          </div>
        </div>

        {/* Almost message */}
        {almostMessage && (
          <div className="px-4 py-1.5 shrink-0">
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-center font-medium">
              {almostMessage}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '2px',
              width: `min(calc(100vw - 1rem), calc(100dvh - 19rem))`,
              aspectRatio: `${cols} / ${rows}`,
            }}
          >
            {puzzle.grid.map((row, r) =>
              row.map((_, c) => renderCell(r, c, true))
            )}
          </div>
        </div>

        {/* Clue bar — sits directly above keyboard (NYT style) */}
        <div className="flex items-center shrink-0 border-t border-b border-neutral-200 bg-[#c9e3fa]"
          style={{ minHeight: '56px' }}>
          <button
            onPointerDown={e => { e.preventDefault(); goToClueByIndex(activeClueIdx - 1) }}
            className="px-3 py-2 text-neutral-700 text-2xl font-light select-none active:bg-[#a9d0ee] transition shrink-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            ‹
          </button>

          <div
            className="flex-1 px-1 py-2 text-center select-none"
            onPointerDown={e => {
              e.preventDefault()
              const { across, down } = getAvailableDirections(active.row, active.col, puzzle)
              if (across && down) setDirection(d => d === 'across' ? 'down' : 'across')
            }}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="text-[14px] font-semibold text-neutral-900 leading-snug"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {activeClueText}
            </div>
          </div>

          <button
            onPointerDown={e => { e.preventDefault(); goToClueByIndex(activeClueIdx + 1) }}
            className="px-3 py-2 text-neutral-700 text-2xl font-light select-none active:bg-[#a9d0ee] transition shrink-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            ›
          </button>
        </div>

        {/* Virtual keyboard */}
        <div
          className="shrink-0 bg-[#aab4bd] pt-[6px] pb-[6px] px-[3px]"
          style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
        >
          {/* Row 1: QWERTYUIOP */}
          <div className="flex gap-[4px] mb-[5px]">
            {'QWERTYUIOP'.split('').map(k => (
              <button
                key={k}
                onPointerDown={e => { e.preventDefault(); handleMobileKey(k) }}
                className="flex-1 bg-white rounded-[6px] font-medium text-neutral-900 select-none"
                style={{
                  height: '43px',
                  fontSize: '16px',
                  boxShadow: '0 1px 0 1px #717d85',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Row 2: ASDFGHJKL */}
          <div className="flex gap-[4px] mb-[5px] px-[5%]">
            {'ASDFGHJKL'.split('').map(k => (
              <button
                key={k}
                onPointerDown={e => { e.preventDefault(); handleMobileKey(k) }}
                className="flex-1 bg-white rounded-[6px] font-medium text-neutral-900 select-none"
                style={{
                  height: '43px',
                  fontSize: '16px',
                  boxShadow: '0 1px 0 1px #717d85',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Row 3: ZXCVBNM + ⌫ */}
          <div className="flex gap-[4px] px-[2%]">
            {'ZXCVBNM'.split('').map(k => (
              <button
                key={k}
                onPointerDown={e => { e.preventDefault(); handleMobileKey(k) }}
                className="flex-1 bg-white rounded-[6px] font-medium text-neutral-900 select-none"
                style={{
                  height: '43px',
                  fontSize: '16px',
                  boxShadow: '0 1px 0 1px #717d85',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {k}
              </button>
            ))}
            <button
              onPointerDown={e => { e.preventDefault(); handleMobileBackspace() }}
              className="bg-[#8e979e] rounded-[6px] text-neutral-800 select-none flex items-center justify-center"
              style={{
                height: '43px',
                minWidth: '44px',
                width: '44px',
                fontSize: '19px',
                boxShadow: '0 1px 0 1px #717d85',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label="Backspace"
            >
              ⌫
            </button>
          </div>
        </div>

      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────
     DESKTOP layout
  ───────────────────────────────────────────────────────── */

  return (
    <main className="h-screen flex flex-col bg-white overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-neutral-200 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Daily Malarkey" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Daily Malarkey
            </div>
            <h1 className="text-xl font-bold tracking-tight">The Mini Malarkey</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user && username && (
            <span className="text-sm text-neutral-500">
              Welcome,{' '}
              <span className="font-semibold text-neutral-800">{username}</span>
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-neutral-400">Time</span>
            <span className="font-mono text-xl tabular-nums">{formatTime(seconds)}</span>
          </div>
          {isComplete && !isReplayMode && (
            <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
              ✓ Solved
            </span>
          )}
          {isReplayMode && (
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Replay</span>
          )}
          {isComplete && (
            <button
              onClick={handleReplay}
              className="flex items-center gap-1.5 border border-neutral-300 px-3 py-1.5 text-sm rounded-lg hover:bg-neutral-50 transition"
            >
              <RotateCcw size={13} />
              Replay
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Puzzle centre */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div className="flex flex-col items-center gap-4 w-full max-w-[480px]">

            {almostMessage && (
              <div className="w-full border border-red-200 bg-red-50 px-4 py-3 rounded-xl text-sm text-red-800">
                <span className="font-bold uppercase tracking-wide">Almost. </span>
                {almostMessage}
              </div>
            )}

            <div
              className="grid w-full"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2px' }}
            >
              {puzzle.grid.map((row, r) =>
                row.map((_, c) => renderCell(r, c, false))
              )}
            </div>

          </div>
        </div>

        {/* Clue sidebar */}
        <aside className="w-72 shrink-0 border-l border-neutral-200 overflow-y-auto py-6 px-5">

          <div className="mb-8">
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-neutral-500 mb-3 pb-2 border-b border-neutral-200">
              Across
            </h2>
            {acrossClues.map(({ num, clue }) => {
              const isAct = direction === 'across' && activeClueNumber === num
              return (
                <div
                  key={num}
                  onClick={() => { setDirection('across'); setActive(findStart(num, numbers)) }}
                  className={`flex gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm mb-0.5 leading-snug transition-colors ${
                    isAct
                      ? 'bg-red-100 text-red-900 font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span className="shrink-0 font-semibold text-neutral-400 w-5 text-right tabular-nums">
                    {num}.
                  </span>
                  <span>{clue}</span>
                </div>
              )
            })}
          </div>

          <div>
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-neutral-500 mb-3 pb-2 border-b border-neutral-200">
              Down
            </h2>
            {downClues.map(({ num, clue }) => {
              const isAct = direction === 'down' && activeClueNumber === num
              return (
                <div
                  key={num}
                  onClick={() => { setDirection('down'); setActive(findStart(num, numbers)) }}
                  className={`flex gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm mb-0.5 leading-snug transition-colors ${
                    isAct
                      ? 'bg-red-100 text-red-900 font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span className="shrink-0 font-semibold text-neutral-400 w-5 text-right tabular-nums">
                    {num}.
                  </span>
                  <span>{clue}</span>
                </div>
              )
            })}
          </div>

        </aside>
      </div>

      {/* Leaderboard button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => router.push('/leaderboard')}
          className="border border-neutral-300 bg-white/95 backdrop-blur-sm px-6 py-2 text-xs uppercase tracking-widest hover:bg-neutral-50 rounded-full shadow-sm transition"
        >
          Leaderboard
        </button>
      </div>

    </main>
  )
}
