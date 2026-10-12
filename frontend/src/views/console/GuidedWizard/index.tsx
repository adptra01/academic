'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XIcon, 
  SettingsIcon, 
  DatabaseIcon, 
  TargetIcon, 
  ShieldIcon, 
  FileTextIcon,
  ArrowLeftIcon,
  RotateCcwIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWizardState } from './hooks/useWizardState';
import { WizardProgress } from './components/WizardProgress';
import { Step1DataReady } from './steps/Step1_DataReady';
import { Step2ResearchIntent } from './steps/Step2_ResearchIntent';
import { Step3VariableConfirm } from './steps/Step3_VariableConfirm';
import { Step4PreflightGate } from './steps/Step4_PreflightGate';
import { Step5ResultNarrative } from './steps/Step5_ResultNarrative';

const STEP_ICONS = [DatabaseIcon, TargetIcon, SettingsIcon, ShieldIcon, FileTextIcon];
const STEP_TITLES = ['Data Siap', 'Tujuan Penelitian', 'Konfirmasi Variabel', 'Gerbang Pre-flight', 'Narasi Hasil'];

type GuidedWizardProps = {
  projectId: string;
  datasetId: string;
  datasetVersion: number;
  onClose?: () => void;
  onSwitchToManual?: (configId: string) => void;
};

export function GuidedWizard({ projectId, datasetId, datasetVersion, onClose, onSwitchToManual }: GuidedWizardProps) {
  const { 
    draft, 
    hydrated, 
    updateDraft, 
    nextStep, 
    prevStep, 
    goToStep, 
    reset, 
    hydrateFromStorage 
  } = useWizardState(projectId);

  const [mounted, setMounted] = useState(false);
  const [datasetVersionId, setDatasetVersionId] = useState<string>('');

  // Fetch dataset version UUID on mount
  useEffect(() => {
    const fetchVersionId = async () => {
      try {
        const { api } = await import('@/lib/api');
        const dataset = await api<{ versions: { version_number: number; id: string }[] }>(`/api/v1/datasets/${datasetId}`);
        const version = dataset.versions.find(v => v.version_number === datasetVersion);
        if (version) {
          setDatasetVersionId(version.id);
        }
      } catch (err) {
        console.error('Failed to fetch dataset version UUID:', err);
      }
    };
    fetchVersionId();
  }, [datasetId, datasetVersion]);

  // Initialize draft with provided dataset info
  useEffect(() => {
    if (mounted && hydrated && datasetVersionId && (!draft.datasetId || draft.datasetId !== datasetId)) {
      updateDraft({ 
        projectId, 
        datasetId, 
        datasetVersionId,
        datasetVersion, // Store version number for profile fetching
        currentStep: 1 
      });
    }
  }, [mounted, hydrated, datasetId, datasetVersionId, datasetVersion, projectId, draft.datasetId, updateDraft]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !hydrated) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-200px)]'>
        <div className='animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent' />
      </div>
    );
  }

  if (!datasetVersionId) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-200px)]'>
        <div className='animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent' />
        <p className='ml-3 text-muted-foreground'>Memuat versi dataset...</p>
      </div>
    );
  }

  const completedSteps = Array.from({ length: draft.currentStep - 1 }, (_, i) => i + 1);

  const renderStep = () => {
    switch (draft.currentStep) {
      case 1:
        return <Step1DataReady draft={draft} updateDraft={updateDraft} nextStep={nextStep} projectId={projectId} />;
      case 2:
        return <Step2ResearchIntent draft={draft} updateDraft={updateDraft} nextStep={nextStep} prevStep={prevStep} projectId={projectId} />;
      case 3:
        return <Step3VariableConfirm draft={draft} updateDraft={updateDraft} nextStep={nextStep} prevStep={prevStep} projectId={projectId} />;
      case 4:
        return <Step4PreflightGate draft={draft} updateDraft={updateDraft} nextStep={nextStep} prevStep={prevStep} projectId={projectId} />;
      case 5:
        return <Step5ResultNarrative draft={draft} updateDraft={updateDraft} prevStep={prevStep} reset={reset} projectId={projectId} />;
      default:
        return null;
    }
  };

  const canGoBack = draft.currentStep > 1;
  const isLastStep = draft.currentStep === 5;

  return (
    <div className='flex h-[calc(100vh-120px)] flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between border-b p-4 bg-background'>
        <div className='flex items-center gap-4'>
          {onClose && (
            <Button variant='ghost' size='icon' onClick={onClose} className='h-9 w-9'>
              <XIcon className='size-4' />
            </Button>
          )}
          <div className='flex items-center gap-2'>
            <div className='flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <SettingsIcon className='size-5' />
            </div>
            <div>
              <h1 className='font-semibold text-lg'>Wizard Analisis Terpandu</h1>
              <p className='text-xs text-muted-foreground'>5 langkah: Data → Tujuan → Variabel → Pre-flight → Hasil</p>
            </div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className='text-xs'>
            Mode: Otomatis Terpandu
          </Badge>
          {onSwitchToManual && draft.configId && (
            <Button variant='outline' size='sm' onClick={() => onSwitchToManual(draft.configId!)} className='gap-1'>
              <ArrowLeftIcon className='size-3.5' />
              Beralih ke Manual
            </Button>
          )}
        </div>
      </div>

      {/* Progress & Content */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Sidebar Progress */}
        <div className='w-64 lg:w-72 shrink-0 border-r bg-muted/30 p-4 overflow-y-auto'>
          <WizardProgress 
            currentStep={draft.currentStep} 
            completedSteps={completedSteps} 
          />
          
          <div className='mt-6 pt-4 border-t space-y-2'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]'>Aksi Cepat</p>
            <Button variant='outline' className='w-full justify-start gap-2' onClick={() => goToStep(1)}>
              <DatabaseIcon className='size-3.5' />
              Kembali ke Data
            </Button>
            <Button variant='outline' className='w-full justify-start gap-2' onClick={() => goToStep(2)} disabled={draft.currentStep < 2}>
              <TargetIcon className='size-3.5' />
              Ubah Tujuan
            </Button>
            <Button variant='outline' className='w-full justify-start gap-2' onClick={() => goToStep(3)} disabled={draft.currentStep < 3}>
              <SettingsIcon className='size-3.5' />
              Ubah Variabel
            </Button>
            <Button variant='outline' className='w-full justify-start gap-2' onClick={() => goToStep(4)} disabled={draft.currentStep < 4}>
              <ShieldIcon className='size-3.5' />
              Lihat Pre-flight
            </Button>
            <div className='pt-2'>
              <Button variant='destructive' className='w-full justify-start gap-2' onClick={reset}>
                <RotateCcwIcon className='size-3.5' />
                Reset Wizard
              </Button>
              <p className='mt-1 text-[10px] text-muted-foreground text-center'>
                Menghapus draft lokal, memulai dari awal
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className='flex-1 overflow-y-auto p-6 lg:p-8'>
          <div className='max-w-4xl mx-auto w-full'>
            {/* Step Indicator */}
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                {(() => {
                  const Icon = STEP_ICONS[draft.currentStep - 1];
                  return <Icon className='size-5 text-primary' />;
                })()}
                <div>
                  <p className='font-semibold'>{STEP_TITLES[draft.currentStep - 1]}</p>
                  <p className='text-xs text-muted-foreground'>Langkah {draft.currentStep} dari 5</p>
                </div>
              </div>
              <div className='flex items-center gap-1'>
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-1.5 rounded transition-colors ${
                      i < draft.currentStep - 1 ? 'bg-primary' : 
                      i === draft.currentStep - 1 ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step Content */}
            {renderStep()}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className='border-t p-4 bg-background flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-2'>
          <Badge variant={draft.currentStep === 1 ? 'default' : 'outline'} className='text-xs'>
            1. Data Siap
          </Badge>
          <ChevronRightIcon className='size-3.5 text-muted-foreground' />
          <Badge variant={draft.currentStep === 2 ? 'default' : 'outline'} className='text-xs'>
            2. Tujuan
          </Badge>
          <ChevronRightIcon className='size-3.5 text-muted-foreground' />
          <Badge variant={draft.currentStep === 3 ? 'default' : 'outline'} className='text-xs'>
            3. Variabel
          </Badge>
          <ChevronRightIcon className='size-3.5 text-muted-foreground' />
          <Badge variant={draft.currentStep === 4 ? 'default' : 'outline'} className='text-xs'>
            4. Pre-flight
          </Badge>
          <ChevronRightIcon className='size-3.5 text-muted-foreground' />
          <Badge variant={draft.currentStep === 5 ? 'default' : 'outline'} className='text-xs'>
            5. Hasil
          </Badge>
        </div>
        <div className='flex items-center gap-2 ml-auto'>
          {canGoBack && (
            <Button variant='outline' onClick={prevStep} className='gap-1'>
              <ChevronLeftIcon className='size-3.5' />
              Kembali
            </Button>
          )}
          {!isLastStep && draft.currentStep < 5 && (
            <Button onClick={nextStep} disabled={draft.currentStep === 1 && !draft.datasetId} className='gap-1'>
              Lanjut
              <ChevronRightIcon className='size-3.5' />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuidedWizard;