'use client'

import { useEffect, useRef, useState } from 'react'

type Puzzle = {
  grid: string[][]
  clues: {
    across: Record<string, string>
    down: Record<string, string>
  }
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

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [userGrid, setUserGrid] = useState<string[][]>([])
  const [numbers, setNumbers] = useState<NumberedCell[][]>([])
  const [active, setActive] = useState<Pos>({ row: 0, col: 0 })
  const [direction, setDirection] = useState<Direction>('across')

  const [showChicken, setShowChicken] = useState(false)
  const [showCompletionScreen, setShowCompletionScreen] = useState(false)

  const [isComplete, setIsComplete] = useState(false)
  const [almostMessage, setAlmostMessage] = useState<string | null>(null)

  const [seconds, setSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<number | null>(null)

  const inputs = useRef<(HTMLInputElement | null)[][]>([])

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
    grid: string[][]
  ) => {
    const start = getWordStart(pos, dir)
    const cells = getWordCells(start, dir)
  
    const index = cells.findIndex(
      p => p.row === pos.row && p.col === pos.col
    )
  
    const wordHasEmpty = cells.some(
      p => !grid[p.row][p.col]
    )
  
    // If word still has empty squares → skip filled
    if (wordHasEmpty) {
      for (let i = index + 1; i < cells.length; i++) {
        const { row, col } = cells[i]
        if (!grid[row][col]) return cells[i]
      }
    }
  
    // Otherwise word is fully filled → move sequentially
    if (index < cells.length - 1) {
      return cells[index + 1]
    }
  
    // True word end
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

// If all clues are filled, fallback to first
const fallback = oppositeList[0]
const fallbackCells = getWordCells(fallback.pos, opposite)
const firstEmpty = fallbackCells.find(
  p => !grid[p.row][p.col]
)

return {
  pos: firstEmpty ?? fallbackCells[0],
  newDir: opposite
}
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

  /* ================= INPUT ================= */

  function handleChange(r: number, c: number, raw: string) {
    if (isComplete) return
  
    const letter = raw.toUpperCase().slice(-1)
    if (!letter) return
  
    if (!timerRunning) setTimerRunning(true)
  
    const g = structuredClone(userGrid)
  
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
      g
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
      
        setShowChicken(true)
      
        // After animation finishes
        setTimeout(() => {
          setShowCompletionScreen(true)
          setShowChicken(false)
        }, 1600)
      } else {
        setAlmostMessage(
          "Almost! You're almost there — something is filled in incorrectly."
        )
      }
    }
  }

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

  return (
    <main className="p-6 flex gap-8">
      <section>
        <h1 className="text-3xl font-bold mb-4">
          Daily Mini Crossword
        </h1>

        <div className="mb-3 font-mono text-xl">
          Timer: {formatTime(seconds)}
        </div>

        {almostMessage && (
          <div className="mb-3 text-yellow-700 font-semibold">
            {almostMessage}
          </div>
        )}

        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            width: `${Math.min(cols * 60, 420)}px`
          }}
        >
          {puzzle.grid.map((row, r) =>
            row.map((cell, c) => {
              const inWord = activeWord.some(
                p => p.row === r && p.col === c
              )
              const isActive =
                active.row === r && active.col === c

              const bg =
                cell === '#'
                  ? 'bg-black'
                  : isActive
                  ? 'bg-yellow-400'
                  : inWord
                  ? 'bg-yellow-200'
                  : 'bg-white'

              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative aspect-square border ${bg}`}
                >
                  {cell !== '#' && (
                    <input
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
                      onFocus={() =>
                        setActive({ row: r, col: c })
                      }
                      maxLength={1}
                      className="w-full h-full text-center text-lg font-semibold uppercase outline-none bg-transparent"
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <aside className="w-80">
        <h2 className="text-xl font-bold mb-2">Across</h2>
        {Object.entries(puzzle.clues.across).map(
          ([num, clue]) => {
            const start = findStart(Number(num), numbers)
            const isActive =
              direction === 'across' &&
              activeClueNumber === Number(num)

            return (
              <div
                key={num}
                className={`mb-2 cursor-pointer ${
                  isActive ? 'font-bold underline' : ''
                }`}
                onClick={() => {
                  setDirection('across')
                  setActive(start)
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
                  setDirection('down')
                  setActive(start)
                }}
              >
                {num}. {clue}
              </div>
            )
          }
        )}
      </aside>
      {showChicken && (
  <div className="fixed inset-0 z-50 bg-blue-500 flex items-center justify-center text-white text-4xl">
    CHICKEN TRIGGERED
  </div>
)}
{showCompletionScreen && (
  <div className="fixed inset-0 bg-white z-40 flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-4xl font-bold mb-4">
        You Solved It!
      </h2>
      <div className="text-2xl font-mono">
        {formatTime(seconds)}
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