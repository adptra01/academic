'use client';

import { AlertCircleIcon, CheckCircleIcon, InfoIcon, DatabaseIcon, FileTextIcon, SearchIcon, ExternalLinkIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type DataQualitySummaryProps = {
  datasetName: string;
  version: number;
  rows: number;
  cols: number;
  missingPct: number;
  duplicateRows: number;
  columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[];
  onViewDetails?: () => void;
};

const MISSING_THRESHOLDS = { low: 5, medium: 20 };

function getMissingSeverity(pct: number): 'low' | 'medium' | 'high' {
  if (pct <= MISSING_THRESHOLDS.low) return 'low';
  if (pct <= MISSING_THRESHOLDS.medium) return 'medium';
  return 'high';
}

function MissingBadge({ pct }: { pct: number }) {
  const severity = getMissingSeverity(pct);
  return (
    <Badge variant={severity === 'low' ? 'default' : severity === 'medium' ? 'secondary' : 'destructive'}>
      <AlertCircleIcon className='mr-1 h-3 w-3' />
      {pct}% data kosong
    </Badge>
  );
}

export function DataQualitySummary({
  datasetName,
  version,
  rows,
  cols,
  missingPct,
  duplicateRows,
  columns,
  onViewDetails,
}: DataQualitySummaryProps) {
  const missingSeverity = getMissingSeverity(missingPct);
  const hasDuplicates = duplicateRows > 0;

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <DatabaseIcon className='size-5' />
              </div>
              <div>
                <CardTitle className='text-lg'>{datasetName}</CardTitle>
                <CardDescription className='font-mono text-[11px]'>Versi {version} · {rows.toLocaleString()} baris × {cols} kolom</CardDescription>
              </div>
            </div>
            {onViewDetails && (
              <Button variant='ghost' size='sm' onClick={onViewDetails} className='gap-1'>
                <SearchIcon className='size-3.5' />
                Detail Kualitas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div className='rounded-lg border bg-card p-4'>
              <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.1em]'>Total Baris</p>
              <p className='mt-1 text-2xl font-bold tabular-nums'>{rows.toLocaleString()}</p>
            </div>
            <div className='rounded-lg border bg-card p-4'>
              <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.1em]'>Total Kolom</p>
              <p className='mt-1 text-2xl font-bold tabular-nums'>{cols}</p>
            </div>
            <div className='rounded-lg border bg-card p-4'>
              <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.1em]'>Data Kosong</p>
              <div className='mt-1 flex items-center gap-2'>
                <span className='text-2xl font-bold tabular-nums'>{missingPct}%</span>
                <MissingBadge pct={missingPct} />
              </div>
              <Progress value={missingPct} className='mt-2 h-1.5' />
            </div>
            <div className='rounded-lg border bg-card p-4'>
              <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.1em]'>Baris Duplikat</p>
              <div className='mt-1 flex items-center gap-2'>
                <span className='text-2xl font-bold tabular-nums'>{duplicateRows.toLocaleString()}</span>
                {hasDuplicates && (
                  <Badge variant='secondary'>
                    <AlertCircleIcon className='mr-1 h-3 w-3' />
                    Perlu cek
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <h4 className='flex items-center gap-2 text-sm font-semibold'>
              <FileTextIcon className='size-4 text-muted-foreground' />
              Ringkasan Kolom
            </h4>
            <div className='rounded-lg border overflow-hidden'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50'>
                  <tr>
                    <th className='text-left px-3 py-2 font-medium text-muted-foreground'>Nama Kolom</th>
                    <th className='text-left px-3 py-2 font-medium text-muted-foreground'>Tipe Terdeteksi</th>
                    <th className='text-right px-3 py-2 font-medium text-muted-foreground'>Kosong</th>
                    <th className='text-right px-3 py-2 font-medium text-muted-foreground'>Unik</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {columns.slice(0, 10).map((col) => (
                    <tr key={col.name} className='hover:bg-muted/30'>
                      <td className='px-3 py-2 font-mono text-[12px]'>{col.name}</td>
                      <td className='px-3 py-2'>
                        <Badge variant='outline' className='text-xs'>{col.detected_type}</Badge>
                      </td>
                      <td className='px-3 py-2 text-right text-muted-foreground'>{col.missing_count}</td>
                      <td className='px-3 py-2 text-right text-muted-foreground'>{col.unique_count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {columns.length > 10 && (
                    <tr>
                      <td colSpan={4} className='px-3 py-2 text-center text-muted-foreground text-xs'>
                        ...dan {columns.length - 10} kolom lainnya
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(missingPct > MISSING_THRESHOLDS.medium || hasDuplicates) && (
            <div className='rounded-lg border border-destructive/20 bg-destructive/5 p-3'>
              <div className='flex items-start gap-2'>
                <AlertCircleIcon className='size-4 mt-0.5 shrink-0 text-destructive' />
                <div>
                  <p className='text-sm font-medium text-destructive'>Perhatian Kualitas Data</p>
                  <ul className='mt-1 ml-5 list-disc text-xs text-muted-foreground space-y-0.5'>
                    {missingPct > MISSING_THRESHOLDS.medium && (
                      <li>{`Data kosong >${MISSING_THRESHOLDS.medium}% — beberapa metode statistik mungkin tidak valid`}</li>
                    )}
                    {hasDuplicates && (
                      <li>{duplicateRows.toLocaleString()} baris duplikat — pertimbangkan operasi <code className='font-mono'>remove_duplicates</code></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}