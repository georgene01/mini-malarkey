import { NextResponse } from 'next/server'
import { supabase } from '../../../src/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, sa_date')
    .limit(1)
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

