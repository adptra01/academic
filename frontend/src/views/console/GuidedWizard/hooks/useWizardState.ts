'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WizardDraft } from '../types';

const STORAGE_KEY = 'guided_wizard_draft';

const initialDraft: WizardDraft = {
  projectId: '',
  datasetId: '',
  datasetVersionId: '',
  datasetVersion: undefined,
  currentStep: 1,
  variables: {},
  params: {},
  acknowledgedConfirmations: [],
};

export function useWizardState(projectId: string) {
  const [draft, setDraft] = useState<WizardDraft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (!projectId) return;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as WizardDraft;
        if (parsed.projectId === projectId) {
          setDraft(parsed);
        }
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, [projectId]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!hydrated || !projectId) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(draft));
    } catch {
      // ignore quota exceeded
    }
  }, [draft, hydrated, projectId]);

  const updateDraft = useCallback((patch: Partial<WizardDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  }, []);

  const nextStep = useCallback(() => {
    setDraft(prev => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, 5) }));
  }, []);

  const prevStep = useCallback(() => {
    setDraft(prev => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setDraft(prev => ({ ...prev, currentStep: Math.max(1, Math.min(step, 5)) }));
  }, []);

  const reset = useCallback(() => {
    if (!projectId) return;
    try {
      localStorage.removeItem(`${STORAGE_KEY}:${projectId}`);
    } catch {
      // ignore
    }
    setDraft({ ...initialDraft, projectId });
  }, [projectId]);

  const hydrateFromStorage = useCallback(() => {
    if (!projectId) return;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as WizardDraft;
        if (parsed.projectId === projectId) {
          setDraft(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  return {
    draft,
    hydrated,
    updateDraft,
    nextStep,
    prevStep,
    goToStep,
    reset,
    hydrateFromStorage,
  };
}