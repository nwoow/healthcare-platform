'use client'

/**
 * EmotionRegistry — required for MUI + Next.js App Router SSR.
 *
 * Without this, Emotion generates CSS class hashes server-side and then
 * regenerates them on the client with a fresh counter, producing different
 * hash strings (e.g. css-abc123 vs css-xyz789).  This mismatch causes
 * React hydration errors and broken Grid/Card layouts because the styles
 * that correspond to the client-generated class names were never injected.
 *
 * This component intercepts every Emotion insertion during SSR and flushes
 * the collected <style> tags into the <head> via useServerInsertedHTML so
 * the client starts with an identical set of already-inserted style names.
 */

import { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'

export default function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'css', prepend: true })
    // compat mode keeps the hash stable across React strict-mode double renders
    cache.compat = true

    const prevInsert = cache.insert.bind(cache)
    let inserted: string[] = []

    cache.insert = (...args: Parameters<typeof prevInsert>) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name)
      }
      return prevInsert(...args)
    }

    const flush = () => {
      const prev = inserted
      inserted = []
      return prev
    }

    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null

    let styles = ''
    for (const name of names) {
      styles += cache.inserted[name]
    }

    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}
