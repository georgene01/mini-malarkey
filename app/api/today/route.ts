import { NextResponse } from 'next/server'
import { supabase } from '../../../src/lib/supabase'

export async function GET() {
  // Get today's date in South African time (YYYY-MM-DD)
  const now = new Date()
  const saDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)

  // Fetch today's puzzle
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, sa_date, grid, clues, author')
    .eq('sa_date', saDate)
    .limit(1)

  // Handle database errors or missing puzzle
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No puzzle found for today' },
      { status: 404 }
    )
  }

  // Return the single puzzle
  return NextResponse.json(data[0])
}

