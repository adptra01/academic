'use client';

import { useState } from 'react';
import { CheckIcon, AlertCircleIcon, InfoIcon, Edit2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import VariablePicker from '@/components/academic/variable-picker';
import type { RecommendationItem } from '../types';

type VariableRecommendationProps = {
  recommendations: RecommendationItem[];
  selectedMethod: string | null;
  onMethodSelect: (methodId: string) => void;
  onVariablesChange: (variables: Record<string, string[]>) => void;
  onParamsChange: (params: Record<string, string>) => void;
  currentVariables: Record<string, string[]>;
  currentParams: Record<string, string>;
  availableVariables: { id?: string; name: string; var_type: string; var_role: string }[];
  methodSpec: any | null;
  isLoading?: boolean;
};

export function VariableRecommendation({
  recommendations,
  selectedMethod,
  onMethodSelect,
  onVariablesChange,
  onParamsChange,
  currentVariables,
  currentParams,
  availableVariables,
  methodSpec,
  isLoading,
}: VariableRecommendationProps) {
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const rec = recommendations.find(r => r.method_id === selectedMethod);
  const isMethodSelected = !!selectedMethod;

  return (
    <div className='space-y-4'>
      {/* Method Selection Cards */}
      <div>
        <h4 className='mb-3 text-sm font-semibold flex items-center gap-2'>
          <InfoIcon className='size-4 text-muted-foreground' />
          Pilih Metode Statistik
        </h4>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {recommendations.map((recItem) => {
            const isSelected = selectedMethod === recItem.method_id;
            const confidencePct = Math.round(recItem.confidence * 100);
            
            return (
              <Card
                key={recItem.method_id}
                className={cn(
                  'cursor-pointer transition-all duration-200 overflow-hidden',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50 hover:shadow-md'
                )}
                onClick={() => onMethodSelect(recItem.method_id)}
              >
                <CardContent className='p-4 space-y-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='font-semibold text-sm'>{recItem.method_id}</span>
                        <Badge variant={isSelected ? 'default' : 'outline'} className='text-xs'>
                          {confidencePct}% cocok
                        </Badge>
                      </div>
                      {recItem.warnings && recItem.warnings.length > 0 && (
                        <p className='mt-1 text-xs text-destructive flex items-center gap-1'>
                          <AlertCircleIcon className='size-3' />
                          {recItem.warnings[0]}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2Icon className='size-5 text-primary shrink-0' />
                    )}
                  </div>
                  
                  <div className='space-y-1.5 text-xs'>
                    <p className='font-medium text-muted-foreground'>Variabel disarankan:</p>
                    {Object.entries(recItem.variable_mapping).map(([role, column]) => (
                      <div key={role} className='flex items-center gap-2 text-[11px]'>
                        <span className='text-muted-foreground font-medium'>{role}:</span>
                        <Badge variant='outline' className='text-[10px] font-mono'>{column}</Badge>
                        {recItem.assumptions_check?.[role] && (
                          <Badge 
                            variant={recItem.assumptions_check[role] === 'pass' ? 'default' : 'secondary'} 
                            className='text-[9px]'
                          >
                            {recItem.assumptions_check[role]}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {recItem.alternatives && recItem.alternatives.length > 0 && (
                    <div className='pt-2 border-t text-[10px] text-muted-foreground'>
                      Alternatif: {recItem.alternatives.join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Selected Method Detail & Variable Confirmation */}
      {isMethodSelected && rec && methodSpec && (
        <Card className='border-primary/30 bg-primary/5'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <CheckCircle2Icon className='size-4.5' />
                </div>
                <div>
                  <CardTitle className='text-base'>{rec.method_id}</CardTitle>
                  <CardDescription className='text-xs'>
                    Confidence: {Math.round(rec.confidence * 100)}% · {Object.keys(rec.variable_mapping).length} variabel dimapping
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant='ghost' 
                size='sm' 
                onClick={() => setShowCustomPicker(!showCustomPicker)}
                className='gap-1'
              >
                <Edit2Icon className='size-3.5' />
                {showCustomPicker ? 'Sembunyikan Editor' : 'Ubah Variabel/Parameter'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Variable Mapping Confirmation */}
            <div className='space-y-3'>
              <h5 className='font-semibold text-sm flex items-center gap-2'>
                <InfoIcon className='size-4 text-muted-foreground' />
                Konfirmasi Mapping Variabel
              </h5>
              <p className='text-xs text-muted-foreground'>
                Sistem telah memetakan variabel berdasarkan kategori tujuan Anda. Periksa dan ubah jika perlu.
              </p>
              
              {Object.entries(rec.variable_mapping).map(([role, column]) => {
                const assumptionStatus = rec.assumptions_check?.[role];
                return (
                  <div key={role} className='flex items-center justify-between gap-3 p-3 rounded-lg border bg-background'>
                    <div className='flex items-center gap-3 min-w-0 flex-1'>
                      <Badge variant='outline' className='text-xs font-medium shrink-0'>{role}</Badge>
                      <div className='min-w-0'>
                        <p className='font-mono text-sm truncate'>{column}</p>
                        {assumptionStatus && (
                          <p className='text-[10px] text-muted-foreground flex items-center gap-1'>
                            <span className={cn(
                              'size-1.5 rounded-full',
                              assumptionStatus === 'pass' && 'bg-green-500',
                              assumptionStatus === 'fail' && 'bg-destructive',
                              assumptionStatus === 'unknown' && 'bg-yellow-500',
                              assumptionStatus === 'not_applicable' && 'bg-muted'
                            )} />
                            Asumsi: {assumptionStatus}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant='outline' className='text-xs shrink-0'>
                      Dikonfirmasi
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Custom Variable Picker */}
            {showCustomPicker && (
              <div className='space-y-4 border-t pt-4'>
                <h5 className='font-semibold text-sm flex items-center gap-2'>
                  <Edit2Icon className='size-4 text-muted-foreground' />
                  Editor Variabel & Parameter Manual
                </h5>
                <VariablePicker
                  spec={methodSpec}
                  variables={availableVariables.map(v => ({ id: v.id || v.name, name: v.name, var_type: v.var_type, var_role: v.var_role }))}
                  value={currentVariables}
                  params={currentParams}
                  onChange={onVariablesChange}
                  onParamsChange={onParamsChange}
                />
              </div>
            )}

            {/* Parameter Summary */}
            {Object.keys(currentParams).length > 0 && (
              <div className='space-y-2 border-t pt-4'>
                <h5 className='font-semibold text-sm flex items-center gap-2'>
                  <InfoIcon className='size-4 text-muted-foreground' />
                  Parameter Metode
                </h5>
                <div className='flex flex-wrap gap-2'>
                  {Object.entries(currentParams).map(([key, value]) => (
                    <Badge key={key} variant='outline' className='text-xs'>
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isMethodSelected && (
        <div className='text-center py-8 text-muted-foreground'>
          <InfoIcon className='size-8 mx-auto mb-2 opacity-50' />
          <p className='text-sm'>Pilih salah satu metode di atas untuk melanjutkan ke konfirmasi variabel</p>
        </div>
      )}

      {isLoading && (
        <div className='flex items-center justify-center py-8'>
          <div className='animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent' />
          <span className='ml-2 text-sm text-muted-foreground'>Memuat rekomendasi...</span>
        </div>
      )}
    </div>
  );
}