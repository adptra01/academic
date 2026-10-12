'use client';

import { useEffect } from 'react';
import { ChevronRightIcon, DatabaseIcon, AlertCircleIcon, CheckCircleIcon, ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataQualitySummary } from '../components/DataQualitySummary';
import { useGuidedAPI } from '../hooks/useGuidedAPI';
import type { WizardDraft } from '../types';

type Step1DataReadyProps = {
  draft: WizardDraft;
  updateDraft: (patch: Partial<WizardDraft>) => void;
  nextStep: () => void;
  projectId: string;
};

export function Step1DataReady({ draft, updateDraft, nextStep, projectId }: Step1DataReadyProps) {
  const { getDatasetProfile } = useGuidedAPI();
  const [profile, setProfile] = useState<{
    rows: number;
    cols: number;
    missing_pct: number;
    duplicate_rows: number;
    columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (draft.datasetId && draft.datasetVersionId) {
      loadProfile();
    }
  }, [draft.datasetId, draft.datasetVersionId]);

  const loadProfile = async () => {
    if (!draft.datasetId) return;
    setLoading(true);
    try {
      const version = draft.datasetVersion ?? 1;
      const data = await getDatasetProfile(draft.datasetId, version);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!draft.datasetId) {
    return (
      <div className='space-y-4'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <DatabaseIcon className='size-5' />
              </div>
              <div>
                <CardTitle>Pilih Dataset</CardTitle>
                <CardDescription>Belum ada dataset yang dipilih untuk wizard ini</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => updateDraft({ currentStep: 1 })} variant='outline'>
              Kembali ke pemilihan dataset
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className='space-y-4'>
        <Card>
          <CardContent className='py-12 text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto' />
            <p className='mt-3 text-muted-foreground'>Memuat profil dataset...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <DataQualitySummary
        datasetName={draft.datasetId.slice(0, 8)} // Would be better to pass actual name
        version={1} // Would extract from versionId
        rows={profile.rows}
        cols={profile.cols}
        missingPct={profile.missing_pct}
        duplicateRows={profile.duplicate_rows}
        columns={profile.columns}
        onViewDetails={() => setShowDetailModal(true)}
      />

      <Card className='border-primary/30 bg-primary/5'>
        <CardContent className='p-4'>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <CheckCircleIcon className='size-5' />
            </div>
            <div className='flex-1'>
              <p className='font-semibold'>Dataset Siap untuk Analisis</p>
              <p className='text-sm text-muted-foreground'>
                Kualitas data telah diverifikasi. Anda bisa melanjutkan ke penentuan tujuan penelitian.
              </p>
            </div>
            <Button onClick={nextStep} size='lg' className='gap-2'>
              Lanjut ke Tujuan Penelitian
              <ChevronRightIcon className='size-4' />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className='max-w-3xl max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle>Detail Kualitas Data</DialogTitle>
            <DialogDescription>Profil lengkap kolom dan statistik missing value</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-4'>
              <StatCard label='Total Baris' value={profile.rows.toLocaleString()} icon={DatabaseIcon} />
              <StatCard label='Total Kolom' value={profile.cols} icon={DatabaseIcon} />
              <StatCard label='Data Kosong' value={`${profile.missing_pct}%`} icon={AlertCircleIcon} variant={profile.missing_pct > 20 ? 'destructive' : profile.missing_pct > 5 ? 'warning' : 'default'} />
              <StatCard label='Baris Duplikat' value={profile.duplicate_rows.toLocaleString()} icon={AlertCircleIcon} variant={profile.duplicate_rows > 0 ? 'warning' : 'default'} />
            </div>
            <div className='rounded-lg border overflow-hidden max-h-96 overflow-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 sticky top-0'>
                  <tr>
                    <th className='text-left px-3 py-2 font-medium'>Nama Kolom</th>
                    <th className='text-left px-3 py-2 font-medium'>Tipe Terdeteksi</th>
                    <th className='text-right px-3 py-2 font-medium'>Kosong</th>
                    <th className='text-right px-3 py-2 font-medium'>% Kosong</th>
                    <th className='text-right px-3 py-2 font-medium'>Nilai Unik</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {profile.columns.map((col) => (
                    <tr key={col.name}>
                      <td className='px-3 py-2 font-mono text-[12px]'>{col.name}</td>
                      <td className='px-3 py-2'><Badge variant='outline'>{col.detected_type}</Badge></td>
                      <td className='px-3 py-2 text-right'>{col.missing_count}</td>
                      <td className='px-3 py-2 text-right'>{(col.missing_count / profile.rows * 100).toFixed(1)}%</td>
                      <td className='px-3 py-2 text-right'>{col.unique_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowDetailModal(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Need to import useState and Dialog
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

function StatCard({ label, value, icon: Icon, variant = 'default' }: { label: string; value: string | number; icon: React.ElementType; variant?: 'default' | 'destructive' | 'warning' }) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.1em]'>{label}</p>
      <div className='mt-1 flex items-center gap-2'>
        <span className='text-2xl font-bold tabular-nums'>{value}</span>
        <Icon className='size-4 text-muted-foreground' />
      </div>
    </div>
  );
}