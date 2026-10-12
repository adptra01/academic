'use client'

import type { RunOut, MethodId } from '../types'
import { SummarySection } from '../sections/SummarySection'
import { WarningsSection } from '../sections/WarningsSection'
import { DescriptiveSection } from '../sections/DescriptiveSection'
import { InferentialSection } from '../sections/InferentialSection'
import { InterpretationSection } from '../sections/InterpretationSection'
import { MethodologySection } from '../sections/MethodologySection'
import { ReproducibilitySection } from '../sections/ReproducibilitySection'
import { useResultData } from '../hooks/useResultData'
import type { ResultNarrativeProps } from '../types'

interface BaseRendererProps extends ResultNarrativeProps {}

export function BaseRenderer({ result, method, config, detail }: BaseRendererProps) {
  const sections = useResultData(result, method, config, detail)

  return (
    <div className="space-y-3">
      <SummarySection data={sections.summary} />
      <WarningsSection data={sections.warnings} />
      <DescriptiveSection data={sections.descriptive} method={method} />
      <InferentialSection data={sections.inferential} />
      <InterpretationSection data={sections.interpretation} />
      <MethodologySection data={sections.methodology} method={method} />
      <ReproducibilitySection data={sections.reproducibility} />
    </div>
  )
}

export type { BaseRendererProps }

export function getRenderer(method: MethodId) {
  const renderers: Record<MethodId, React.ComponentType<BaseRendererProps>> = {
    descriptive: DescriptiveRenderer,
    normality: NormalityRenderer,
    pearson: CorrelationRenderer,
    spearman: CorrelationRenderer,
    ttest_1samp: TTest1SampRenderer,
    ttest_ind: TTestIndRenderer,
    ttest_paired: TTestPairedRenderer,
    anova_oneway: AnovaOneWayRenderer,
    chi2_independence: Chi2IndependenceRenderer,
    chi2_gof: Chi2GofRenderer,
    mannwhitney: MannWhitneyRenderer,
    wilcoxon: WilcoxonRenderer,
    kruskal: KruskalRenderer,
    linreg_simple: LinRegSimpleRenderer,
    linreg_multiple: LinRegMultipleRenderer,
  }

  return renderers[method] ?? BaseRenderer
}

function DescriptiveRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function NormalityRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function CorrelationRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function TTest1SampRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function TTestIndRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function TTestPairedRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function AnovaOneWayRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function Chi2IndependenceRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function Chi2GofRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function MannWhitneyRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function WilcoxonRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function KruskalRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function LinRegSimpleRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}

function LinRegMultipleRenderer(props: BaseRendererProps) {
  return <BaseRenderer {...props} />
}