'use client'

import { Fragment } from 'react'
import type { ResultNarrativeProps } from './types'
import { getRenderer } from './renderers'

export function ResultNarrative({ result, method, config, detail, className }: ResultNarrativeProps) {
  const Renderer = getRenderer(method)

  return (
    <div className={className}>
      <Renderer result={result} method={method} config={config} detail={detail} />
    </div>
  )
}

export * from './types'
export * from './hooks/useResultData'
export * from './sections/CollapsibleSection'
export * from './sections/SummarySection'
export * from './sections/WarningsSection'
export * from './sections/DescriptiveSection'
export * from './sections/InferentialSection'
export * from './sections/InterpretationSection'
export * from './sections/MethodologySection'
export * from './sections/ReproducibilitySection'
export { BaseRenderer, getRenderer } from './renderers'
export type { BaseRendererProps } from './renderers'