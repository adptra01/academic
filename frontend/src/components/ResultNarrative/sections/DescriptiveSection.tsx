'use client'

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table'
import { CollapsibleSection } from './CollapsibleSection'
import { Badge } from '@/components/ui/badge'
import type { DescriptiveData } from '../types'

interface DescriptiveSectionProps {
  data: DescriptiveData
  method: string
}

function formatNumber(val: unknown): string {
  if (val === null || val === undefined) return '-'
  const n = Number(val)
  if (!Number.isFinite(n)) return String(val)
  if (Number.isInteger(n)) return n.toLocaleString('id-ID')
  return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function DescriptiveSection({ data, method }: DescriptiveSectionProps) {
  if (data.type === 'none' || !data.data || Object.keys(data.data).length === 0) {
    return (
      <CollapsibleSection title="Statistik Deskriptif" icon={() => <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M9 17V7"/><path d="M14 17V11"/><path d="M19 17V3"/></svg>} defaultOpen>
        <p className="text-sm text-muted-foreground">Tidak ada statistik deskriptif untuk metode ini.</p>
      </CollapsibleSection>
    )
  }

  const stats = data.data as Record<string, unknown>
  const labels = data.labels ?? {}

  const renderPerGroup = () => {
    const groups = stats.groups as Record<string, unknown>[] | undefined
    const perGroup = stats.per_group as Record<string, unknown>[] | undefined
    const rows = groups ?? perGroup ?? []

    if (rows.length === 0) return <p className="text-sm text-muted-foreground">Data per grup tidak tersedia.</p>

    const cols = Object.keys(rows[0])
    const visibleCols = cols.filter((c) => !['_internal'].includes(c))

    return (
      <Table>
        <TableCaption className="text-xs text-muted-foreground">Statistik per grup/kelompok</TableCaption>
        <TableHeader>
          <TableRow>
            {visibleCols.map((col) => (
              <TableHead key={col}>{labels[col] ?? col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow key={ri}>
              {visibleCols.map((col) => (
                <TableCell key={col}>
                  {col.toLowerCase().includes('p') ? (
                    <Badge variant="outline" className="text-xs">{formatNumber(row[col])}</Badge>
                  ) : (
                    formatNumber(row[col])
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const renderContingency = () => {
    const observed = stats.observed as number[][] | undefined
    const expected = stats.expected as number[][] | undefined
    const residuals = stats.residuals as number[][] | undefined

    if (!observed) return <p className="text-sm text-muted-foreground">Tabel kontingensi tidak tersedia.</p>

    const headers = ['', ...observed[0].map((_, i) => `Kolom ${i + 1}`), 'Total']
    const rowLabels = observed.map((_, i) => `Baris ${i + 1}`)

    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium text-sm mb-2">Frekuensi Observed</p>
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {observed.map((row, ri) => (
                <TableRow key={ri}>
                  <TableCell className="font-medium">{rowLabels[ri]}</TableCell>
                  {row.map((cell, ci) => (
                    <TableCell key={ci}>{cell.toLocaleString('id-ID')}</TableCell>
                  ))}
                  <TableCell className="font-medium">{row.reduce((a, b) => a + b, 0).toLocaleString('id-ID')}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium bg-muted/50">
                <TableCell>Total</TableCell>
                {observed[0].map((_, ci) => (
                  <TableCell key={ci}>{observed.reduce((sum, r) => sum + r[ci], 0).toLocaleString('id-ID')}</TableCell>
                ))}
                <TableCell>{observed.flat().reduce((a, b) => a + b, 0).toLocaleString('id-ID')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {expected && (
          <div>
            <p className="font-medium text-sm mb-2">Frekuensi Expected (Harapan)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h, i) => (
                    <TableHead key={i}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expected.map((row, ri) => (
                  <TableRow key={ri}>
                    <TableCell className="font-medium">{rowLabels[ri]}</TableCell>
                    {row.map((cell, ci) => (
                      <TableCell key={ci}>{formatNumber(cell)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-1">
              {'Sel dengan expected < 5 ditandai \u2014 uji chi-kuadrat mungkin tidak valid.'}
            </p>
          </div>
        )}

        {residuals && (
          <div>
            <p className="font-medium text-sm mb-2">Standardized Residuals</p>
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h, i) => (
                    <TableHead key={i}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {residuals.map((row, ri) => (
                  <TableRow key={ri}>
                    <TableCell className="font-medium">{rowLabels[ri]}</TableCell>
                    {row.map((cell, ci) => (
                      <TableCell key={ci}>
                        <Badge
                          variant={Math.abs(cell) > 2 ? 'destructive' : Math.abs(cell) > 1.5 ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {cell.toFixed(2)}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-1">
              {(() => '|Residual| < 2 (merah) = kontribusi besar ke \u03C7\u00B2; < 1.5 (abu) = kontribusi moderat.')()}
            </p>
          </div>
        )}
      </div>
    )
  }

  const renderRegression = () => {
    const coefficients = stats.coefficients as Record<string, unknown>[] | undefined
    const r2 = stats.r_squared ?? stats.r2
    const adjR2 = stats.adj_r_squared ?? stats.adjusted_r_squared
    const fStat = stats.f_statistic ?? stats.f
    const fDf = stats.df_model ?? stats.df_regression
    const fDfResid = stats.df_residual ?? stats.df_error

    return (
      <div className="space-y-4">
        {coefficients && coefficients.length > 0 && (
          <div>
            <p className="font-medium text-sm mb-2">Tabel Koefisien</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prediktor</TableHead>
                  <TableHead>β (Estimate)</TableHead>
                  <TableHead>SE</TableHead>
                  <TableHead>t</TableHead>
                  <TableHead>p-value</TableHead>
                  <TableHead>95% CI</TableHead>
                  {stats.vif != null && <TableHead>VIF</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coefficients.map((coef, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{String(coef.name ?? coef.predictor ?? `X${i}`)}</TableCell>
                    <TableCell>{formatNumber(coef.coef ?? coef.estimate ?? coef.beta)}</TableCell>
                    <TableCell>{formatNumber(coef.se ?? coef.std_error)}</TableCell>
                    <TableCell>{formatNumber(coef.t ?? coef.t_statistic)}</TableCell>
                    <TableCell>
                      <Badge variant={Number(coef.p ?? coef.p_value ?? 1) < 0.05 ? 'default' : 'outline'} className="text-xs">
                        {formatPValue(Number(coef.p ?? coef.p_value ?? 1))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coef.ci_lower !== undefined && coef.ci_upper !== undefined
                        ? `[${formatNumber(coef.ci_lower)}, ${formatNumber(coef.ci_upper)}]`
                        : '-'}
                    </TableCell>
                    {stats.vif != null && (
                      <TableCell>
                        <Badge
                          variant={Number(coef.vif ?? 0) > 10 ? 'destructive' : Number(coef.vif ?? 0) > 5 ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {formatNumber(coef.vif)}
                        </Badge>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground">R²</p>
            <p className="font-mono font-medium">{r2 !== undefined ? Number(r2).toFixed(4) : '-'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground">Adjusted R²</p>
            <p className="font-mono font-medium">{adjR2 !== undefined ? Number(adjR2).toFixed(4) : '-'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground">F({String(fDf ?? '-')}, {String(fDfResid ?? '-')})</p>
            <p className="font-mono font-medium">{formatNumber(fStat)}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderDescriptive = () => {
    const variables = stats.variables as Record<string, unknown>[] | undefined
    const rows = variables ?? (Array.isArray(stats) ? stats : [stats])

    if (rows.length === 0) return <p className="text-sm text-muted-foreground">Data tidak tersedia.</p>

    const cols = ['variable', 'n', 'missing', 'mean', 'median', 'sd', 'iqr', 'min', 'max', 'skewness', 'kurtosis']
    const visibleCols = cols.filter((c) => rows[0]?.[c] !== undefined)

    return (
      <Table>
        <TableCaption className="text-xs text-muted-foreground">Statistik deskriptif per variabel</TableCaption>
        <TableHeader>
          <TableRow>
            {visibleCols.map((col) => (
              <TableHead key={col}>{labels[col] ?? col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow key={ri}>
              {visibleCols.map((col) => (
                <TableCell key={col} className={col === 'variable' ? 'font-medium' : ''}>
                  {col.toLowerCase().includes('p') ? (
                    <Badge variant="outline" className="text-xs">{formatNumber(row[col])}</Badge>
                  ) : (
                    formatNumber(row[col])
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <CollapsibleSection title="Statistik Deskriptif" icon={() => <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M9 17V7"/><path d="M14 17V11"/><path d="M19 17V3"/></svg>} defaultOpen={true}>
      <div className="space-y-4">
        {data.type === 'per_group' && renderPerGroup()}
        {data.type === 'contingency' && renderContingency()}
        {data.type === 'regression' && renderRegression()}
        {data.type === 'descriptive' && renderDescriptive()}
        {data && typeof data === 'object' && 'type' in data && (data as any).type === 'none' && <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto">{JSON.stringify(stats, null, 2)}</pre>}
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