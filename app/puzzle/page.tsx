'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import Image from 'next/image'

type Puzzle = {
  grid: string[][]
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

type Score = { time: number; date: string }

export default function HomePage() {

  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [userGrid, setUserGrid] = useState<string[][]>([])
  const [numbers, setNumbers] = useState<NumberedCell[][]>([])
  const [active, setActive] = useState<Pos>({ row: 0, col: 0 })
  const [direction, setDirection] = useState<Direction>('across')

  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  const [username, setUsername] = useState<string | null>(null)

  const [isReplayMode, setIsReplayMode] = useState(false)

  const [showChickenSplash, setShowChickenSplash] = useState(false)
  const [startWipe, setStartWipe] = useState(false)
  
  const [isComplete, setIsComplete] = useState(false)
  const [almostMessage, setAlmostMessage] = useState<string | null>(null)

  const [seconds, setSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<number | null>(null)

  const inputs = useRef<(HTMLInputElement | null)[][]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
  
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )
  
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768)
    }
  
    check()
    window.addEventListener('resize', check)
  
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
  
    const img = document.createElement('img')
    img.src = '/chicken.png'
  }, [])

  useEffect(() => {
    setShowChickenSplash(false)
    setStartWipe(false)
  }, [])

  useEffect(() => {
    if (!user) return
  
    async function loadUsername() {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
  
      if (data) setUsername(data.username)
    }
  
    loadUsername()
  }, [user])

  useEffect(() => {
    async function checkProfile() {
      if (!user) return
  
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()
  
      if (!data) {
        router.push('/choose-username')
      }
    }
  
    checkProfile()
  }, [user])


  useEffect(() => {
    if (!user || !puzzle) return
  
    const currentPuzzle = puzzle
  
    async function checkExistingSolve() {
      const today = new Date().toISOString().split('T')[0]
  
      const { data } = await supabase
        .from('solves')
        .select('solve_time')
        .eq('user_id', user.id)
        .eq('puzzle_date', today)
        .maybeSingle()
  
      if (data && currentPuzzle) {
        setSeconds(data.solve_time)
        setIsComplete(true)
        setTimerRunning(false)
  
        // Restore solved grid safely
        setUserGrid(
          currentPuzzle.grid.map(row =>
            row.map(c => (c === '#' ? '#' : c))
          )
        )
      }
    }
  
    checkExistingSolve()
  }, [user, puzzle])

  /* ================= LOAD ================= */

  useEffect(() => {
    fetch('/api/today')
      .then(r => r.json())
      .then(data => {
        setPuzzle(data)
        setUserGrid(
          data.grid.map((row: string[]) =>
            row.map(c => (c === '#' ? '#' : ''))
          )
        )
        setNumbers(generateNumbers(data.grid))
        inputs.current = Array.from(
          { length: data.grid.length },
          () => Array(data.grid[0].length).fill(null)
        )
      })
  }, [])

  useEffect(() => {
    const el = inputs.current?.[active.row]?.[active.col]
    if (el) {
      el.focus()
  
      // Select entire content so typing replaces it
      const length = el.value.length
      el.setSelectionRange(0, length)
    }
  }, [active])

  useEffect(() => {
    if (timerRunning && !isComplete) {
      timerRef.current = window.setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning, isComplete])

  if (!puzzle) return null
  const rows = puzzle.grid.length
  const cols = puzzle.grid[0].length

  /* ================= CORE HELPERS ================= */

  const isBlack = (r: number, c: number) =>
    r < 0 || c < 0 || r >= rows || c >= cols || puzzle.grid[r][c] === '#'

  const getWordStart = (pos: Pos, dir: Direction) => {
    let { row: r, col: c } = pos
    while (true) {
      const prevR = dir === 'across' ? r : r - 1
      const prevC = dir === 'across' ? c - 1 : c
      if (isBlack(prevR, prevC)) break
      dir === 'across' ? c-- : r--
    }
    return { row: r, col: c }
  }

  const getPreviousClueEnd = (
    grid: string[][],
    wordStart: Pos,
    dir: Direction
  ) => {
    const collectClues = (directionToCollect: Direction) => {
      const list: { num: number; pos: Pos }[] = []
  
      for (let r = 0; r < numbers.length; r++) {
        for (let c = 0; c < numbers[r].length; c++) {
          const cell = numbers[r][c]
          if (!cell.number) continue
  
          if (
            (directionToCollect === 'across' && cell.startsAcross) ||
            (directionToCollect === 'down' && cell.startsDown)
          ) {
            list.push({
              num: cell.number,
              pos: { row: r, col: c }
            })
          }
        }
      }
  
      return list
    }
  
    const clueList = collectClues(dir)
  
    const currentNumber =
      numbers[wordStart.row][wordStart.col].number
  
    const idx = clueList.findIndex(c => c.num === currentNumber)
  
    if (idx <= 0) return null
  
    const prevStart = clueList[idx - 1].pos
    const cells = getWordCells(prevStart, dir)
  
    return cells[cells.length - 1] // last cell of previous clue
  }

  const getWordCells = (start: Pos, dir: Direction) => {
    const cells: Pos[] = []
    let { row: r, col: c } = start
    while (!isBlack(r, c)) {
      cells.push({ row: r, col: c })
      dir === 'across' ? c++ : r++
    }
    return cells
  }

  const moveForward = (
    pos: Pos,
    dir: Direction,
    grid: string[][],
    wasEmpty: boolean
  ) => {
    const start = getWordStart(pos, dir)
    const cells = getWordCells(start, dir)
  
    const index = cells.findIndex(
      p => p.row === pos.row && p.col === pos.col
    )
  
    if (wasEmpty) {
      // 1️⃣ Scan forward
      for (let i = index + 1; i < cells.length; i++) {
        const { row, col } = cells[i]
        if (!grid[row][col]) {
          return cells[i]
        }
      }
  
      // 2️⃣ Scan entire word for ANY remaining blank
      for (let i = 0; i < cells.length; i++) {
        const { row, col } = cells[i]
        if (!grid[row][col]) {
          return cells[i]
        }
      }
  
      // 3️⃣ Word fully filled
      return null
    }
  
    // Editing a filled square → move sequentially
    if (index < cells.length - 1) {
      return cells[index + 1]
    }
  
    return null
  }

  const moveBackward = (pos: Pos, dir: Direction) => {
    const start = getWordStart(pos, dir)
    const cells = getWordCells(start, dir)
    const index = cells.findIndex(
      p => p.row === pos.row && p.col === pos.col
    )
    return cells[index - 1] ?? null
  }

  const getNextClueStart = (
    grid: string[][],
    wordStart: Pos,
    dir: Direction
  ) => {
    const collectClues = (directionToCollect: Direction) => {
      const list: { num: number; pos: Pos }[] = []
  
      for (let r = 0; r < numbers.length; r++) {
        for (let c = 0; c < numbers[r].length; c++) {
          const cell = numbers[r][c]
          if (!cell.number) continue
  
          if (
            (directionToCollect === 'across' && cell.startsAcross) ||
            (directionToCollect === 'down' && cell.startsDown)
          ) {
            list.push({
              num: cell.number,
              pos: { row: r, col: c }
            })
          }
        }
      }
  
      return list
    }
  
    const clueList = collectClues(dir)
  
    const currentNumber =
      numbers[wordStart.row][wordStart.col].number
  
    const idx = clueList.findIndex(c => c.num === currentNumber)
  
    // Not last clue in direction
    if (idx !== -1 && idx < clueList.length - 1) {
      const nextStart = clueList[idx + 1].pos
      const cells = getWordCells(nextStart, dir)
      const firstEmpty = cells.find(p => !grid[p.row][p.col])
      return { pos: firstEmpty ?? cells[0], newDir: dir }
    }
  
    // If last clue → switch direction
    const opposite: Direction =
  dir === 'across' ? 'down' : 'across'

const oppositeList = collectClues(opposite)
if (!oppositeList.length) return null

// Find first clue that is not fully filled
for (const clue of oppositeList) {
  const cells = getWordCells(clue.pos, opposite)
  const hasEmpty = cells.some(
    p => !grid[p.row][p.col]
  )

  if (hasEmpty) {
    const firstEmpty = cells.find(
      p => !grid[p.row][p.col]
    )

    return {
      pos: firstEmpty ?? cells[0],
      newDir: opposite
    }
  }
}

// If no clues in opposite direction have empties,
// scan entire grid for next empty square

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    if (puzzle.grid[r][c] !== '#' && !grid[r][c]) {
      return {
        pos: { row: r, col: c },
        newDir: opposite
      }
    }
  }
}

// Nothing empty anywhere
return null
  }

  const isAllFilled = (grid: string[][]) =>
    grid.every((row, r) =>
      row.every((cell, c) =>
        puzzle.grid[r][c] === '#' ? true : cell !== ''
      )
    )

  const checkSolution = (grid: string[][]) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (puzzle.grid[r][c] === '#') continue
        if (grid[r][c] !== puzzle.grid[r][c]) return false
      }
    }
    return true
  }

  function handleReplay() {
    setIsReplayMode(true)
    setIsComplete(false)
    setSeconds(0)
    setTimerRunning(false)
  
    if (!puzzle) return
  
    setUserGrid(
      puzzle.grid.map(row =>
        row.map(c => (c === '#' ? '#' : ''))
      )
    )
  }
  /* ================= INPUT ================= */

  async function handleChange(r: number, c: number, raw: string) {
    if (isComplete) return
  
    const letter = raw.toUpperCase().slice(-1)
    if (!letter) return
  
    if (!timerRunning) setTimerRunning(true)
  
      const g = structuredClone(userGrid)

      // Capture whether this cell was empty BEFORE typing
      const wasEmpty = !g[r][c]
      
      // Capture word start BEFORE movement
      const currentWordStart = getWordStart(
        { row: r, col: c },
        direction
      )
      
      g[r][c] = letter
      setUserGrid(g)
      setAlmostMessage(null)
      
      const next = moveForward(
        { row: r, col: c },
        direction,
        g,
        wasEmpty
      )
  
    if (next) {
      setActive(next)
    } else {
      const jump = getNextClueStart(
        g,
        currentWordStart,
        direction
      )
  
      if (jump) {
        setDirection(jump.newDir)
        setActive(jump.pos)
      }
    }
  
    if (isAllFilled(g)) {

      if (checkSolution(g)) {
    
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
              solve_time: seconds
            })
          }
        }
    
        setShowChickenSplash(true)
    
        setTimeout(() => {
          setStartWipe(true)
        }, 300)
    
        setTimeout(() => {
          setShowChickenSplash(false)
          setShowCompletionOverlay(true)
        }, 2000)
    
      } else {
        setAlmostMessage(
          "Almost! You're almost there — something is filled in incorrectly."
        )
      }
    
    }}

  function handleKeyDown(e: React.KeyboardEvent, r: number, c: number) {
    if (isComplete) return

    if (e.key === 'Backspace') {
  e.preventDefault()

  const g = structuredClone(userGrid)

  const currentWordStart = getWordStart(
    { row: r, col: c },
    direction
  )

  const cells = getWordCells(currentWordStart, direction)
  const index = cells.findIndex(
    p => p.row === r && p.col === c
  )

  if (g[r][c]) {
    // If letter exists → delete it
    g[r][c] = ''
    setUserGrid(g)
  } else {
    // If empty and NOT first cell → move backward inside word
    if (index > 0) {
      setActive(cells[index - 1])
    } else {
      // Empty and first cell → jump to previous clue
      const prevEnd = getPreviousClueEnd(
        g,
        currentWordStart,
        direction
      )

      if (prevEnd) {
        setActive(prevEnd)
      }
    }
  }

  return
}

    if (e.key === ' ') {
      e.preventDefault()
      setDirection(d => (d === 'across' ? 'down' : 'across'))
      return
    }

    if (e.key.startsWith('Arrow')) {
      e.preventDefault()

      let { row, col } = active

      if (e.key === 'ArrowRight') col++
      if (e.key === 'ArrowLeft') col--
      if (e.key === 'ArrowDown') row++
      if (e.key === 'ArrowUp') row--

      if (!isBlack(row, col))
        setActive({ row, col })
    }
  }

  /* ================= RENDER ================= */

  const activeWord = getWordCells(
    getWordStart(active, direction),
    direction
  )

  const activeStart = getWordStart(active, direction)
  const activeClueNumber =
    numbers[activeStart.row][activeStart.col]?.number

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60)
      .toString()
      .padStart(2, '0')}`

      const acrossClues = Object.entries(puzzle!.clues.across)
  .map(([num, clue]) => ({
    num: Number(num),
    clue
  }))
  .sort((a, b) => a.num - b.num)

const downClues = Object.entries(puzzle!.clues.down)
  .map(([num, clue]) => ({
    num: Number(num),
    clue
  }))
  .sort((a, b) => a.num - b.num)

  const activeClueList =
  direction === 'across' ? acrossClues : downClues

const activeClueIndex = activeClueList.findIndex(
  c => c.num === activeClueNumber
)

const activeClueText =
  activeClueIndex !== -1
    ? activeClueList[activeClueIndex].clue
    : ''

    function goToClueByIndex(index: number) {
      if (index < 0 || index >= activeClueList.length) return
    
      const clue = activeClueList[index]
      const start = findStart(clue.num, numbers)
    
      setActive(start)
    }

      function renderGrid() {
        return (
          <div
            className="grid gap-1 w-full max-w-[420px] mx-auto"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`
            }}
          >
            {puzzle!.grid.map((row, r) =>
              row.map((cell, c) => {
                const inWord = activeWord.some(
                  p => p.row === r && p.col === c
                )
                const isActive =
                  active.row === r && active.col === c
      
                const bg =
                  cell === '#'
                    ? 'bg-neutral-900'
                    : isActive
                    ? 'bg-red-300'
                    : inWord
                    ? 'bg-red-100'
                    : 'bg-white'
      
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`relative aspect-square border border-neutral-400 ${bg}`}
                  >
                    {cell !== '#' && (
                      <input
                        disabled={isComplete && !isReplayMode}
                        ref={el => {
                          inputs.current[r][c] = el
                        }}
                        value={userGrid[r][c]}
                        onChange={e =>
                          handleChange(r, c, e.target.value)
                        }
                        onKeyDown={e =>
                          handleKeyDown(e, r, c)
                        }
                        onFocus={() => {
                          setActive({ row: r, col: c })
                        }}
                        onClick={() => {
                          if (active.row === r && active.col === c) {
                            setDirection(d => d === 'across' ? 'down' : 'across')
                          }
                        }}
                        maxLength={1}
                        className="w-full h-full text-center text-xl font-bold tracking-wide uppercase outline-none bg-transparent"
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        )
      }
  return (
    <main className="p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8">
      <section>
      <div className="flex justify-between items-start mb-10">

{/* Left side */}
<div className="flex items-center gap-4">
  <img
    src="/logo.png"
    alt="Daily Malarkey"
    className="w-12 h-12 object-contain"
  />

  <div>
    <div className="text-sm tracking-[0.2em] uppercase text-neutral-500">
      Daily Malarkey
    </div>
    <h1 className="text-3xl font-bold tracking-tight">
      The Mini Crossword
    </h1>
  </div>
</div>
{/* Right side controls */}
<div className="flex items-center gap-8">


{isComplete && (
  <button
    onClick={handleReplay}
    className="flex items-center gap-2 border px-4 py-2 text-sm rounded-md hover:bg-neutral-100 transition ml-8"
  >
    <RotateCcw size={16} />
    Replay
  </button>
)}

</div>

      </div>
        
      <div className="mb-6 flex items-baseline gap-3">
  <span className="uppercase text-xs tracking-widest text-neutral-500">
    Time
  </span>
  <span className="font-mono text-2xl">
    {formatTime(seconds)}
  </span>
</div>

        {isComplete && !isReplayMode && (
        <div className="mb-3 text-red-800 font-semibold tracking-wide uppercase text-sm">
        Official Solve
        </div>
      )}

        {isReplayMode && (
        <div className="mb-2 text-gray-500 font-semibold">
        Replay Mode (Unranked)
        </div>
      )}

{almostMessage && (
  <div className="mt-6 mb-4 border border-neutral-300 bg-neutral-50 px-5 py-4 text-sm text-neutral-700">
    <div className="font-semibold tracking-wide uppercase text-red-900 mb-1">
      Almost
    </div>
    <div>
      Almost got it! Something isn’t quite right..
    </div>
  </div>
)}
        <div className="mb-2 text-gray-600 font-medium">
        {user && username && (
  <div className="text-neutral-700">
    Welcome back <span className="font-semibold">{username}</span>.
  </div>
)}
        </div>
{/* MOBILE CLUE CONTROLS */}
{isMobile && (
  <div className="md:hidden mt-6 border-t pt-4">

    {/* Clue Bar */}
    <div className="flex items-center justify-between">

      {/* Prev */}
      <button
        onClick={() => goToClueByIndex(activeClueIndex - 1)}
        className="px-4 py-2 text-lg"
      >
        ←
      </button>

      {/* Clue Display */}
      <div
        className="text-center flex-1 px-4 cursor-pointer"
        onClick={() =>
          setDirection(d =>
            d === 'across' ? 'down' : 'across'
          )
        }
      >
        <div className="text-xs uppercase tracking-widest text-neutral-500">
          {direction.toUpperCase()}
        </div>
        <div className="font-medium">
          {activeClueNumber}. {activeClueText}
        </div>
      </div>

      {/* Next */}
      <button
        onClick={() => goToClueByIndex(activeClueIndex + 1)}
        className="px-4 py-2 text-lg"
      >
        →
      </button>

    </div>
  </div>
)}

{renderGrid()}
      </section>

      <aside className="hidden md:block w-80">
      <h2 className="text-lg font-bold uppercase tracking-wider mb-4 text-neutral-900">
  Across
</h2>
        {Object.entries(puzzle.clues.across).map(
          ([num, clue]) => {
            const start = findStart(Number(num), numbers)
            const isActive =
              direction === 'across' &&
              activeClueNumber === Number(num)
              

            return (
              <div
                key={num}
                className={`mb-2 cursor-pointer px-2 py-1 rounded ${
                  isActive
                    ? 'bg-red-100 text-red-900 font-semibold'
                    : 'text-neutral-700'
                }`}
                onClick={() => {
                  if (
                    activeClueNumber === Number(num) &&
                    direction === 'across'
                  ) {
                    setDirection('down')
                  } else {
                    setDirection('across')
                    setActive(start)
                  }
                }}
              >
                {num}. {clue}
              </div>
            )
          }
        )}

        <h2 className="text-xl font-bold mt-6 mb-2">
          Down
        </h2>
        {Object.entries(puzzle.clues.down).map(
          ([num, clue]) => {
            const start = findStart(Number(num), numbers)
            const isActive =
              direction === 'down' &&
              activeClueNumber === Number(num)

            return (
              <div
                key={num}
                className={`mb-2 cursor-pointer ${
                  isActive ? 'font-bold underline' : ''
                }`}
                onClick={() => {
                  if (
                    activeClueNumber === Number(num) &&
                    direction === 'down'
                  ) {
                    setDirection('across')
                  } else {
                    setDirection('down')
                    setActive(start)
                  }
                }}
              >
                {num}. {clue}
              </div>
            )
          }
        )}
      </aside>
      {showChickenSplash && (
  <div className="fixed inset-0 z-50 overflow-hidden">

    {/* Chicken Fullscreen */}
    <Image
  src="/chicken.png"
  alt="chicken"
  fill
  priority
  className={`object-cover ${startWipe ? 'animate-wipe-out' : ''}`}
/>

  </div>
)}


{/* Floating Leaderboard Button */}
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
  <button
    onClick={() => router.push('/leaderboard')}
    className="border border-neutral-900 px-6 py-3 text-sm uppercase tracking-wide hover:bg-neutral-100"
  >
    View Leaderboard
  </button>
</div>
{showCompletionOverlay && (
  <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-6 text-center">
    <div className="text-center space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">
  Puzzle Completed !
</h1>

<div className="text-4xl font-mono">
  {formatTime(seconds)}
</div>

{puzzle?.author && (
  <div className="text-sm text-neutral-600 italic mt-3">
    Written by{' '}
    <span className="not-italic font-medium text-red-900">
      {puzzle.author}
    </span>
  </div>
)}

      <div className="flex flex-col gap-4 mt-6">
        <button
          onClick={() => router.push('/leaderboard')}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          View Leaderboard
        </button>

        <button
          onClick={() => {
            setShowCompletionOverlay(false)
          }}
          className="border px-6 py-3 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  )
}

/* ================= UTIL ================= */

function generateNumbers(grid: string[][]): NumberedCell[][] {
  let count = 1

  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return {} as NumberedCell

      const rightExists = c + 1 < grid[0].length
      const belowExists = r + 1 < grid.length

      const startsAcross =
        (c === 0 || row[c - 1] === '#') &&
        rightExists &&
        row[c + 1] !== '#'

      const startsDown =
        (r === 0 || grid[r - 1][c] === '#') &&
        belowExists &&
        grid[r + 1][c] !== '#'

      return {
        number:
          startsAcross || startsDown
            ? count++
            : undefined,
        startsAcross,
        startsDown
      }
    })
  )
}

function findStart(
  num: number,
  numbers: NumberedCell[][]
) {
  for (let r = 0; r < numbers.length; r++) {
    for (let c = 0; c < numbers[r].length; c++) {
      if (numbers[r][c].number === num)
        return { row: r, col: c }
    }
  }
  return { row: 0, col: 0 }
}