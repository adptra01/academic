'use client';

import { ChevronRightIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon, BrainIcon, ZapIcon, BarChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RecommendationItem } from '../types';

type MethodRecommendationProps = {
  recommendations: RecommendationItem[];
  selectedMethod: string | null;
  onSelect: (methodId: string) => void;
  fallbackMethod: string;
  className?: string;
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  ttest_1samp: BarChartIcon,
  ttest_ind: BarChartIcon,
  ttest_paired: BarChartIcon,
  anova_oneway: BarChartIcon,
  mannwhitney: BarChartIcon,
  wilcoxon: BarChartIcon,
  kruskal: BarChartIcon,
  pearson: ZapIcon,
  spearman: ZapIcon,
  chi2_independence: BrainIcon,
  chi2_gof: BrainIcon,
  linreg_simple: BarChartIcon,
  linreg_multiple: BarChartIcon,
  descriptive: BarChartIcon,
  normality: BrainIcon,
  ml_classify: BrainIcon,
  ml_cluster: BrainIcon,
  text_tfidf: BrainIcon,
  text_lda: BrainIcon,
  apriori: BrainIcon,
};

const METHOD_LABELS: Record<string, string> = {
  descriptive: 'Statistik Deskriptif',
  normality: 'Uji Normalitas',
  pearson: 'Korelasi Pearson',
  spearman: 'Korelasi Spearman',
  ttest_1samp: 'Uji t Satu Sampel',
  ttest_ind: 'Uji t Independen',
  ttest_paired: 'Uji t Berpasangan',
  anova_oneway: 'ANOVA Satu Arah',
  chi2_independence: 'Chi-kuadrat Independensi',
  chi2_gof: 'Chi-kuadrat Goodness-of-fit',
  mannwhitney: 'Mann-Whitney U',
  wilcoxon: 'Wilcoxon Signed-Rank',
  kruskal: 'Kruskal-Wallis',
  linreg_simple: 'Regresi Linier Sederhana',
  linreg_multiple: 'Regresi Linier Berganda',
  ml_classify: 'Klasifikasi ML',
  ml_cluster: 'Clustering ML',
  text_tfidf: 'TF-IDF Vectorization',
  text_lda: 'LDA Topic Modeling',
  apriori: 'Apriori Association',
};

export function MethodRecommendation({
  recommendations,
  selectedMethod,
  onSelect,
  fallbackMethod,
  className,
}: MethodRecommendationProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className='flex items-center justify-between'>
        <h4 className='font-semibold text-sm flex items-center gap-2'>
          <BrainIcon className='size-4 text-muted-foreground' />
          Rekomendasi Metode
        </h4>
        <Badge variant='outline' className='text-xs'>
          Fallback: {METHOD_LABELS[fallbackMethod] || fallbackMethod}
        </Badge>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {recommendations.map((rec) => {
          const isSelected = selectedMethod === rec.method_id;
          const confidencePct = Math.round(rec.confidence * 100);
          const Icon = METHOD_ICONS[rec.method_id] || BrainIcon;
          const label = METHOD_LABELS[rec.method_id] || rec.method_id;

          return (
            <Card
              key={rec.method_id}
              className={cn(
                'relative overflow-hidden cursor-pointer transition-all duration-200',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:shadow-md'
              )}
              onClick={() => onSelect(rec.method_id)}
            >
              {isSelected && (
                <div className='absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5' />
              )}
              <CardContent className='relative p-4 space-y-3'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-center gap-2'>
                    <div className='flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                      <Icon className='size-4' />
                    </div>
                    <div className='min-w-0'>
                      <p className='font-semibold text-sm truncate'>{label}</p>
                      <p className='font-mono text-[10px] text-muted-foreground'>{rec.method_id}</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <Badge variant={isSelected ? 'default' : 'outline'} className='text-xs'>
                      {confidencePct}% match
                    </Badge>
                    {isSelected && <CheckCircleIcon className='size-4 text-primary' />}
                  </div>
                </div>

                <div className='space-y-1.5 text-xs'>
                  <p className='font-medium text-muted-foreground'>Mapping variabel:</p>
                  {Object.entries(rec.variable_mapping).slice(0, 4).map(([role, column]) => (
                    <div key={role} className='flex items-center gap-2 text-[11px]'>
                      <span className='text-muted-foreground font-medium w-20 truncate'>{role}:</span>
                      <Badge variant='outline' className='text-[10px] font-mono flex-1 truncate'>{column}</Badge>
                      {rec.assumptions_check?.[role] && (
                        <Badge 
                          variant={rec.assumptions_check[role] === 'pass' ? 'default' : rec.assumptions_check[role] === 'fail' ? 'destructive' : 'secondary'} 
                          className='text-[9px] shrink-0'
                        >
                          {rec.assumptions_check[role]}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {Object.keys(rec.variable_mapping).length > 4 && (
                    <p className='text-[10px] text-muted-foreground'>+{Object.keys(rec.variable_mapping).length - 4} variabel lain...</p>
                  )}
                </div>

                {rec.warnings && rec.warnings.length > 0 && (
                  <div className='flex items-center gap-1.5 text-[10px] text-destructive'>
                    <AlertCircleIcon className='size-3' />
                    <span className='truncate'>{rec.warnings[0]}</span>
                  </div>
                )}

                {rec.alternatives && rec.alternatives.length > 0 && (
                  <div className='pt-2 border-t flex items-center gap-1.5 text-[10px] text-muted-foreground'>
                    <InfoIcon className='size-3 shrink-0' />
                    <span>Alternatif:</span>
                    <span className='font-mono truncate'>{rec.alternatives.join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedMethod && (
        <Card className='border-primary/30 bg-primary/5'>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <CheckCircleIcon className='size-4.5' />
                </div>
                <div>
                  <p className='font-semibold'>Metode Dipilih: {METHOD_LABELS[selectedMethod] || selectedMethod}</p>
                  <p className='text-xs text-muted-foreground'>
                    Konfiden: {Math.round((recommendations.find(r => r.method_id === selectedMethod)?.confidence ?? 0) * 100)}%
                  </p>
                </div>
              </div>
              <Button variant='ghost' size='sm' onClick={() => onSelect('')} className='gap-1'>
                <ChevronRightIcon className='size-3.5' />
                Ubah Metode
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}