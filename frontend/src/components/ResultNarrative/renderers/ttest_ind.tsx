'use client'

import type { BaseRendererProps } from './index'

export function TTestIndRenderer({ result, method, config, detail }: BaseRendererProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Renderer khusus untuk Uji t Independen (Welch's default)</p>
      {/* Future: method-specific customizations can go here */}
    </div>
  )
}