'use client'

import { AlertTriangleIcon, AlertCircleIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { Badge } from '@/components/ui/badge'
import type { WarningsData } from '../types'

interface WarningsSectionProps {
  data: WarningsData
}

export function WarningsSection({ data }: WarningsSectionProps) {
  const hasWarnings =
    data.engineWarnings.length > 0 ||
    data.engineNotes.length > 0 ||
    data.maRulesTriggered.length > 0 ||
    data.assumptionFailures.length > 0

  if (!hasWarnings) {
    return (
      <CollapsibleSection title="Peringatan Sebelum Baca Hasil" icon={AlertTriangleIcon} defaultOpen variant="warning">
        <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded p-4">
          <AlertCircleIcon className="size-5 shrink-0" />
          <p className="text-sm">Tidak ada peringatan, catatan, atau asumsi yang gagal. Hasil dapat diinterpretasikan dengan standar kebiasaan.</p>
        </div>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title="Peringatan Sebelum Baca Hasil" icon={AlertTriangleIcon} defaultOpen variant="warning">
      <div className="space-y-4">
        {data.engineWarnings.length > 0 && (
          <div>
            <h5 className="flex items-center gap-2 font-medium text-sm text-yellow-800">
              <TriangleAlertIcon className="size-3.5" />
              Peringatan Engine ({data.engineWarnings.length})
            </h5>
            <ul className="mt-2 space-y-2 ml-5">
              {data.engineWarnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-yellow-900">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.assumptionFailures.length > 0 && (
          <div>
            <h5 className="flex items-center gap-2 font-medium text-sm text-red-800">
              <AlertCircleIcon className="size-3.5" />
              Asumsi Gagal ({data.assumptionFailures.length})
            </h5>
            <ul className="mt-2 space-y-2 ml-5">
              {data.assumptionFailures.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-900">
                  <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <strong>{a.name}</strong> tidak terpenuhi
                    {a.pValue != null && <span className="ml-1 font-mono"> ({formatPValue(a.pValue)})</span>}
                    {a.note && <span className="ml-2 text-red-700">— {a.note}</span>}
                    <Badge variant="destructive" className="ml-2 mt-0.5">
                      FAIL
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-700">
              Pertimbangkan metode alternatif (non-parametrik/robust) bila tersedia.
            </p>
          </div>
        )}

        {data.engineNotes.length > 0 && (
          <div>
            <h5 className="flex items-center gap-2 font-medium text-sm text-blue-800">
              <InfoIcon className="size-3.5" />
              Catatan Engine ({data.engineNotes.length})
            </h5>
            <ul className="mt-2 space-y-2 ml-5">
              {data.engineNotes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-blue-900">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.maRulesTriggered.length > 0 && (
          <div>
            <h5 className="flex items-center gap-2 font-medium text-sm text-purple-800">
              <InfoIcon className="size-3.5" />
              MA Rules Terpicu ({data.maRulesTriggered.length})
            </h5>
            <ul className="mt-2 space-y-2 ml-5">
              {data.maRulesTriggered.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-purple-900">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                  <pre className="text-xs font-mono bg-muted p-2 rounded flex-1 overflow-auto">
                    {JSON.stringify(r, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return 'p = ?'
  if (p < 0.001) return 'p < .001'
  if (p < 0.01) return `p = ${p.toFixed(3).replace(/^0/, '')}`
  return `p = ${p.toFixed(2).replace(/^0/, '')}`
}