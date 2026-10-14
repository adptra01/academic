'use client'

import { CalculatorIcon, CheckCircleIcon, XCircleIcon, ArrowUpDownIcon } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import { Badge } from '@/components/ui/badge'
import type { InferentialData } from '../types'

// p-value format strings - defined as constants to avoid JSX parsing issues with numeric literals
const P_FORMAT_1 = 'p < .001'
const P_FORMAT_2 = 'p = .001'
const P_FORMAT_3 = 'p = .05'

interface InferentialSectionProps {
  data: InferentialData
}

export function InferentialSection({ data }: InferentialSectionProps) {
  const reject = data.decision.text === 'Tolak H0'

  return (
    <CollapsibleSection title="Hasil Inferensial" icon={CalculatorIcon} defaultOpen>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={data.testStatistic.label}
            value={String(data.testStatistic.value)}
            icon={CalculatorIcon}
          />
          {data.degreesOfFreedom && (
            <StatCard label="df" value={data.degreesOfFreedom} icon={ArrowUpDownIcon} />
          )}
          <StatCard
            label="p-value"
            value={data.pValueFormatted}
            icon={reject ? CheckCircleIcon : XCircleIcon}
            highlight={reject}
          />
          {data.effectSize && (
            <StatCard
              label={data.effectSize.label}
              value={String(data.effectSize.value)}
              icon={ArrowUpDownIcon}
              subtext={data.effectSize.interpretation}
            />
          )}
        </div>

        {data.confidenceInterval && (
          <div className="p-3 bg-muted/50 rounded border border-border/50">
            <p className="font-medium text-sm">{data.confidenceInterval.label}</p>
            <p className="font-mono text-lg mt-1">
              [{data.confidenceInterval.lower.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 4 })},{' '}
              {data.confidenceInterval.upper.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 4 })}]
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Interval kepercayaan 95% untuk parameter estimasi.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 p-3 rounded border border-border/50 bg-muted/30">
          <span className="font-medium">Keputusan:</span>
          <Badge variant={reject ? 'destructive' : 'default'}>
            {data.decision.text}
          </Badge>
          <span className="text-sm text-muted-foreground ml-2">(α = {data.decision.alpha})</span>
        </div>

        {data.additionalStats && Object.keys(data.additionalStats).length > 0 && (
          <div>
            <p className="font-medium text-sm mb-2">Statistik Tambahan</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(data.additionalStats).map(([key, value]) => (
                <div key={key} className="p-2 bg-muted/50 rounded text-sm">
                  <span className="text-muted-foreground">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-mono ml-2">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
          {(() => {
            const text = `Format p-value mengikuti gaya APA: ${P_FORMAT_1} untuk p < 0.001, ${P_FORMAT_2} untuk p < 0.01, ${P_FORMAT_3} untuk p \u2265 0.01.`
            return <code className="font-mono">{text}</code>
          })()}
        </p>
      </div>
    </CollapsibleSection>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight = false,
  subtext,
}: {
  label: string
  value: string
  icon: React.ElementType
  highlight?: boolean
  subtext?: string
}) {
  return (
    <div className={`p-3 rounded border ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/30'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="font-mono text-xl font-semibold">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  )
}