'use client'

import { LightbulbIcon, AlertTriangleIcon, CheckIcon, HelpCircleIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import type { InterpretationData } from '../types'

interface InterpretationSectionProps {
  data: InterpretationData
}

export function InterpretationSection({ data }: InterpretationSectionProps) {
  return (
    <CollapsibleSection title="Interpretasi Akademik" icon={LightbulbIcon}>
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none text-sm">
          <p className="whitespace-pre-wrap">{data.narrative}</p>
        </div>

        {data.practicalSignificance && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-start gap-2">
              <CheckIcon className="size-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Signifikansi Praktis</p>
                <p className="text-blue-700 text-sm mt-1">{data.practicalSignificance}</p>
              </div>
            </div>
          </div>
        )}

        {data.limitations.length > 0 && (
          <div>
            <h5 className="flex items-center gap-2 font-medium text-sm text-orange-800 mb-2">
              <AlertTriangleIcon className="size-3.5" />
              Batasan Metodologis
            </h5>
            <ul className="space-y-1.5 ml-5 text-sm text-orange-900">
              {data.limitations.map((lim, i) => (
                <li key={i} className="flex items-start gap-2">
                  <HelpCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span>{lim}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded border border-border/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Catatan Interpretasi:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Interpretasi di atas dihasilkan oleh engine statistik berbasis aturan (bukan LLM).</li>
            <li>Kesimpulan kausalitas memerlukan desain eksperimental yang valid, bukan hanya uji statistik.</li>
            <li>{'Signifikansi statistik (p < \u03B1) \u2260 signifikansi praktis/klinis \u2014 periksa effect size & CI.'}</li>
            <li>Asumsi yang gagal (lihat bagian Peringatan) mengurangi validitas inferensi.</li>
          </ul>
        </div>
      </div>
    </CollapsibleSection>
  )
}