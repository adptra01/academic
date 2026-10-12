'use client';

import { useState } from 'react';
import { ChevronRightIcon, TargetIcon, Edit2Icon, SendIcon, ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { GoalCategoryGrid } from '../components/GoalCategoryCard';
import { useGuidedAPI } from '../hooks/useGuidedAPI';
import type { WizardDraft, GoalCategory, DesignHints } from '../types';

type Step2ResearchIntentProps = {
  draft: WizardDraft;
  updateDraft: (patch: Partial<WizardDraft>) => void;
  nextStep: () => void;
  prevStep: () => void;
  projectId: string;
};

const DESIGN_HINT_OPTIONS: Record<Exclude<GoalCategory, 'custom'>, Partial<DesignHints>> = {
  compare_groups: { design: 'between_subjects', groups: 2, paired: false, outcome_type: 'continuous' },
  test_association: { outcome_type: 'continuous' },
  predict_outcome: { outcome_type: 'continuous', predictors: [] },
  explore_structure: { clusters_expected: 3 },
  describe_data: {},
};

export function Step2ResearchIntent({ draft, updateDraft, nextStep, prevStep, projectId }: Step2ResearchIntentProps) {
  const { createResearchIntent } = useGuidedAPI();
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory | null>(draft.intent?.goal_category ?? null);
  const [userQuestion, setUserQuestion] = useState(draft.intent?.user_question ?? '');
  const [designHints, setDesignHints] = useState<DesignHints>(draft.intent?.design_hints ?? {});
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCategorySelect = (category: GoalCategory) => {
    setSelectedCategory(category);
    if (category !== 'custom' && DESIGN_HINT_OPTIONS[category]) {
      setDesignHints(DESIGN_HINT_OPTIONS[category]);
    }
  };

  const handleSave = async () => {
    if (!selectedCategory || !draft.datasetVersionId) return;
    
    setSaving(true);
    try {
      const intentData = {
        project_id: projectId,
        dataset_version_id: draft.datasetVersionId,
        goal_category: selectedCategory,
        design_hints: selectedCategory === 'custom' ? designHints : DESIGN_HINT_OPTIONS[selectedCategory] || {},
        user_question: userQuestion || undefined,
      };
      
      const intent = await createResearchIntent(intentData);
      updateDraft({ 
        intent: intent, 
        intentId: intent.id,
        currentStep: 3 
      });
      nextStep();
    } catch (err) {
      console.error('Failed to save research intent:', err);
      alert('Gagal menyimpan tujuan penelitian: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const canProceed = !!selectedCategory && (!!userQuestion || selectedCategory !== 'custom');

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <TargetIcon className='size-5' />
            </div>
            <div>
              <CardTitle>Tujuan Penelitian</CardTitle>
              <CardDescription>Pilih kategori tujuan atau tulis pertanyaan Anda sendiri</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Category Selection */}
          <div>
            <h4 className='mb-3 text-sm font-semibold'>Apa tujuan analisis Anda?</h4>
            <GoalCategoryGrid 
              selectedCategory={selectedCategory} 
              onSelect={handleCategorySelect}
            />
          </div>

          {/* Design Hints (for non-custom categories) */}
          {selectedCategory && selectedCategory !== 'custom' && (
            <Card className='bg-muted/30'>
              <CardContent className='pt-0'>
                <h5 className='mb-3 text-sm font-semibold flex items-center gap-2'>
                  <Edit2Icon className='size-4 text-muted-foreground' />
                  Detail Desain (Otomatis)
                </h5>
                <div className='flex flex-wrap gap-2'>
                  {Object.entries(DESIGN_HINT_OPTIONS[selectedCategory] || {}).map(([key, value]) => (
                    <Badge key={key} variant='outline' className='text-xs'>
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
                <Button 
                  variant='ghost' 
                  size='sm' 
                  onClick={() => setShowAdvanced(true)}
                  className='mt-2 gap-1'
                >
                  <Edit2Icon className='size-3.5' />
                  Sesuaikan detail desain
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Custom Question / Advanced Design Hints */}
          {(selectedCategory === 'custom' || showAdvanced) && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>{selectedCategory === 'custom' ? 'Pertanyaan Penelitian' : 'Detail Desain Kustom'}</CardTitle>
                <CardDescription className='text-xs'>
                  {selectedCategory === 'custom' 
                    ? 'Tuliskan pertanyaan penelitian Anda secara bebas. Sistem akan mencoba merekomendasikan metode yang sesuai.'
                    : 'Sesuaikan parameter desain untuk rekomendasi metode yang lebih akurat.'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {selectedCategory === 'custom' && (
                  <div>
                    <label className='block text-sm font-medium mb-2'>Pertanyaan Penelitian Anda *</label>
                    <Textarea
                      value={userQuestion}
                      onChange={e => setUserQuestion(e.target.value)}
                      placeholder='Contoh: Apakah ada perbedaan signifikan rata-rata skor kepuasan pelanggan sebelum dan sesudah program loyalitas diluncurkan?'
                      rows={3}
                      className='rounded-lg'
                    />
                    <p className='mt-1 text-xs text-muted-foreground'>
                      Minimal 20 karakter untuk rekomendasi yang baik
                    </p>
                  </div>
                )}

                {showAdvanced && selectedCategory !== 'custom' && (
                  <div className='space-y-3'>
                    <h6 className='text-sm font-medium'>Parameter Desain</h6>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <DesignHintSelect
                        label='Desain Eksperimen'
                        name='design'
                        value={designHints.design || ''}
                        options={['between_subjects', 'within_subjects', 'mixed', 'observational', 'time_series']}
                        onChange={v => setDesignHints(prev => ({ ...prev, design: v as DesignHints['design'] }))}
                      />
                      <DesignHintSelect
                        label='Jumlah Kelompok'
                        name='groups'
                        value={String(designHints.groups || '')}
                        options={['2', '3', '4', '5+']}
                        onChange={v => setDesignHints(prev => ({ ...prev, groups: parseInt(v) }))}
                      />
                      <DesignHintSelect
                        label='Tipe Outcome'
                        name='outcome_type'
                        value={designHints.outcome_type || ''}
                        options={['continuous', 'binary', 'ordinal', 'nominal', 'count', 'time_to_event']}
                        onChange={v => setDesignHints(prev => ({ ...prev, outcome_type: v as DesignHints['outcome_type'] }))}
                      />
                      <DesignHintSelect
                        label='Berpasangan'
                        name='paired'
                        value={String(designHints.paired || false)}
                        options={['true', 'false']}
                        onChange={v => setDesignHints(prev => ({ ...prev, paired: v === 'true' }))}
                      />
                    </div>
                    <Button 
                      variant='ghost' 
                      size='sm' 
                      onClick={() => setShowAdvanced(false)}
                      className='gap-1'
                    >
                      <ArrowLeftIcon className='size-3.5' />
                      Kembali ke preset
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className='flex items-center justify-between pt-4 border-t'>
            <Button variant='outline' onClick={prevStep} className='gap-1'>
              <ArrowLeftIcon className='size-3.5' />
              Kembali
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!canProceed || saving}
              className='gap-2'
            >
              {saving ? 'Menyimpan...' : 'Simpan & Lanjut ke Variabel'}
              <SendIcon className='size-4' />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DesignHintSelect({ 
  label, 
  name, 
  value, 
  options, 
  onChange 
}: { 
  label: string; 
  name: string; 
  value: string; 
  options: string[]; 
  onChange: (v: string) => void; 
}) {
  return (
    <div className='space-y-1'>
      <label className='text-xs font-medium text-muted-foreground'>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className='w-full rounded-lg border px-3 py-2 text-sm bg-background'
      >
        <option value=''>— Pilih —</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );
}