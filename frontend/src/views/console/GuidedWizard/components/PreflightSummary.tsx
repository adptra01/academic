'use client';

import { 
  XCircleIcon, 
  AlertCircleIcon, 
  InfoIcon, 
  CheckCircleIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  ShieldIcon,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PreflightIssue } from '../types';

type PreflightSummaryProps = {
  issues: PreflightIssue[];
  acknowledgedConfirmations: string[];
  onAcknowledge: (code: string) => void;
  onResolveBlocker?: (code: string) => void;
  showAll?: boolean;
};

const LEVEL_CONFIG = {
  blocking: {
    label: 'Blokir',
    icon: XCircleIcon,
    color: 'destructive',
    bg: 'bg-destructive/10 border-destructive/30',
    iconColor: 'text-destructive',
    description: 'Harus diperbaiki sebelum bisa lanjut',
  },
  confirmation: {
    label: 'Konfirmasi',
    icon: AlertCircleIcon,
    color: 'warning',
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    description: 'Perlu persetujuan eksplisit Anda',
  },
  warning: {
    label: 'Peringatan',
    icon: InfoIcon,
    color: 'info',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    description: 'Informasi saja, bisa lanjut',
  },
} as const;

function IssueCard({ issue, isAcknowledged, onAcknowledge, onResolveBlocker, index }: { 
  issue: PreflightIssue; 
  isAcknowledged: boolean;
  onAcknowledge: (code: string) => void;
  onResolveBlocker?: (code: string) => void;
  index: number;
}) {
  const config = LEVEL_CONFIG[issue.level];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn('overflow-hidden transition-all duration-200', config.bg)}>
      <CardContent className='p-0'>
        <div className={cn('flex items-start gap-3 p-4', expanded && 'bg-muted/30')}>
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', config.iconColor)}>
            <Icon className='size-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <Badge variant={issue.level === 'blocking' ? 'destructive' : issue.level === 'confirmation' ? 'secondary' : 'outline'} className='text-xs'>
                    {config.label}
                  </Badge>
                  <span className='font-mono text-[10px] text-muted-foreground'>{issue.code}</span>
                </div>
                <p className='mt-1 text-sm font-medium'>{issue.message}</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>{issue.fix}</p>
                {issue.details && expanded && (
                  <pre className='mt-2 p-2 text-[10px] font-mono rounded bg-muted overflow-auto max-h-32'>
                    {JSON.stringify(issue.details, null, 2)}
                  </pre>
                )}
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                {issue.level === 'blocking' && onResolveBlocker && (
                  <Button size='sm' variant='destructive' onClick={() => onResolveBlocker(issue.code)} className='gap-1'>
                    <ShieldIcon className='size-3.5' />
                    Perbaiki
                  </Button>
                )}
                {issue.level === 'confirmation' && !isAcknowledged && (
                  <Button size='sm' onClick={() => onAcknowledge(issue.code)} className='gap-1' variant='default'>
                    <CheckCircleIcon className='size-3.5' />
                    Setuju
                  </Button>
                )}
                {issue.level === 'confirmation' && isAcknowledged && (
                  <Badge variant='default' className='gap-1'>
                    <CheckCircleIcon className='size-3' />
                    Disetujui
                  </Badge>
                )}
                <Button 
                  variant='ghost' 
                  size='icon' 
                  onClick={() => setExpanded(!expanded)}
                  className='text-muted-foreground hover:text-foreground'
                  aria-label={expanded ? 'Sembunyikan detail' : 'Tampilkan detail'}
                >
                  {expanded ? <ChevronUpIcon className='size-4' /> : <ChevronDownIcon className='size-4' />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PreflightSummary({ 
  issues, 
  acknowledgedConfirmations, 
  onAcknowledge, 
  onResolveBlocker,
  showAll = true 
}: PreflightSummaryProps) {
  const [filter, setFilter] = useState<'all' | 'blocking' | 'confirmation' | 'warning'>('all');
  
  const filteredIssues = showAll 
    ? issues 
    : issues.filter(i => filter === 'all' || i.level === filter);

  const blockers = issues.filter(i => i.level === 'blocking');
  const confirmations = issues.filter(i => i.level === 'confirmation');
  const warnings = issues.filter(i => i.level === 'warning');
  
  const unacknowledgedConfirmations = confirmations.filter(c => !acknowledgedConfirmations.includes(c.code));
  const canProceed = blockers.length === 0 && unacknowledgedConfirmations.length === 0;

  if (issues.length === 0) {
    return (
      <Card className='border-green-200 bg-green-50 dark:bg-green-900/20'>
        <CardContent className='p-6 text-center'>
          <div className='flex size-12 mx-auto items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-400'>
            <CheckCircleIcon className='size-6' />
          </div>
          <h3 className='mt-3 font-semibold text-green-800 dark:text-green-200'>Semua Pemeriksaan Lulus</h3>
          <p className='mt-1 text-sm text-green-600 dark:text-green-400'>
            Tidak ada isu yang mencegah analisis. Anda bisa melanjutkan ke eksekusi.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Summary Header */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive'>
                <XCircleIcon className='size-5' />
              </div>
              <div>
                <p className='font-semibold'>Pre-flight Validation</p>
                <p className='text-xs text-muted-foreground'>
                  {blockers.length} Blokir · {confirmations.length} Konfirmasi · {warnings.length} Peringatan
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as typeof filter)}
                className='text-xs border rounded px-2 py-1 bg-background'
                aria-label='Filter isu'
              >
                <option value='all'>Semua ({issues.length})</option>
                <option value='blocking'>Blokir ({blockers.length})</option>
                <option value='confirmation'>Konfirmasi ({confirmations.length})</option>
                <option value='warning'>Peringatan ({warnings.length})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      <ScrollArea className='h-[calc(100vh-400px)] max-h-96 min-h-[200px]'>
        <div className='space-y-3 p-1 pr-3'>
          {(() => {
            const levels = ['blocking', 'confirmation', 'warning'] as const;
            return levels.map((level) => {
              const levelIssues = filteredIssues.filter(i => i.level === level);
              if (levelIssues.length === 0) return null;
              
              const config = LEVEL_CONFIG[level];
              const Icon = config.icon;
              
              return (
                <div key={level} className='space-y-2'>
                  <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]'>
                    <Icon className={cn('size-3', config.iconColor)} />
                    {config.label} ({levelIssues.length}) — {config.description}
                  </div>
                  {levelIssues.map((issue, idx) => (
                    <IssueCard
                      key={`${issue.code}-${idx}`}
                      issue={issue}
                      isAcknowledged={acknowledgedConfirmations.includes(issue.code)}
                      onAcknowledge={onAcknowledge}
                      onResolveBlocker={onResolveBlocker}
                      index={idx}
                    />
                  ))}
                </div>
              );
            });
          })()}
        </div>
      </ScrollArea>

      {/* Action Status */}
      <Card className={cn(canProceed ? 'border-green-200 bg-green-50' : 'border-destructive/20 bg-destructive/5')}>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className={cn('flex size-8 items-center justify-center rounded-full', canProceed ? 'bg-green-100 text-green-600' : 'bg-destructive/10 text-destructive')}>
                {canProceed ? <CheckCircleIcon className='size-4' /> : <XCircleIcon className='size-4' />}
              </div>
              <div>
                <p className={cn('font-semibold text-sm', canProceed ? 'text-green-800' : 'text-destructive')}>
                  {canProceed ? 'Siap Eksekusi' : 'Tidak Bisa Lanjut'}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {canProceed 
                    ? 'Semua blocker teratasi dan konfirmasi disetujui' 
                    : blockers.length > 0 
                      ? `${blockers.length} blocker harus diperbaiki${unacknowledgedConfirmations.length > 0 ? `, ${unacknowledgedConfirmations.length} konfirmasi belum disetujui` : ''}`
                      : `${unacknowledgedConfirmations.length} konfirmasi perlu disetujui`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}