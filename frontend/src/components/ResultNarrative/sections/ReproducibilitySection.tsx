'use client'

import { useState } from 'react'
import { GitBranchIcon, FileJsonIcon, HashIcon, ClockIcon, DownloadIcon, CopyIcon, CheckIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ReproducibilityData } from '../types'

interface ReproducibilitySectionProps {
  data: ReproducibilityData
}

export function ReproducibilitySection({ data }: ReproducibilitySectionProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data.configJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-config-${data.analysisId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CollapsibleSection title="Reproduktibilitas" icon={GitBranchIcon}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReproCard label="Analysis ID" value={data.analysisId} icon={HashIcon} monospace />
          <ReproCard label="Result Hash" value={data.resultHash.slice(0, 16) + '…'} icon={HashIcon} monospace full={data.resultHash} />
          <ReproCard label="Dataset" value={data.datasetFilename ?? '-'} icon={FileJsonIcon} subtext={`v${data.datasetVersion ?? '-'}`} />
          <ReproCard label="Engine" value={data.engineVersion} icon={GitBranchIcon} monospace />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(data.analysisId, 'analysisId')} className="gap-1">
            <CopyIcon className="size-3.5" /> {copied === 'analysisId' ? <CheckIcon className="size-3.5" /> : 'Salin Analysis ID'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(data.resultHash, 'resultHash')} className="gap-1">
            <CopyIcon className="size-3.5" /> {copied === 'resultHash' ? <CheckIcon className="size-3.5" /> : 'Salin Result Hash'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(data.analysisHash, 'analysisHash')} className="gap-1">
            <CopyIcon className="size-3.5" /> {copied === 'analysisHash' ? <CheckIcon className="size-3.5" /> : 'Salin Analysis Hash'}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJSON} className="gap-1">
            <DownloadIcon className="size-3.5" /> Unduh Config JSON
          </Button>
        </div>

        <div className="border-t border-border/50 pt-4 space-y-3">
          <div>
            <p className="font-medium text-sm mb-1 flex items-center gap-2">
              <ClockIcon className="size-3.5" /> Timestamp
            </p>
            <p className="text-sm text-muted-foreground font-mono">{new Date(data.timestamp).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</p>
          </div>

          <div>
            <p className="font-medium text-sm mb-1 flex items-center gap-2">
              <HashIcon className="size-3.5" /> Analysis Hash (context + result)
            </p>
            <p className="text-xs text-muted-foreground font-mono break-all">{data.analysisHash}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hash deterministik dari konteks analisis (metode, variabel, parameter, dataset version, project) + hasil.
              Duplikat analisis akan memiliki hash identik.
            </p>
          </div>

          {data.randomSeeds && Object.keys(data.randomSeeds).length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1 flex items-center gap-2">
                <GitBranchIcon className="size-3.5" /> Random Seeds
              </p>
              <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-32">
                {JSON.stringify(data.randomSeeds, null, 2)}
              </pre>
            </div>
          )}

          {data.transformationLog.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1 flex items-center gap-2">
                <GitBranchIcon className="size-3.5" /> Transformation Log ({data.transformationLog.length} steps)
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.transformationLog.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{i + 1}</Badge>
                    <code className="font-mono bg-muted px-1 rounded">{step}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="font-medium text-sm mb-1 flex items-center gap-2">
              <FileJsonIcon className="size-3.5" /> Konfigurasi Analisis (JSON)
            </p>
            <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(data.configJson, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          <p className="font-medium mb-1">Verifikasi Reproduktibilitas</p>
          <p>Gunakan Analysis ID + Dataset Version + Config JSON untuk menjalankan ulang (rerun) di mode manual.
          Sistem akan memverifikasi apakah hasil identik (hash cocok) atau berbeda (investigasi diperlukan).</p>
        </div>
      </div>
    </CollapsibleSection>
  )
}

function ReproCard({
  label,
  value,
  icon: Icon,
  monospace = false,
  subtext,
  full,
}: {
  label: string
  value: string
  icon: React.ElementType
  monospace?: boolean
  subtext?: string
  full?: string
}) {
  return (
    <div className="p-3 bg-muted/50 rounded border border-border/50">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <p className={monospace ? 'font-mono text-sm' : 'text-sm'} title={full}>
        {value}
      </p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  )
}

import * as React from 'react'