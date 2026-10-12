'use client';

import { ChevronRightIcon, CheckIcon, HelpCircleIcon, AlertCircleIcon, FileTextIcon, TargetIcon, DatabaseIcon, SettingsIcon, CheckCircle2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepInfo = {
  number: number;
  title: string;
  icon: React.ElementType;
  description: string;
};

const STEPS: StepInfo[] = [
  { number: 1, title: 'Data Siap', icon: DatabaseIcon, description: 'Ringkasan dataset & kualitas' },
  { number: 2, title: 'Tujuan Penelitian', icon: TargetIcon, description: 'Pilih kategori & pertanyaan' },
  { number: 3, title: 'Konfirmasi Variabel', icon: SettingsIcon, description: 'Sistem sarankan, Anda konfirmasi' },
  { number: 4, title: 'Gerbang Pre-flight', icon: AlertCircleIcon, description: 'Blokir/Konfirmasi/Peringatan' },
  { number: 5, title: 'Narasi Hasil', icon: FileTextIcon, description: 'Hasil terstruktur & ekspor' },
];

type WizardProgressProps = {
  currentStep: number;
  completedSteps?: number[];
  className?: string;
};

export function WizardProgress({ currentStep, completedSteps = [], className }: WizardProgressProps) {
  return (
    <nav aria-label='Progres wizard' className={cn('space-y-2', className)}>
      {STEPS.map((step, index) => {
        const isCurrent = step.number === currentStep;
        const isCompleted = completedSteps.includes(step.number);
        const isPast = step.number < currentStep;
        const isFuture = step.number > currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.number} className='relative flex items-start gap-4'>
            {!isLast && (
              <div className={cn('absolute left-4 top-10 h-full w-0.5', isPast || isCompleted ? 'bg-primary/30' : 'bg-border')} />
            )}
            <div
              className={cn(
                'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                isCompleted
                  ? 'bg-primary border-primary text-primary-foreground'
                  : isCurrent
                  ? 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-background border-border text-muted-foreground'
              )}
            >
              {isCompleted ? (
                <CheckIcon className='size-4' strokeWidth={2.5} />
              ) : isCurrent ? (
                <span className='text-sm font-semibold'>{step.number}</span>
              ) : (
                <span className='text-sm font-medium'>{step.number}</span>
              )}
            </div>
            <div className='min-w-0 flex-1 pt-1'>
              <div className='flex items-center gap-2'>
                <step.icon className={cn('size-4 shrink-0', isCurrent || isCompleted ? 'text-primary' : 'text-muted-foreground')} aria-hidden='true' />
                <h3 className={cn('font-semibold text-sm', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.title}
                  {isCurrent && <span className='ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium'>Aktif</span>}
                </h3>
              </div>
              <p className='ml-6 text-xs text-muted-foreground leading-relaxed'>{step.description}</p>
            </div>
          </div>
        );
      })}
    </nav>
  );
}