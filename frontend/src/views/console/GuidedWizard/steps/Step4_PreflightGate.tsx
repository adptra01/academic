'use client';

import { useEffect, useState } from 'react';
import { ChevronRightIcon, ShieldIcon, AlertCircleIcon, ArrowLeftIcon, SendIcon, RefreshCwIcon, CheckCircle2Icon, XCircleIcon, InfoIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PreflightSummary } from '../components/PreflightSummary';
import { useGuidedAPI } from '../hooks/useGuidedAPI';
import type { WizardDraft, PreflightIssue } from '../types';

type Step4PreflightGateProps = {
  draft: WizardDraft;
  updateDraft: (patch: Partial<WizardDraft>) => void;
  nextStep: () => void;
  prevStep: () => void;
  projectId: string;
};

export function Step4PreflightGate({ draft, updateDraft, nextStep, prevStep, projectId }: Step4PreflightGateProps) {
  const { confirmConfigAndPreflight, createGuidedConfig } = useGuidedAPI();
  const [preflightResult, setPreflightResult] = useState<{
    ok: boolean;
    issues: PreflightIssue[];
    method_contract?: unknown;
    ma_rules_triggered?: unknown[];
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Auto-run preflight when configId is available or when entering step
  useEffect(() => {
    const runPreflight = async () => {
      if (!draft.configId) {
        // Need to create config first
        if (!draft.selectedMethod || !draft.intentId || !draft.datasetVersionId) return;
        
        setSavingConfig(true);
        try {
          const config = await createGuidedConfig({
            project_id: projectId,
            dataset_version_id: draft.datasetVersionId,
            method: draft.selectedMethod,
            variables: draft.variables,
            params: draft.params,
            research_intent_id: draft.intentId,
            wizard_step: 4,
          });
          updateDraft({ configId: config.id });
          await runPreflightCheck(config.id!);
        } catch (err) {
          console.error('Failed to create config:', err);
        } finally {
          setSavingConfig(false);
        }
      } else {
        await runPreflightCheck(draft.configId);
      }
    };

    runPreflight();
  }, [draft.configId, draft.currentStep]);

  const runPreflightCheck = async (configId: string) => {
    setRunning(true);
    try {
      const result = await confirmConfigAndPreflight(configId, draft.acknowledgedConfirmations);
      setPreflightResult(result.preflight);
      updateDraft({ 
        preflight: result.preflight,
        acknowledgedConfirmations: result.config.preflight_result?.issues
          ?.filter((i: PreflightIssue) => i.level === 'confirmation')
          .map((i: PreflightIssue) => i.code) ?? []
      });
    } catch (err) {
      console.error('Preflight failed:', err);
      // If 422 with issues, we can still show them
      if (err instanceof Error && err.message.includes('422')) {
        try {
          const errorData = JSON.parse(err.message.split('{')[1] || '{}');
          if (errorData.issues) {
            setPreflightResult({ ok: false, issues: errorData.issues });
          }
        } catch {
          // ignore parse error
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const handleAcknowledge = (code: string) => {
    updateDraft({
      acknowledgedConfirmations: [...draft.acknowledgedConfirmations, code]
    });
    // Re-run preflight with new acknowledgments
    if (draft.configId) {
      runPreflightCheck(draft.configId);
    }
  };

  const handleProceed = async () => {
    if (!draft.configId || !preflightResult?.ok) return;
    
    setConfirmed(true);
    try {
      // Final confirmation with all acknowledged confirmations
      const result = await confirmConfigAndPreflight(draft.configId, draft.acknowledgedConfirmations);
      if (result.preflight.ok) {
        updateDraft({ currentStep: 5 });
        nextStep();
      } else {
        setPreflightResult(result.preflight);
      }
    } catch (err) {
      console.error('Final confirmation failed:', err);
    } finally {
      setConfirmed(false);
    }
  };

  const blockers = preflightResult?.issues.filter(i => i.level === 'blocking') ?? [];
  const unacknowledgedConfirmations = preflightResult?.issues.filter(
    i => i.level === 'confirmation' && !draft.acknowledgedConfirmations.includes(i.code)
  ) ?? [];
  
  const canProceed = preflightResult?.ok === true && blockers.length === 0 && unacknowledgedConfirmations.length === 0;

  return (
    <div className='space-y-4 h-[calc(100vh-200px)] flex flex-col'>
      <Card className='flex-1 flex flex-col'>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <ShieldIcon className='size-5' />
            </div>
            <div>
              <CardTitle>Gerbang Pre-flight</CardTitle>
              <CardDescription>Validasi otomatis konfigurasi analisis sebelum eksekusi</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='flex-1 overflow-hidden'>
          {running || savingConfig ? (
            <div className='flex items-center justify-center h-full'>
              <div className='flex flex-col items-center gap-3'>
                <Loader2Icon className='size-8 animate-spin text-primary' />
                <p className='text-muted-foreground'>{savingConfig ? 'Menyimpan konfigurasi...' : 'Menjalankan pre-flight validation...'}</p>
              </div>
            </div>
          ) : preflightResult ? (
            <PreflightSummary
              issues={preflightResult.issues}
              acknowledgedConfirmations={draft.acknowledgedConfirmations}
              onAcknowledge={handleAcknowledge}
              showAll={true}
            />
          ) : (
            <div className='flex items-center justify-center h-full text-muted-foreground'>
              <p>Menunggu konfigurasi...</p>
            </div>
          )}
        </CardContent>
        <CardContent className='pt-0'>
          <div className='flex items-center justify-between pt-4 border-t'>
            <Button variant='outline' onClick={prevStep} disabled={running || savingConfig} className='gap-1'>
              <ArrowLeftIcon className='size-3.5' />
              Kembali ke Variabel
            </Button>
            <div className='flex items-center gap-2'>
              <Button 
                variant='outline' 
                onClick={() => draft.configId && runPreflightCheck(draft.configId)}
                disabled={running || !draft.configId}
                className='gap-1'
              >
                <RefreshCwIcon className='size-3.5' />
                Jalankan Ulang Pre-flight
              </Button>
              <Button 
                onClick={handleProceed} 
                disabled={!canProceed || running || confirmed}
                className={canProceed ? 'gap-2' : 'gap-2 opacity-50 cursor-not-allowed'}
              >
                {confirmed ? 'Memproses...' : 'Jalankan Analisis'}
                <ChevronRightIcon className='size-4' />
              </Button>
            </div>
          </div>
          
          {!canProceed && preflightResult && (
            <div className='mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20'>
              <div className='flex items-start gap-2'>
                <XCircleIcon className='size-4 mt-0.5 shrink-0 text-destructive' />
                <div className='text-sm'>
                  <p className='font-medium text-destructive'>Tidak Bisa Lanjut</p>
                  <p className='text-muted-foreground mt-0.5'>
                    {blockers.length > 0 && (
                      <>Ada <strong>{blockers.length}</strong> blokir yang harus diperbaiki.{unacknowledgedConfirmations.length > 0 && ' '}</>
                    )}
                    {unacknowledgedConfirmations.length > 0 && (
                      <>Ada <strong>{unacknowledgedConfirmations.length}</strong> konfirmasi yang belum disetujui.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}