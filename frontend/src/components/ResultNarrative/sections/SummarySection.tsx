'use client'

import { FileTextIcon, DatabaseIcon, UsersIcon, HashIcon, MinusIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import type { SummaryData } from '../types'

interface SummarySectionProps {
  data: SummaryData
}

export function SummarySection({ data }: SummarySectionProps) {
  return (
    <CollapsibleSection title="Ringkasan Analisis" icon={FileTextIcon} defaultOpen>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Pertanyaan Penelitian</p>
            <p className="text-muted-foreground mt-1">
              {data.researchQuestion ?? 'Tidak dispesifikasikan (mode manual).'}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Metode Statistik</p>
            <p className="text-muted-foreground mt-1 font-mono">{data.methodLabel}</p>
          </div>
        </div>

        <div>
          <p className="font-medium text-foreground">Variabel</p>
          <pre className="mt-1 text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-40">
            {JSON.stringify(data.variables, null, 2)}
          </pre>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 border-t border-border/50 pt-4">
          <div>
            <p className="font-medium text-foreground">Dataset</p>
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              {data.datasetFilename ?? '-'} · v{data.datasetVersion ?? '-'}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">n Analisis</p>
            <p className="text-muted-foreground mt-1 font-mono text-xs">{data.nAnalysis.toLocaleString('id-ID')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">n Sumber</p>
            <p className="text-muted-foreground mt-1 font-mono text-xs">{data.nSource.toLocaleString('id-ID')}</p>
          </div>
        </div>

        {data.rowsDropped > 0 && (
          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3">
            <MinusIcon className="size-3.5 shrink-0" />
            <span>
              <strong>{data.rowsDropped}</strong> baris tidak ikut dihitung (mis. data kosong/pasangan tak lengkap).
            </span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}