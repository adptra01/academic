'use client';

import { 
  GitBranchIcon, 
  GitMergeIcon, 
  BarChart2Icon, 
  LinkIcon, 
  ZapIcon, 
  FileTextIcon,
  HelpCircleIcon,
  ChevronRightIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type GoalCategory = 
  | 'compare_groups'
  | 'test_association'
  | 'predict_outcome'
  | 'explore_structure'
  | 'describe_data'
  | 'custom';

const CATEGORY_INFO: Record<GoalCategory, { 
  label: string; 
  description: string; 
  icon: React.ElementType;
  examples: string[];
  designHints: string[];
}> = {
  compare_groups: {
    label: 'Bandingkan 2 Kelompok',
    description: 'Uji perbedaan rata-rata/median antara dua kelompok independen atau berpasangan',
    icon: GitBranchIcon,
    examples: [
      'Apakah rata-rata skor uji berbeda antara kelas A dan B?',
      'Apakah perawatan baru efektif dibandingkan kontrol?',
    ],
    designHints: ['between_subjects', 'within_subjects', 'paired'],
  },
  test_association: {
    label: 'Uji Hubungan/Asosiasi',
    description: 'Uji korelasi numerik atau asosiasi kategorikal antara variabel',
    icon: LinkIcon,
    examples: [
      'Apakah ada hubungan antara usia dan pendapatan?',
      'Apakah jenis kelamin terkait dengan preferensi produk?',
    ],
    designHints: ['continuous', 'categorical', 'ordinal'],
  },
  predict_outcome: {
    label: 'Prediksi / Regresi',
    description: 'Model prediksi outcome kontinu, biner, atau ordinal dari variabel prediktor',
    icon: ZapIcon,
    examples: [
      'Memperkirakan harga rumah dari luas, lokasi, kamar',
      'Memprediksi kelulusan dari nilai UTS, UAS, kehadiran',
    ],
    designHints: ['continuous', 'binary', 'ordinal', 'multiple_predictors'],
  },
  explore_structure: {
    label: 'Eksplorasi Struktur',
    description: 'Clustering, reduksi dimensi, atau topic modeling untuk temuan tersembunyi',
    icon: GitMergeIcon,
    examples: [
      'Mengelompokkan pelanggan berdasarkan perilaku belanja',
      'Mengidentifikasi topik utama dari kumpulan teks ulasan',
    ],
    designHints: ['clustering', 'dimensionality_reduction', 'topic_modeling'],
  },
  describe_data: {
    label: 'Deskripsi Data',
    description: 'Statistik deskriptif, distribusi, normalitas, dan ringkasan umum data',
    icon: FileTextIcon,
    examples: [
      'Ringkasan mean, median, SD, kuartil untuk semua variabel numerik',
      'Uji normalitas Shapiro-Wilk untuk variabel skor',
    ],
    designHints: ['descriptive', 'normality', 'distribution'],
  },
  custom: {
    label: 'Tulis Pertanyaan Sendiri',
    description: 'Tuliskan pertanyaan penelitian bebas — sistem akan coba rekomendasikan metode',
    icon: HelpCircleIcon,
    examples: [
      'Apakah ada perbedaan signifikan sebelum/sesudah intervensi?',
      'Faktor apa yang paling memengaruhi kepuasan pelanggan?',
    ],
    designHints: ['free_text'],
  },
};

type GoalCategoryCardProps = {
  category: GoalCategory;
  isSelected: boolean;
  onSelect: (category: GoalCategory) => void;
  disabled?: boolean;
};

export function GoalCategoryCard({ category, isSelected, onSelect, disabled }: GoalCategoryCardProps) {
  const info = CATEGORY_INFO[category];

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50 hover:shadow-md',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && onSelect(category)}
    >
      <div className='absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100' />
      <CardContent className='relative p-4 space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <info.icon className='size-5' />
          </div>
          {isSelected && (
            <div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
              <ChevronRightIcon className='size-3.5' />
            </div>
          )}
        </div>
        <div className='space-y-1'>
          <h3 className={cn('font-semibold text-sm', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
            {info.label}
          </h3>
          <p className='text-xs text-muted-foreground leading-relaxed'>{info.description}</p>
        </div>
        <div className='pt-2 border-t space-y-1.5'>
          <p className='text-[10px] font-medium text-muted-foreground uppercase tracking-[0.1em]'>Contoh pertanyaan:</p>
          <ul className='space-y-1'>
            {info.examples.map((ex, i) => (
              <li key={i} className='text-[11px] text-muted-foreground leading-relaxed'>
                <span className='font-mono text-[10px] text-border mr-1'>•</span>
                {ex}
              </li>
            ))}
          </ul>
        </div>
        <div className='flex flex-wrap gap-1'>
          {info.designHints.map((hint) => (
            <span key={hint} className='px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground'>
              {hint.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalCategoryGrid({ selectedCategory, onSelect, disabled }: { 
  selectedCategory: GoalCategory | null; 
  onSelect: (category: GoalCategory) => void;
  disabled?: boolean;
}) {
  const categories: GoalCategory[] = [
    'compare_groups',
    'test_association', 
    'predict_outcome',
    'explore_structure',
    'describe_data',
    'custom',
  ];

  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
      {categories.map((cat) => (
        <GoalCategoryCard
          key={cat}
          category={cat}
          isSelected={selectedCategory === cat}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}