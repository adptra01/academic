'use client';

import { useEffect, useState } from 'react';
import { 
  ChevronRightIcon, 
  FileTextIcon, 
  ArrowLeftIcon, 
  DownloadIcon, 
  CheckCircleIcon, 
  AlertCircleIcon,
  RefreshCwIcon,
  Loader2Icon,
  ExternalLinkIcon,
  HistoryIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGuidedAPI } from '../hooks/useGuidedAPI';
import type { WizardDraft } from '../types';
import { ResultNarrative } from '@/components/ResultNarrative';
import type { RunOut, MethodId } from '@/components/ResultNarrative/types';

type Step5ResultNarrativeProps = {
  draft: WizardDraft;
  updateDraft: (patch: Partial<WizardDraft>) => void;
  prevStep: () => void;
  reset: () => void;
  projectId: string;
};

export function Step5ResultNarrative({ draft, updateDraft, prevStep, reset, projectId }: Step5ResultNarrativeProps) {
  const { runGuidedAnalysis } = useGuidedAPI();
  const [result, setResult] = useState<any>(draft.result || null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Auto-run analysis when entering step 5 with configId
  useEffect(() => {
    if (draft.configId && !draft.analysisUid && !result) {
      runAnalysis();
    }
  }, [draft.configId, draft.currentStep]);

  const runAnalysis = async () => {
    if (!draft.configId) return;
    
    setRunning(true);
    try {
      const analysisResult = await runGuidedAnalysis(draft.configId);
      setResult(analysisResult);
      updateDraft({ 
        analysisUid: analysisResult.analysis_uid,
        result: analysisResult,
        currentStep: 5 
      });
    } catch (err) {
      console.error('Analysis failed:', err);
      alert('Analisis gagal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!draft.analysisUid) return;
    
    setExporting(format);
    try {
      const { downloadExport } = await import('@/lib/api');
      await downloadExport(draft.analysisUid, format);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Ekspor gagal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(null);
    }
  };

  const handleNewAnalysis = () => {
    reset();
  };

  const handleBackToManual = () => {
    window.location.href = `/projects/${projectId}?mode=manual&config=${draft.configId}`;
  };

  if (running && !result) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-200px)]'>
        <div className='flex flex-col items-center gap-3'>
          <Loader2Icon className='size-10 animate-spin text-primary' />
          <p className='text-muted-foreground'>Menjalankan analisis statistik...</p>
          <p className='text-xs text-muted-foreground'>Ini mungkin memerlukan beberapa detik</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className='space-y-4'>
        <Card>
          <CardContent className='py-12 text-center'>
            <FileTextIcon className='size-12 mx-auto text-muted-foreground' />
            <h3 className='mt-3 font-semibold'>Belum Ada Hasil</h3>
            <p className='mt-1 text-sm text-muted-foreground'>Jalankan analisis dari langkah sebelumnya untuk melihat hasil di sini.</p>
            <Button onClick={prevStep} className='mt-4 gap-1'>
              <ArrowLeftIcon className='size-3.5' />
              Kembali ke Pre-flight
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    chi2_gof: 'Chi-kuadrat Kesesuaian',
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

  const exportFormats = [
    { id: 'pdf', label: 'PDF Report', desc: 'Laporan lengkap dengan narasi' },
    { id: 'html', label: 'HTML', desc: 'Laporan web interaktif' },
    { id: 'docx', label: 'Word (DOCX)', desc: 'Dokumen Word dapat diedit' },
    { id: 'json', label: 'JSON', desc: 'Data mentah untuk pemrosesan lanjut' },
    { id: 'csv', label: 'CSV Tables', desc: 'Tabel hasil untuk spreadsheet' },
    { id: 'markdown', label: 'Markdown', desc: 'Dokumentasi teknis ringan' },
  ];

  return (
    <div className='space-y-4 h-[calc(100vh-180px)] flex flex-col'>
      {/* Header with Analysis Info */}
      <Card className='border-primary/30 bg-primary/5'>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between flex-wrap gap-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <CheckCircleIcon className='size-5' />
              </div>
              <div>
                <p className='font-semibold'>{METHOD_LABELS[result.method] || result.method}</p>
                <p className='text-sm text-muted-foreground font-mono'>
                  Analysis ID: {result.analysis_uid} · Hash: {result.result_hash.slice(0, 16)}...
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className='text-xs'>
                <HistoryIcon className='size-3 mr-1' />
                {result.warnings.length > 0 ? `${result.warnings.length} Peringatan` : 'Tidak Ada Peringatan'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result Narrative - Using ResultNarrative component */}
      <Card className='flex-1 flex flex-col'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileTextIcon className='size-4' />
            Narasi Hasil Analisis
          </CardTitle>
          <CardDescription>Hasil terstruktur 7 bagian: Ringkasan, Peringatan, Deskriptif, Inferensial, Interpretasi, Metodologi, Reproduktibilitas</CardDescription>
        </CardHeader>
        <CardContent className='flex-1 overflow-hidden p-0'>
          <ScrollArea className='h-full'>
            <div className='p-4 space-y-6'>
              <ResultNarrative
                result={result.result as RunOut}
                method={result.method as MethodId}
                config={{
                  variables: draft.variables,
                  params: draft.params,
                  datasetVersionId: draft.datasetVersionId,
                  projectId,
                  datasetFilename: undefined,
                  datasetVersionNumber: draft.datasetVersion,
                  preprocessingOps: [],
                  randomSeeds: {},
                  missingPolicy: 'listwise',
                  analysisId: result.analysis_uid,
                  analysisHash: result.result_hash,
                }}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='font-semibold text-sm'>Ekspor Hasil</p>
              <p className='text-xs text-muted-foreground'>6 format tersedia</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {exportFormats.map(fmt => (
                <Button
                  key={fmt.id}
                  variant='outline'
                  size='sm'
                  onClick={() => handleExport(fmt.id)}
                  disabled={exporting === fmt.id}
                  className='gap-1'
                >
                  {exporting === fmt.id ? <Loader2Icon className='size-3.5 animate-spin' /> : <DownloadIcon className='size-3.5' />}
                  {fmt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Actions */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between flex-wrap gap-4'>
            <div className='flex items-center gap-2'>
              <Button variant='outline' onClick={handleBackToManual} className='gap-1'>
                <ExternalLinkIcon className='size-3.5' />
                Kembali ke Mode Manual
              </Button>
              <Button variant='outline' onClick={runAnalysis} disabled={running} className='gap-1'>
                <RefreshCwIcon className='size-3.5' />
                Jalankan Ulang
              </Button>
            </div>
            <Button onClick={handleNewAnalysis} variant='destructive' className='gap-1'>
              <HistoryIcon className='size-3.5' />
              Analisis Baru (Reset Wizard)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}