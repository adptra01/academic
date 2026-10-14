'use client'

import type { BaseRendererProps } from './index'

export function TTest1SampRenderer({ result, method, config, detail }: BaseRendererProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Renderer khusus untuk Uji t Satu Sampel</p>
    </div>
  )
}