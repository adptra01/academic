export type ResearchIntentCreate = Omit<ResearchIntent, 'id' | 'created_at' | 'updated_at'>;

export type GoalCategory = 
  | 'compare_groups'
  | 'test_association'
  | 'predict_outcome'
  | 'explore_structure'
  | 'describe_data'
  | 'custom';

export type DesignHints = {
  design?: 'between_subjects' | 'within_subjects' | 'mixed' | 'observational' | 'time_series';
  groups?: number;
  paired?: boolean;
  outcome_type?: 'continuous' | 'binary' | 'ordinal' | 'nominal' | 'count' | 'time_to_event';
  predictors?: string[];
  time_points?: number;
  clusters_expected?: number;
  topics_expected?: number;
};

export type ResearchIntent = {
  id?: string;
  project_id: string;
  dataset_version_id: string;
  goal_category: GoalCategory;
  design_hints?: DesignHints;
  user_question?: string;
  created_at?: string;
  updated_at?: string;
};

export type RecommendationItem = {
  method_id: string;
  confidence: number;
  variable_mapping: Record<string, string>;
  assumptions_check?: Record<string, string>;
  warnings?: string[];
  alternatives?: string[];
};

export type MethodRecommendResponse = {
  recommendations: RecommendationItem[];
  fallback: string;
};

export type PreflightIssueLevel = 'blocking' | 'confirmation' | 'warning';

export type PreflightIssue = {
  level: PreflightIssueLevel;
  code: string;
  key: string;
  message: string;
  fix: string;
  details?: Record<string, unknown>;
};

export type AnalysisConfig = {
  id?: string;
  project_id: string;
  research_intent_id?: string;
  dataset_version_id: string;
  method: string;
  variables: Record<string, unknown>;
  params: Record<string, unknown>;
  preprocessing_ops?: unknown[];
  status?: 'draft' | 'confirmed' | 'executed' | 'archived';
  source_mode?: 'guided' | 'manual';
  wizard_step?: number;
  preflight_result?: {
    ok: boolean;
    issues: PreflightIssue[];
    method_contract?: unknown;
    ma_rules_triggered?: unknown[];
  };
};

export type WizardDraft = {
  projectId: string;
  datasetId: string;
  datasetVersionId: string;
  datasetVersion?: number;
  currentStep: number;
  intent?: ResearchIntent;
  intentId?: string;
  selectedMethod?: string;
  recommendations?: RecommendationItem[];
  variables: Record<string, string[]>;
  params: Record<string, string>;
  configId?: string;
  preflight?: {
    ok: boolean;
    issues: PreflightIssue[];
  };
  acknowledgedConfirmations: string[];
  analysisUid?: string;
  result?: unknown;
};
