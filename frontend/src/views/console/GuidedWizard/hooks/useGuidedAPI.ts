'use client';

import { useCallback } from 'react';
import { api, apiUrl, authHeaders } from '@/lib/api';
import type {
  ResearchIntent,
  ResearchIntentCreate,
  RecommendationItem,
  MethodRecommendResponse,
  AnalysisConfig,
  PreflightIssue,
} from '../types';

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem('token');
  const res = await fetch(`${apiUrl()}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useGuidedAPI() {
  const createResearchIntent = useCallback(
    async (data: ResearchIntentCreate): Promise<ResearchIntent> => {
      return fetchWithAuth<ResearchIntent>('/api/v1/research-intent', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    []
  );

  const getResearchIntent = useCallback(
    async (intentId: string): Promise<ResearchIntent> => {
      return fetchWithAuth<ResearchIntent>(`/api/v1/research-intent/${intentId}`, {
        method: 'GET',
      });
    },
    []
  );

  const recommendMethods = useCallback(
    async (researchIntentId: string, datasetProfileId?: string): Promise<MethodRecommendResponse> => {
      return fetchWithAuth<MethodRecommendResponse>('/api/v1/methods/recommend', {
        method: 'POST',
        body: JSON.stringify({ research_intent_id: researchIntentId, dataset_profile_id: datasetProfileId }),
      });
    },
    []
  );

  const getMethodSpec = useCallback(
    async (methodId: string): Promise<{ variables: Record<string, unknown>; params: Record<string, unknown> }> => {
      return fetchWithAuth(`/api/v1/methods/${methodId}`, { method: 'GET' });
    },
    []
  );

  const createGuidedConfig = useCallback(
    async (config: {
      project_id: string;
      dataset_version_id: string;
      method: string;
      variables: Record<string, unknown>;
      params: Record<string, unknown>;
      preprocessing_ops?: unknown[];
      research_intent_id: string;
      wizard_step?: number;
    }): Promise<AnalysisConfig> => {
      return fetchWithAuth<AnalysisConfig>('/api/v1/analysis-config/guided', {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },
    []
  );

  const confirmConfigAndPreflight = useCallback(
    async (configId: string, acknowledgedConfirmations: string[] = []): Promise<{
      config: AnalysisConfig;
      preflight: { ok: boolean; issues: PreflightIssue[]; method_contract?: unknown; ma_rules_triggered?: unknown[] };
    }> => {
      return fetchWithAuth(`/api/v1/analysis-config/${configId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ acknowledged_confirmations: acknowledgedConfirmations }),
      });
    },
    []
  );

  const runGuidedAnalysis = useCallback(
    async (configId: string): Promise<{ analysis_uid: string; method: string; result: unknown; result_hash: string; warnings: string[]; notes: string[] }> => {
      return fetchWithAuth('/api/v1/analyses/run-guided', {
        method: 'POST',
        body: JSON.stringify({ analysis_config_id: configId }),
      });
    },
    []
  );

  const getDatasetProfile = useCallback(
    async (datasetId: string, version: number): Promise<{ rows: number; cols: number; missing_pct: number; duplicate_rows: number; columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[] }> => {
      return fetchWithAuth(`/api/v1/datasets/${datasetId}/profile?version=${version}`, { method: 'GET' });
    },
    []
  );

  return {
    createResearchIntent,
    getResearchIntent,
    recommendMethods,
    getMethodSpec,
    createGuidedConfig,
    confirmConfigAndPreflight,
    runGuidedAnalysis,
    getDatasetProfile,
  };
}