'use client'

export type MethodId =
  | 'descriptive'
  | 'normality'
  | 'pearson'
  | 'spearman'
  | 'ttest_1samp'
  | 'ttest_ind'
  | 'ttest_paired'
  | 'anova_oneway'
  | 'chi2_independence'
  | 'chi2_gof'
  | 'mannwhitney'
  | 'wilcoxon'
  | 'kruskal'
  | 'linreg_simple'
  | 'linreg_multiple'

export type MethodLabelMap = Record<MethodId, string>

export const METHOD_LABELS: MethodLabelMap = {
  descriptive: 'Statistik Deskriptif',
  normality: 'Uji Normalitas',
  pearson: 'Korelasi Pearson',
  spearman: 'Korelasi Spearman',
  ttest_1samp: 'Uji t Satu Sampel',
  ttest_ind: 'Uji t Independen',
  ttest_paired: 'Uji t Berpasangan',
  anova_oneway: 'ANOVA Satu Arah',
  chi2_independence: 'Uji Chi-Kuadrat Independensi',
  chi2_gof: 'Uji Chi-Kuadrat Kesesuaian',
  mannwhitney: 'Uji Mann-Whitney U',
  wilcoxon: 'Uji Wilcoxon Signed-Rank',
  kruskal: 'Uji Kruskal-Wallis',
  linreg_simple: 'Regresi Linier Sederhana',
  linreg_multiple: 'Regresi Linier Berganda',
}

export interface RunOut {
  method_name?: string
  n?: number
  n_source?: number
  n_rows_dropped?: number
  statistics?: Record<string, unknown>
  assumptions?: Array<{
    name: string
    passed?: boolean | null
    p_value?: number
    note?: string
  }>
  decision?: {
    text: string
    p?: number
    alpha?: number
  } | null
  effect_size?: Record<string, unknown> | null
  parameters?: Record<string, unknown>
  formula_latex?: string
  calculation?: string[]
  interpretation?: string
  warnings?: string[]
  notes?: string[]
}

export interface AnalysisDetail {
  analysis_uid: string
  method: MethodId
  variables: Record<string, unknown>
  params: Record<string, unknown>
  dataset_filename?: string | null
  dataset_version_number?: number | null
  result: RunOut
  result_hash: string
  software_version: string
  timestamp: string
}

export interface StructuredSections {
  summary: SummaryData
  warnings: WarningsData
  descriptive: DescriptiveData
  inferential: InferentialData
  interpretation: InterpretationData
  methodology: MethodologyData
  reproducibility: ReproducibilityData
}

export interface SummaryData {
  researchQuestion?: string
  method: string
  methodLabel: string
  variables: Record<string, unknown>
  datasetVersion?: number
  datasetFilename?: string
  nAnalysis: number
  nSource: number
  rowsDropped: number
}

export interface WarningsData {
  engineWarnings: string[]
  engineNotes: string[]
  maRulesTriggered: unknown[]
  assumptionFailures: Array<{
    name: string
    passed: boolean | null
    pValue?: number
    note?: string
  }>
}

export interface DescriptiveData {
  type: 'per_group' | 'contingency' | 'regression' | 'descriptive' | 'none'
  data: unknown
  labels?: Record<string, string>
}

export interface InferentialData {
  testStatistic: { label: string; value: number | string }
  degreesOfFreedom?: string
  pValue: number
  pValueFormatted: string
  effectSize?: { label: string; value: number | string; interpretation?: string }
  confidenceInterval?: { label: string; lower: number; upper: number }
  decision: { text: string; alpha: number }
  additionalStats?: Record<string, unknown>
}

export interface InterpretationData {
  narrative: string
  limitations: string[]
  practicalSignificance?: string
}

export interface MethodologyData {
  formulaLatex?: string
  formulaText?: string
  assumptions: Array<{ name: string; description: string; checked: boolean }>
  references: string[]
  engineVersion: string
}

export interface ReproducibilityData {
  analysisId: string
  resultHash: string
  datasetVersion: number | null
  datasetFilename: string | null
  configJson: Record<string, unknown>
  analysisHash: string
  engineVersion: string
  softwareVersion: string
  timestamp: string
  transformationLog: string[]
  randomSeeds?: Record<string, unknown>
}

export interface ResultNarrativeProps {
  result: RunOut
  method: MethodId
  config: {
    variables: Record<string, unknown>
    params: Record<string, unknown>
    datasetVersionId?: string
    projectId?: string
    datasetFilename?: string
    datasetVersionNumber?: number
    preprocessingOps?: unknown[]
    randomSeeds?: Record<string, unknown>
    missingPolicy?: string
    analysisId?: string
    analysisHash?: string
  }
  detail?: Partial<AnalysisDetail>
  className?: string
}

export interface SectionProps {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'warning'
  className?: string
}

export type SectionKey = keyof StructuredSections

export const SECTION_ORDER: SectionKey[] = [
  'summary',
  'warnings',
  'descriptive',
  'inferential',
  'interpretation',
  'methodology',
  'reproducibility',
]

export const SECTION_CONFIG: Record<SectionKey, { title: string; icon: string; defaultOpen: boolean }> = {
  summary: { title: 'Ringkasan Analisis', icon: 'FileText', defaultOpen: true },
  warnings: { title: 'Peringatan Sebelum Baca Hasil', icon: 'AlertTriangle', defaultOpen: true },
  descriptive: { title: 'Statistik Deskriptif', icon: 'Table', defaultOpen: false },
  inferential: { title: 'Hasil Inferensial', icon: 'Calculator', defaultOpen: true },
  interpretation: { title: 'Interpretasi Akademik', icon: 'Lightbulb', defaultOpen: false },
  methodology: { title: 'Metode & Formula', icon: 'BookOpen', defaultOpen: false },
  reproducibility: { title: 'Reproduktibilitas', icon: 'GitBranch', defaultOpen: false },
}