'use client'

import { BookOpenIcon, CheckCircleIcon, XCircleIcon, MinusIcon, ExternalLinkIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { Badge } from '@/components/ui/badge'
import type { MethodologyData } from '../types'

interface MethodologySectionProps {
  data: MethodologyData
  method: string
}

export function MethodologySection({ data, method }: MethodologySectionProps) {
  return (
    <CollapsibleSection title="Metode & Formula" icon={BookOpenIcon}>
      <div className="space-y-4">
        {data.formulaLatex && (
          <div>
            <h5 className="font-medium text-sm mb-2">Formula (LaTeX)</h5>
            <FormulaDisplay latex={data.formulaLatex} />
          </div>
        )}

        {data.formulaText && !data.formulaLatex && (
          <div>
            <h5 className="font-medium text-sm mb-2">Formula</h5>
            <pre className="bg-muted p-3 rounded text-xs font-mono overflow-auto">{data.formulaText}</pre>
          </div>
        )}

        <div>
          <h5 className="font-medium text-sm mb-2">Asumsi yang Diuji</h5>
          {data.assumptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada asumsi tercatat untuk metode ini.</p>
          ) : (
            <ul className="space-y-2">
              {data.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                  {a.checked ? (
                    a.name.toLowerCase().includes('independence') || a.name.toLowerCase().includes('desain') ? (
                      <MinusIcon className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    ) : (
                      <CheckCircleIcon className="size-4 shrink-0 text-green-600 mt-0.5" />
                    )
                  ) : (
                    <XCircleIcon className="size-4 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{a.description}</p>
                    <Badge
                      variant={a.checked ? 'default' : 'destructive'}
                      className="mt-1 text-xs"
                    >
                      {a.checked ? 'Dicek' : 'Tidak dicek / Gagal'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h5 className="font-medium text-sm mb-2">Referensi</h5>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            {data.references.map((ref, i) => (
              <li key={i} className="flex items-start gap-2">
                <ExternalLinkIcon className="size-3 shrink-0 mt-0.5" />
                <span>{ref}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-3 bg-muted/50 rounded border border-border/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Versi Engine</p>
          <p className="font-mono">{data.engineVersion}</p>
        </div>
      </div>
    </CollapsibleSection>
  )
}

function FormulaDisplay({ latex }: { latex: string }) {
  return (
    <div className="bg-muted p-4 rounded border border-border/50 overflow-x-auto">
      <pre className="text-xs font-mono text-foreground">{latex}</pre>
      <p className="text-xs text-muted-foreground mt-2">
        Formula ditampilkan sebagai kode LaTeX mentah. Render KaTeX tersedia di mode export PDF/HTML.
      </p>
    </div>
  )
}