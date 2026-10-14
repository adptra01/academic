'use client'

import type { BaseRendererProps } from './index'

export function MannWhitneyRenderer({ result, method, config, detail }: BaseRendererProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Renderer khusus untuk Mann-Whitney U</p>
    </div>
  )
}