'use client'

import { Suspense } from 'react'
import CompletionContent from './CompletionContent'

export default function CompletionPage() {
  return (
    <Suspense fallback={null}>
      <CompletionContent />
    </Suspense>
  )
}