'use client';

import { useEffect, useState } from 'react';
import { ChevronRightIcon, SettingsIcon, ArrowLeftIcon, SendIcon, RefreshCwIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VariableRecommendation } from '../components/VariableRecommendation';
import { MethodRecommendation } from '../components/MethodRecommendation';
import { useGuidedAPI } from '../hooks/useGuidedAPI';
import type { WizardDraft } from '../types';

type Step3VariableConfirmProps = {
  draft: WizardDraft;
  updateDraft: (patch: Partial<WizardDraft>) => void;
  nextStep: () => void;
  prevStep: () => void;
  projectId: string;
};

export function Step3VariableConfirm({ draft, updateDraft, nextStep, prevStep, projectId }: Step3VariableConfirmProps) {
  const { recommendMethods, getMethodSpec, createGuidedConfig } = useGuidedAPI();
  const [recommendations, setRecommendations] = useState<import('../types').RecommendationItem[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(draft.selectedMethod ?? null);
  const [methodSpec, setMethodSpec] = useState<{ variables?: Record<string, unknown>; params?: Record<string, unknown> } | null>(null);
  const [availableVariables, setAvailableVariables] = useState<{ name: string; var_type: string; var_role: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [fallbackMethod, setFallbackMethod] = useState('descriptive');

  // Load recommendations when intent is available
  useEffect(() => {
    if (draft.intentId) {
      loadRecommendations();
    }
  }, [draft.intentId]);

  // Load method spec when method changes
  useEffect(() => {
    if (selectedMethod) {
      loadMethodSpec(selectedMethod);
    }
  }, [selectedMethod]);

  const loadRecommendations = async () => {
    if (!draft.intentId) return;
    setLoading(true);
    try {
      const response = await recommendMethods(draft.intentId);
      setRecommendations(response.recommendations);
      setFallbackMethod(response.fallback);
      if (!selectedMethod && response.recommendations.length > 0) {
        setSelectedMethod(response.recommendations[0].method_id);
        updateDraft({ selectedMethod: response.recommendations[0].method_id });
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMethodSpec = async (methodId: string) => {
    try {
      const spec = await getMethodSpec(methodId);
      setMethodSpec(spec);
    } catch (err) {
      console.error('Failed to load method spec:', err);
    }
  };

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethod(methodId || null);
    updateDraft({ selectedMethod: methodId || undefined });
  };

  const handleVariablesChange = (variables: Record<string, string[]>) => {
    updateDraft({ variables });
  };

  const handleParamsChange = (params: Record<string, string>) => {
    updateDraft({ params });
  };

  const handleSaveConfig = async () => {
    if (!selectedMethod || !draft.intentId || !draft.datasetVersionId) return;
    
    setSavingConfig(true);
    try {
      const config = await createGuidedConfig({
        project_id: projectId,
        dataset_version_id: draft.datasetVersionId,
        method: selectedMethod,
        variables: draft.variables,
        params: draft.params,
        research_intent_id: draft.intentId,
        wizard_step: 3,
      });
      updateDraft({ configId: config.id });
      nextStep();
    } catch (err: any) {
      console.error('Failed to save config:', err);
    } finally {
      setSavingConfig(false);
    }
  };



  const handleSaveConfigWithAPI = async () => {
    if (!selectedMethod || !draft.intentId || !draft.datasetVersionId) return;
    
    setSavingConfig(true);
    try {
      const config = await createGuidedConfig({
        project_id: projectId,
        dataset_version_id: draft.datasetVersionId,
        method: selectedMethod,
        variables: draft.variables,
        params: draft.params,
        research_intent_id: draft.intentId,
        wizard_step: 3,
      });
      updateDraft({ configId: config.id, currentStep: 4 });
      nextStep();
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Gagal menyimpan konfigurasi: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSavingConfig(false);
    }
  };

  const canProceed = !!selectedMethod && Object.keys(draft.variables).length > 0;

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <SettingsIcon className='size-5' />
            </div>
            <div>
              <CardTitle>Konfirmasi Variabel & Parameter</CardTitle>
              <CardDescription>Sistem merekomendasikan metode dan mapping variabel. Periksa dan sesuaikan jika perlu.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Method Recommendations */}
          <MethodRecommendation
            recommendations={recommendations}
            selectedMethod={selectedMethod}
            onSelect={handleMethodSelect}
            fallbackMethod={fallbackMethod}
          />

          {/* Variable Confirmation */}
          {selectedMethod && methodSpec && (
            <VariableRecommendation
              recommendations={recommendations}
              selectedMethod={selectedMethod}
              onMethodSelect={handleMethodSelect}
              onVariablesChange={handleVariablesChange}
              onParamsChange={handleParamsChange}
              currentVariables={draft.variables}
              currentParams={draft.params}
              availableVariables={availableVariables}
              methodSpec={methodSpec}
              isLoading={loading}
            />
          )}

          {/* Action Buttons */}
          <div className='flex items-center justify-between pt-4 border-t'>
            <Button variant='outline' onClick={prevStep} className='gap-1'>
              <ArrowLeftIcon className='size-3.5' />
              Kembali
            </Button>
            <div className='flex items-center gap-2'>
              <Button 
                variant='outline' 
                onClick={loadRecommendations} 
                disabled={loading}
                className='gap-1'
              >
                <RefreshCwIcon className='size-3.5' />
                Muat Ulang Rekomendasi
              </Button>
              <Button 
                onClick={handleSaveConfigWithAPI} 
                disabled={!canProceed || savingConfig}
                className='gap-2'
              >
                {savingConfig ? 'Menyimpan...' : 'Simpan & Lanjut ke Pre-flight'}
                <SendIcon className='size-4' />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className='fixed inset-0 bg-background/80 flex items-center justify-center z-50'>
          <div className='flex items-center gap-3 p-6 rounded-lg border bg-card'>
            <div className='animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent' />
            <span>Memuat rekomendasi metode...</span>
          </div>
        </div>
      )}
    </div>
  );
}