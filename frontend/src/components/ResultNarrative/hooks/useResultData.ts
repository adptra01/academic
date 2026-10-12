'use client'

import { useMemo } from 'react'
import type {
  RunOut,
  AnalysisDetail,
  StructuredSections,
  SummaryData,
  WarningsData,
  DescriptiveData,
  InferentialData,
  InterpretationData,
  MethodologyData,
  ReproducibilityData,
  MethodId,
} from '../types'
import { METHOD_LABELS } from '../types'

export function useResultData(
  result: RunOut,
  method: MethodId,
  config: {
    variables: Record<string, unknown>
    params: Record<string, unknown>
    datasetFilename?: string
    datasetVersionNumber?: number
    preprocessingOps?: unknown[]
    randomSeeds?: Record<string, unknown>
    missingPolicy?: string
    analysisId?: string
    analysisHash?: string
  },
  detail?: Partial<AnalysisDetail>
): StructuredSections {
  return useMemo(() => {
    const nAnalysis = result.n ?? 0
    const nSource = result.n_source ?? nAnalysis
    const rowsDropped = result.n_rows_dropped ?? Math.max(0, nSource - nAnalysis)

    const summary = buildSummary(result, method, config, nAnalysis, nSource, rowsDropped)
    const warnings = buildWarnings(result)
    const descriptive = buildDescriptive(result, method)
    const inferential = buildInferential(result, method)
    const interpretation = buildInterpretation(result, method)
    const methodology = buildMethodology(result, method, detail)
    const reproducibility = buildReproducibility(result, method, config, detail)

    return {
      summary,
      warnings,
      descriptive,
      inferential,
      interpretation,
      methodology,
      reproducibility,
    }
  }, [result, method, config, detail])
}

function buildSummary(
  result: RunOut,
  method: MethodId,
  config: { variables: Record<string, unknown>; params: Record<string, unknown>; datasetFilename?: string; datasetVersionNumber?: number },
  nAnalysis: number,
  nSource: number,
  rowsDropped: number
): SummaryData {
  return {
    method,
    methodLabel: METHOD_LABELS[method] || method,
    variables: config.variables,
    datasetVersion: config.datasetVersionNumber,
    datasetFilename: config.datasetFilename,
    nAnalysis,
    nSource,
    rowsDropped,
  }
}

function buildWarnings(result: RunOut): WarningsData {
  return {
    engineWarnings: result.warnings ?? [],
    engineNotes: result.notes ?? [],
    maRulesTriggered: [],
    assumptionFailures: (result.assumptions ?? [])
      .filter((a): a is typeof a & { passed: boolean | null } => a.passed === false)
      .map((a) => ({
        name: a.name,
        passed: a.passed ?? null,
        pValue: a.p_value,
        note: a.note,
      })),
  }
}

function buildDescriptive(result: RunOut, method: MethodId): DescriptiveData {
  const stats = result.statistics ?? {}

  switch (method) {
    case 'ttest_ind':
    case 'ttest_paired':
    case 'mannwhitney':
    case 'wilcoxon':
    case 'anova_oneway':
    case 'kruskal':
      return {
        type: 'per_group',
        data: stats,
        labels: {
          mean: 'Mean',
          sd: 'SD',
          n: 'n',
          median: 'Median',
          iqr: 'IQR',
          min: 'Min',
          max: 'Max',
        },
      }

    case 'chi2_independence':
    case 'chi2_gof':
      return {
        type: 'contingency',
        data: stats,
        labels: {
          observed: 'Observed',
          expected: 'Expected',
          residuals: 'Residuals',
        },
      }

    case 'linreg_simple':
    case 'linreg_multiple':
      return {
        type: 'regression',
        data: stats,
        labels: {
          coefficients: 'Koefisien',
          r_squared: 'R²',
          adj_r_squared: 'Adjusted R²',
          vif: 'VIF',
          f_statistic: 'F-statistic',
        },
      }

    case 'descriptive':
      return {
        type: 'descriptive',
        data: stats,
        labels: {
          mean: 'Mean',
          median: 'Median',
          sd: 'SD',
          iqr: 'IQR',
          min: 'Min',
          max: 'Max',
          missing: 'Missing',
          skewness: 'Skewness',
          kurtosis: 'Kurtosis',
        },
      }

    default:
      return {
        type: 'none',
        data: stats,
      }
  }
}

function buildInferential(result: RunOut, method: MethodId): InferentialData {
  const stats = (result.statistics ?? {}) as Record<string, unknown>
  const decision = result.decision ?? { text: '-', alpha: 0.05 }
  const pValue = decision.p ?? extractPValue(stats)

  let testStatistic = { label: 'Statistik Uji', value: '-' }
  let degreesOfFreedom: string | undefined
  let effectSize: InferentialData['effectSize']
  let confidenceInterval: InferentialData['confidenceInterval']
  const additionalStats: Record<string, unknown> = {}

  const getStat = (keys: string[], fallback = '-'): string => {
    for (const k of keys) {
      if (stats[k] !== undefined) return String(stats[k])
    }
    return fallback
  }

  switch (method) {
    case 'ttest_ind':
    case 'ttest_paired':
    case 'ttest_1samp':
      testStatistic = { label: 't', value: getStat(['t', 't_statistic', 'statistic']) }
      degreesOfFreedom = String(getStat(['df', 'degrees_of_freedom']))
      effectSize = buildEffectSize(result.effect_size, 'Cohen\'s d')
      confidenceInterval = buildCI(stats, 'mean_diff', 'diff')
      break

    case 'anova_oneway':
      testStatistic = { label: 'F', value: getStat(['f', 'f_statistic', 'statistic']) }
      degreesOfFreedom = `${getStat(['df_between', 'df1'])}, ${getStat(['df_within', 'df2'])}`
      effectSize = buildEffectSize(result.effect_size, 'η²')
      break

    case 'chi2_independence':
    case 'chi2_gof':
      testStatistic = { label: 'χ²', value: getStat(['chi2', 'chi_square', 'statistic']) }
      degreesOfFreedom = String(getStat(['df', 'degrees_of_freedom']))
      effectSize = buildEffectSize(result.effect_size, 'Cramér\'s V')
      break

    case 'mannwhitney':
      testStatistic = { label: 'U', value: getStat(['u', 'u_statistic', 'statistic']) }
      degreesOfFreedom = '-'
      effectSize = buildEffectSize(result.effect_size, 'Rank-biserial r')
      break

    case 'wilcoxon':
      testStatistic = { label: 'W', value: getStat(['w', 'w_statistic', 'statistic']) }
      degreesOfFreedom = '-'
      effectSize = buildEffectSize(result.effect_size, 'Matched rank-biserial r')
      break

    case 'kruskal':
      testStatistic = { label: 'H', value: getStat(['h', 'h_statistic', 'statistic']) }
      degreesOfFreedom = String(getStat(['df', 'degrees_of_freedom']))
      effectSize = buildEffectSize(result.effect_size, 'ε²')
      break

    case 'pearson':
    case 'spearman':
      testStatistic = { label: method === 'pearson' ? 'r' : 'ρ', value: getStat(['r', 'rho', 'correlation']) }
      degreesOfFreedom = String(getStat(['df']) ?? (typeof stats.n === 'number' ? stats.n - 2 : '-'))
      confidenceInterval = buildCI(stats, 'ci_lower', 'ci_upper')
      break

    case 'linreg_simple':
    case 'linreg_multiple':
      testStatistic = { label: 'F', value: getStat(['f', 'f_statistic']) }
      degreesOfFreedom = `${getStat(['df_model', 'df_regression'])}, ${getStat(['df_residual', 'df_error'])}`
      effectSize = { label: 'R²', value: getStat(['r_squared', 'r2']), interpretation: 'Proporsi varians dijelaskan' }
      confidenceInterval = buildCI(stats, 'ci_lower', 'ci_upper')
      additionalStats.r_squared = stats.r_squared
      additionalStats.adj_r_squared = stats.adj_r_squared
      break

    case 'normality':
      testStatistic = { label: stats.method === 'shapiro' ? 'W' : 'K²', value: getStat(['w', 'k2', 'statistic']) }
      degreesOfFreedom = '-'
      break

    default:
      testStatistic = { label: 'Statistik', value: getStat(['statistic']) }
      degreesOfFreedom = String(getStat(['df']))
  }

  return {
    testStatistic,
    degreesOfFreedom,
    pValue,
    pValueFormatted: formatPValue(pValue),
    effectSize,
    confidenceInterval,
    decision: { text: decision.text, alpha: decision.alpha ?? 0.05 },
    additionalStats: Object.keys(additionalStats).length > 0 ? additionalStats : undefined,
  }
}

function buildEffectSize(effectSize: Record<string, unknown> | null | undefined, defaultLabel: string): InferentialData['effectSize'] {
  if (!effectSize) return undefined

  const keys = Object.keys(effectSize)
  if (keys.length === 0) return undefined

  const primaryKey = keys.find((k) =>
    ['d', 'cohens_d', 'hedges_g', 'eta_squared', 'eta2', 'cramers_v', 'v', 'r', 'rho', 'rank_biserial', 'matched_rank_biserial', 'epsilon_squared', 'epsilon2'].includes(k.toLowerCase())
  ) ?? keys[0]

  const val = effectSize[primaryKey]

  return {
    label: defaultLabel,
    value: String(val),
    interpretation: getEffectSizeInterpretation(primaryKey, Number(val)),
  }
}

function getEffectSizeInterpretation(key: string, value: number): string | undefined {
  const absVal = Math.abs(value)

  if (['d', 'cohens_d', 'hedges_g'].includes(key.toLowerCase())) {
    if (absVal < 0.2) return 'Effect size sangat kecil'
    if (absVal < 0.5) return 'Effect size kecil'
    if (absVal < 0.8) return 'Effect size sedang'
    return 'Effect size besar'
  }

  if (['eta_squared', 'eta2', 'epsilon_squared', 'epsilon2'].includes(key.toLowerCase())) {
    if (absVal < 0.01) return 'Effect size sangat kecil'
    if (absVal < 0.06) return 'Effect size kecil'
    if (absVal < 0.14) return 'Effect size sedang'
    return 'Effect size besar'
  }

  if (['cramers_v', 'v'].includes(key.toLowerCase())) {
    if (absVal < 0.1) return 'Effect size sangat kecil'
    if (absVal < 0.3) return 'Effect size kecil'
    if (absVal < 0.5) return 'Effect size sedang'
    return 'Effect size besar'
  }

  if (['r', 'rho', 'rank_biserial', 'matched_rank_biserial'].includes(key.toLowerCase())) {
    if (absVal < 0.1) return 'Effect size sangat kecil'
    if (absVal < 0.3) return 'Effect size kecil'
    if (absVal < 0.5) return 'Effect size sedang'
    return 'Effect size besar'
  }

  return undefined
}

function buildCI(stats: Record<string, unknown>, lowerKey: string, upperKey: string): InferentialData['confidenceInterval'] {
  const lower = stats[lowerKey]
  const upper = stats[upperKey]
  if (lower === undefined || upper === undefined) return undefined
  return { label: '95% CI', lower: Number(lower), upper: Number(upper) }
}

function extractPValue(stats: Record<string, unknown>): number {
  const pKeys = ['p', 'p_value', 'pvalue', 'sig', 'significance']
  for (const key of pKeys) {
    if (stats[key] !== undefined) return Number(stats[key])
  }
  return NaN
}

function buildInterpretation(result: RunOut, method: MethodId): InterpretationData {
  const narrative = result.interpretation ?? 'Interpretasi tidak tersedia.'
  const limitations = getMethodLimitations(method)

  return {
    narrative,
    limitations,
    practicalSignificance: result.effect_size ? 'Lihat effect size di bagian Inferensial untuk signifikansi praktis.' : undefined,
  }
}

function getMethodLimitations(method: MethodId): string[] {
  const limitationsMap: Record<MethodId, string[]> = {
    descriptive: [
      'Tidak melakukan uji hipotesis atau inferensi populasi',
      'Mode hanya mengembalikan 5 nilai teratas untuk data kategorikal',
      'Missing dihitung tapi dikecualikan dari perhitungan statistik',
    ],
    normality: [
      'Shapiro-Wilk tidak valid untuk n > 5000 (otomatis beralih ke D\'Agostino)',
      'Sangat sensitif pada n besar — kecenderungan menolak H0 meski deviasi kecil',
      'Tidak bisa membedakan normal dari \'hampir normal\' secara praktis',
    ],
    pearson: [
      'Hanya mengukur hubungan linear (bukan non-linear)',
      'Sensitif terhadap pencilan (outlier)',
      'Memerlukan bivariat normal untuk inferensi valid',
      'Korelasi ≠ kausalitas',
    ],
    spearman: [
      'Hanya mengukur hubungan monotonik (bukan U-shape, dll)',
      'Kurang efisien dari Pearson jika data benar-benar normal linear',
      'Ties (nilai sama) mengurangi daya uji',
    ],
    ttest_1samp: [
      'Sensitif terhadap pencilan ekstrem',
      'Asumsi normalitas kritis pada n kecil (<30)',
      'Hanya untuk satu kelompok (bukan perbandingan 2 kelompok)',
    ],
    ttest_ind: [
      'Tidak untuk data berpasangan (gunakan ttest_paired)',
      'Tidak untuk >2 kelompok (gunakan anova_oneway)',
      'Sensitif terhadap pencilan ekstrem',
      'Student\'s t-test (equal_var=true) tidak robust jika varians heterogen',
    ],
    ttest_paired: [
      'Hanya untuk 2 kondisi berpasangan (bukan >2 waktu — gunakan repeated measures ANOVA)',
      'Sensitif terhadap pencilan pada selisih',
      'Missing pada salah satu kolom → pasangan dibuang (listwise)',
      'Asumsi normalitas pada selisih, bukan data mentah',
    ],
    anova_oneway: [
      'Tidak untuk 2 kelompok (gunakan ttest_ind)',
      'Tidak untuk desain berpasangan/berulang (gunakan repeated measures ANOVA)',
      'Hanya memberitahu \'ada perbedaan\' — butuh post-hoc untuk mana',
      'Sensitif terhadap pencilan ekstrem',
      'Levene p<α → interpretasi hati-hati (varians tidak homogen)',
    ],
    chi2_independence: [
      'Tidak menunjukkan arah/kekuatan hubungan (gunakan Cramér\'s V untuk effect size)',
      'Sensitif terhadap ukuran sampel besar (p signifikan meski effect kecil)',
      'Expected <5 → uji tidak valid (pertimbangkan Fisher\'s Exact, di luar MVP)',
      'Tidak untuk data berpasangan (gunakan McNemar, di luar MVP)',
      'Ordinal diurai sebagai nominal — kehilangan info urutan',
    ],
    chi2_gof: [
      'Expected <5 → uji tidak valid (gabungkan kategori atau perbesar sampel)',
      'Proporsi harapan harus dispesifikasikan a priori (bukan dari data)',
      'Kategori ordinal diurai sebagai nominal',
      'Hanya untuk 1 variabel kategorikal (bukan 2 variabel → chi2_independence)',
    ],
    mannwhitney: [
      'Tidak untuk data berpasangan (gunakan wilcoxon)',
      'Tidak untuk >2 kelompok (gunakan kruskal)',
      'Rank-biserial r bukan Cohen\'s d — interpretasi beda',
      'Ties (nilai sama) mengurangi daya uji',
      'Hanya memberitahu \'distribusi beda\' — bukan spesifik mana',
    ],
    wilcoxon: [
      'Hanya untuk 2 kondisi berpasangan (bukan >2 waktu)',
      'Nol-selisih dibuang → menurunkan n efektif',
      'Asumsi simetris selisih (lebih ketat dari t-test paired)',
      'Ties mengurangi daya uji',
      'Effect size (matched rank-biserial) interpretasi beda dari dz',
    ],
    kruskal: [
      'Tidak untuk data berpasangan (gunakan friedman, di luar MVP)',
      'Hanya memberitahu \'ada perbedaan\' — butuh post-hoc untuk mana',
      'Ties mengurangi daya uji',
      'Asumsi bentuk distribusi serupa per grup untuk interpretasi median',
    ],
    linreg_simple: [
      'Hanya 1 prediktor (gunakan linreg_multiple untuk >1)',
      'Hanya hubungan linear (non-linear → transformasi/polinomial)',
      'Outlier X (leverage) & Y (residual) sangat mempengaruhi model',
      'Ekstrapolasi di luar range X berbahaya',
      'R² mudah naik tapi tidak berarti model bagus',
    ],
    linreg_multiple: [
      'Multikolinearitas (VIF>10) → koefisien tidak interpretabel, SE membesar',
      'Hanya hubungan linear aditif (interaksi/non-linear → manual/transformasi)',
      'Outlier & high leverage points sangat mempengaruhi',
      'Overfitting jika k besar relatif n (gunakan adjusted R², cross-val di luar MVP)',
      'Stepwise selection tidak disarankan (bias, p-value tidak valid)',
      'Kausalitas tidak terbukti dari regresi observasional',
    ],
  }

  return limitationsMap[method] ?? ['Batasan metodologis tidak terdokumentasi untuk metode ini.']
}

function buildMethodology(
  result: RunOut,
  method: MethodId,
  detail?: Partial<AnalysisDetail>
): MethodologyData {
  const assumptions = (result.assumptions ?? []).map((a) => ({
    name: a.name,
    description: a.note ?? 'Tidak ada detail tambahan.',
    checked: a.passed !== null,
  }))

  return {
    formulaLatex: result.formula_latex,
    formulaText: result.formula_latex ? `LaTeX: ${result.formula_latex}` : undefined,
    assumptions,
    references: getMethodReferences(method),
    engineVersion: detail?.software_version ?? 'unknown',
  }
}

function getMethodReferences(method: MethodId): string[] {
  const refs: Record<MethodId, string[]> = {
    descriptive: ['Tabachnick & Fidell (2019). Using Multivariate Statistics.'],
    normality: ['Shapiro & Wilk (1965). Biometrika.', 'D\'Agostino & Pearson (1973). Biometrika.'],
    pearson: ['Pearson (1895). Phil. Trans. Roy. Soc.', 'Cohen et al. (2003). Applied Multiple Regression/Correlation Analysis.'],
    spearman: ['Spearman (1904). Am. J. Psychol.', 'Conover (1999). Practical Nonparametric Statistics.'],
    ttest_1samp: ['Student (1908). Biometrika.', 'Cohen (1988). Statistical Power Analysis.'],
    ttest_ind: ['Student (1908). Biometrika.', 'Welch (1947). Biometrika.', 'Cohen (1988). Statistical Power Analysis.'],
    ttest_paired: ['Student (1908). Biometrika.', 'Cohen (1988). Statistical Power Analysis.'],
    anova_oneway: ['Fisher (1925). Statistical Methods for Research Workers.', 'Tukey (1977). Exploratory Data Analysis.'],
    chi2_independence: ['Pearson (1900). Phil. Mag.', 'Cramér (1946). Mathematical Methods of Statistics.'],
    chi2_gof: ['Pearson (1900). Phil. Mag.', 'Cochran (1952). Ann. Math. Stat.'],
    mannwhitney: ['Mann & Whitney (1947). Ann. Math. Stat.', 'Cohen (1988). Statistical Power Analysis.'],
    wilcoxon: ['Wilcoxon (1945). Biometrics.', 'Cohen (1988). Statistical Power Analysis.'],
    kruskal: ['Kruskal & Wallis (1952). J. Am. Stat. Assoc.', 'Conover (1999). Practical Nonparametric Statistics.'],
    linreg_simple: ['Gauss (1809). Theoria Motus.', 'Cohen et al. (2003). Applied Multiple Regression/Correlation Analysis.'],
    linreg_multiple: ['Cohen et al. (2003). Applied Multiple Regression/Correlation Analysis.', 'Fox & Weisberg (2019). An R Companion to Applied Regression.'],
  }
  return refs[method] ?? ['Referensi standar untuk metode ini.']
}

function buildReproducibility(
  result: RunOut,
  method: MethodId,
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
  },
  detail?: Partial<AnalysisDetail>
): ReproducibilityData {
  return {
    analysisId: config.analysisId ?? detail?.analysis_uid ?? '-',
    resultHash: detail?.result_hash ?? '-',
    datasetVersion: config.datasetVersionNumber ?? null,
    datasetFilename: config.datasetFilename ?? null,
    configJson: {
      method,
      variables: config.variables,
      params: config.params,
      preprocessingOps: config.preprocessingOps ?? [],
      missingPolicy: config.missingPolicy,
      randomSeeds: config.randomSeeds ?? {},
    },
    analysisHash: config.analysisHash ?? '-',
    engineVersion: detail?.software_version ?? 'unknown',
    softwareVersion: detail?.software_version ?? 'unknown',
    timestamp: detail?.timestamp ?? new Date().toISOString(),
    transformationLog: config.preprocessingOps ? config.preprocessingOps.map((op) => JSON.stringify(op)) : [],
    randomSeeds: config.randomSeeds,
  }
}

export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return 'p = ?'
  if (p < 0.001) return 'p < .001'
  if (p < 0.01) return `p = ${p.toFixed(3).replace(/^0/, '')}`
  return `p = ${p.toFixed(2).replace(/^0/, '')}`
}