# IMPLEMENTATION PLAN: Dual-Mode Academic Research Platform (AR-02)

> **Rencana implementasi** untuk fitur "Otomatis Terpandu" dan "Manual" berdasarkan roadmap AR-01 audit.
> **Pendekatan**: Sub-agent per fase/komponen, koordinasi melalui dokumen shared state.

---

## ARSITEKTUR SUB-AGENT

| Agent ID | Peran | Fokus Utama | Output |
|----------|-------|-------------|--------|
| `architect` | Arsitek sistem | Kontrak API, skema state, arsitektur dual-mode | `docs/ar-02-implementation/ARCHITECTURE.md`, OpenAPI spec |
| `backend-core` | Backend engineer | `dataset_profile`, `method_recommender`, `preflight_v2`, `analysis_config_v2` | PR backend dengan endpoint baru |
| `frontend-guided` | Frontend engineer | Mode Otomatis Terpandu: 5 layar, state machine, wizard | PR frontend: `GuidedWizard`, `ResearchIntent`, `VariableConfirm` |
| `frontend-manual` | Frontend engineer | Mode Manual: preservasi kontrol existing, switch mode | PR frontend: `ManualConfig`, mode switcher |
| `result-renderer` | Frontend engineer | Renderer naratif per metode (bukan flatten) | PR frontend: `ResultNarrative`, per-method renderers |
| `qa-audit` | QA Engineer | Test skenario 5 keluarga, E2E guided/manual, numerik validation | `docs/ar-01-audit/results/`, test reports |
| `docs-keeper` | Technical Writer | Kontrak metodologi, user guide, claims registry sync | `docs/method-contracts/`, `docs/user-guide/` |

---

## STATE MANAGEMENT (Shared Context)

```
docs/ar-02-implementation/
├── STATE.md                    # Current phase, blockers, decisions
├── ARCHITECTURE.md             # System contracts (source of truth)
├── PHASE_1_BASELINE.md         # Baseline freeze checklist
├── PHASE_2_SCENARIOS.md        # Scenario definitions & expected outputs
├── PHASE_3_CONTRACTS.md        # Method contracts (API schemas)
├── PHASE_4_GUIDED_FLOW.md      # Guided mode flow spec
├── PHASE_5_MANUAL_PRESERVE.md  # Manual mode preservation plan
├── PHASE_6_BETA_PLAN.md        # Beta recruitment & metrics
├── API_CONTRACTS/              # OpenAPI specs per endpoint
├── METHOD_CONTRACTS/           # Per-method methodology contracts
└── TEST_PLAN/                  # Test scenarios & acceptance criteria
```

---

## PHASE 1: BASELINE FREEZE & AUDIT (Hari 1-3)

### Agent: `architect` + `backend-core` + `qa-audit`

**Deliverables:**
- [ ] Tag `baseline-ar01` di git
- [ ] Fresh DB migration test (`alembic upgrade head` dari kosong)
- [ ] Backup/restore test di staging
- [ ] 107/107 tests passing di CI bersih
- [ ] Claims registry sync check
- [ ] Method readiness matrix finalized (`METHOD_READINESS_MATRIX.md` v1.0)

**Acceptance Criteria:**
- Semua metode MVP (14) memiliki status `validated` atau `human_reviewed`
- Metode Fase-2 (5) tersembunyi via feature flag
- `docs/claims-registry.md` 100% match dengan implementasi

---

## PHASE 2: REAL RESEARCH SCENARIO TESTING (Hari 4-8)

### Agent: `qa-audit` + `backend-core`

**Deliverables:**
- [ ] 5 keluarga skenario × 3-4 variasi = 18-20 test case lengkap
- [ ] Script otomatisasi `scripts/ar01_run_audit.py` diperluas untuk guided/manual mode
- [ ] Numerical comparison `scripts/ar01_compare_results.py` lulus untuk semua skenario
- [ ] Export validation checklist (6 format) untuk setiap skenario
- [ ] User testing protocol dokumentasi

**Skenario yang Harus Lulus (minimum):**
| Skenario | Metode Utama | Variasi | Status |
|----------|--------------|---------|--------|
| A. Independent Groups | ttest_ind, mannwhitney | Balanced/Unbalanced/Outliers/dupID | 🔄 |
| B. Paired Measures | ttest_paired, wilcoxon | Complete/Incomplete/Duplicate/Shuffled | 🔄 |
| C. Categorical Assoc | chi2_independence | Standard/LowExpected/LabelInconsist/Sparse | 🔄 |
| D. Regression | linreg_simple, linreg_multiple | Simple/Multicollinear/Outlier/Constant/Missing | 🔄 |
| E. Data Quality | All | Missing/DupID/DupRows/MixedTypes/Constant/Outlier/Likert/Combined | 🔄 |

---

## PHASE 3: METHODOLOGY CONTRACTS (Hari 5-9, paralel Phase 2)

### Agent: `architect` + `docs-keeper`

**Deliverables per Metode (14 MVP):**

```yaml
# Contoh: docs/method-contracts/ttest_ind.yaml
method_id: ttest_ind
display_name: "Uji t Dua Kelompok Independen"
purpose: "Membandingkan rata-rata variabel numerik antara dua kelompok independen"
research_designs:
  - between_subjects
  - two_groups
required_variables:
  - name: group
    role: grouping
    types: [Nominal, Binary, Ordinal]
    levels: 2
  - name: column
    role: dependent
    types: [Numerical]
parameters:
  - name: alpha
    type: float
    default: 0.05
    range: [0.001, 0.1]
    description: "Tingkat signifikansi"
  - name: equal_var
    type: boolean
    default: false
    description: "False = Welch's t-test (direkomendasikan), True = Student's t-test"
assumptions:
  - name: independence
    check: "Desain penelitian (between-subjects)"
  - name: normality
    check: "Shapiro-Wilk per grup (n<50) / CLT (n≥30)"
    warning_if_failed: true
  - name: homogeneity_of_variance
    check: "Levene's test"
    warning_if_failed: true
    fallback: "Welch's t-test (equal_var=false)"
limitations:
  - "Tidak untuk data berpasangan (gunakan ttest_paired)"
  - "Tidak untuk >2 kelompok (gunakan anova_oneway)"
  - "Sensitif terhadap pencilan ekstrem"
alternatives:
  - condition: "normality violated"
    switch_to: "mannwhitney"
    reason: "Non-parametrik, tidak memerlukan normalitas"
  - condition: "variance heterogeneity"
    switch_to: "ttest_ind (equal_var=false)"
    reason: "Welch's t-test robust terhadap heterogenitas varians"
output_structure:
  sections:
    - summary
    - warnings
    - descriptive_per_group
    - inferential
    - effect_size
    - interpretation
    - methodology
    - reproducibility
export_requirements:
  - all_6_formats
  - appendix_with_raw_data_summary
```

**Acceptance Criteria:**
- 14 file YAML lengkap di `docs/method-contracts/`
- Frontend & backend consume kontrak yang sama
- `method_recommender` menggunakan kontrak ini sebagai basis aturan

---

## PHASE 4: GUIDED AUTOMATIC MODE (Hari 9-18)

### Agent: `frontend-guided` + `backend-core` + `architect`

**Backend Endpoints Baru:**

```
POST /api/v1/research-intent          # Simpan tujuan penelitian
POST /api/v1/methods/recommend        # Rekomendasi metode dari intent + profile
POST /api/v1/analysis-config/guided   # Bangun config dari rekomendasi + konfirmasi
GET  /api/v1/analysis-config/{id}     # Ambil config untuk review
POST /api/v1/analysis-config/{id}/confirm  # Konfirmasi & jalankan pre-flight
POST /api/v1/analyses/run-guided      # Jalankan analisis dari config yang dikonfirmasi
```

**Frontend: 5 Layar Wizard**

```
GuidedWizard (state machine)
├── Step 1: DataReady       # Ringkasan dataset, versi, kualitas
├── Step 2: ResearchIntent  # Pilih tujuan / tulis pertanyaan
├── Step 3: VariableConfirm # Sistem sarankan, user konfirmasi
├── Step 4: PreflightGate   # Blokir/Konfirmasi/Peringatan, detail diagnosa
└── Step 5: ResultNarrative # Hasil terstruktur, ekspor, audit
```

**State Persistence:**
- `localStorage` untuk draft wizard (survive refresh)
- Backend `AnalysisConfig` entity untuk config yang sudah dikonfirmasi
- Version binding: config mengikat `dataset_version_id` eksplisit

**Acceptance Criteria:**
- User awam bisa complete A1, B1, C1, D1, E1 tanpa bantuan
- Zero silent data modification (semua transformasi explicit confirm)
- Pre-flight gate: Blokir/Konfirmasi/Peringatan visual jelas
- Result narrative mengikuti urutan akademik (7 sections)
- Switch ke Manual mode preserving config

---

## PHASE 5: MANUAL MODE PRESERVATION (Hari 15-20, paralel Phase 4)

### Agent: `frontend-manual` + `backend-core`

**Requirements:**
- Existing `ProjectView` tabs (Variables, Preprocess, Analysis) retained
- Mode switcher di header (Guided ↔ Manual)
- Config migration: Guided→Manual carries all decisions
- Manual→Guided: reset wizard tapi keep analysis history
- Advanced: JSON editor, custom preprocessing chain, parameter tuning

**Acceptance Criteria:**
- Power user workflow unchanged (regression test)
- All 14 MVP methods configurable manually
- Parameter validation same as guided
- Audit trail identical between modes

---

## PHASE 6: LIMITED BETA (Hari 21-30)

### Agent: `qa-audit` + `docs-keeper`

**Recruitment:**
- 5-8 peneliti (mix: mahasiswa S2/S3, dosen muda, riset industri)
- Screening: minimal 1 penelitian kuantitatif sebelumnya

**Protocol:**
1. Onboarding 30 menit (tanpa training mendalam)
2. 5 tugas skenario (A-E, 1 variasi each)
3. Think-aloud recording
4. Post-task questionnaire (SUS + custom metodologi)
5. Debrief 15 menit

**Metrics:**
| Metrik | Target |
|--------|--------|
| Task completion rate | ≥ 80% |
| Time to first valid result (guided) | ≤ 10 menit |
| Method selection accuracy | ≥ 90% |
| Warning comprehension | ≥ 80% |
| SUS score | ≥ 75 |
| Critical methodological errors | 0 |

**Go/No-Go Decision:**
- Documented in `docs/ar-02-implementation/PHASE_6_BETA_PLAN.md`
- Signed by methodology reviewer + product owner

---

## TECHNICAL DEBT TO ADDRESS BEFORE PHASE 4

| Item | Priority | Owner |
|------|----------|-------|
| `ver` state → `dataset_version_id` di AnalysisConfig | CRITICAL | backend-core |
| `analysis_hash` coverage: preprocessing config, engine version | HIGH | backend-core |
| Pre-flight v2: same logic for guided & manual | HIGH | backend-core |
| Result narrative renderer per method | HIGH | result-renderer |
| Export appendix consistency (6 formats) | HIGH | backend-core |
| MA rules integration di pre-flight & result | MEDIUM | backend-core |
| Feature flag for Phase-2 methods (hide from UI) | LOW | frontend-guided |

---

## COORDINATION PROTOCOL

1. **Daily sync** (15 menit): Update `STATE.md`, blockers, next actions
2. **PR reviews**: Cross-agent review wajib (min 1 approval dari agent lain)
3. **Shared contracts**: `ARCHITECTURE.md` dan `METHOD_CONTRACTS/` sebagai single source of truth
4. **Integration points**: Weekly integration test di staging environment

---

## START COMMANDS

```bash
# 1. Create baseline tag
git tag -a baseline-ar01 -m "AR-01 Audit baseline: 107 tests pass, all fixes integrated"

# 2. Initialize implementation docs
mkdir -p docs/ar-02-implementation/{API_CONTRACTS,METHOD_CONTRACTS,TEST_PLAN}

# 3. Spawn agents (run sequentially or parallel)
# See individual agent prompts below
```

---

## AGENT PROMPTS (siap pakai)

### Agent: architect
> Anda adalah Arsitek Sistem untuk AR-02. Tugas: buat `ARCHITECTURE.md` yang mendefinisikan kontrak API, state machine, entity relations, dan integrasi dual-mode. Referensi: `docs/ar-01-audit/METHOD_READINESS_MATRIX.md`, existing `backend/app/routers/analyses.py`, `frontend/src/views/console/ProjectView.tsx`. Output: OpenAPI 3.0 spec untuk endpoint baru, ERD untuk `AnalysisConfig`, `ResearchIntent`, state machine diagram untuk GuidedWizard.

### Agent: backend-core
> Anda adalah Backend Engineer. Tugas: implementasikan endpoint baru untuk Guided mode (`research-intent`, `method_recommender`, `analysis_config`, `preflight_v2`, `run-guided`), memperbaiki `ver` binding ke `dataset_version_id`, memperluas `analysis_hash` coverage, integrasi MA rules ke pre-flight & result. Referensi: `ARCHITECTURE.md`, `METHOD_CONTRACTS/*.yaml`. Test: 107 existing + new guided flow tests.

### Agent: frontend-guided
> Anda adalah Frontend Engineer. Tugas: bangun `GuidedWizard` (5 steps: DataReady, ResearchIntent, VariableConfirm, PreflightGate, ResultNarrative) sebagai React components. State machine dengan `localStorage` persistence. Integrasi `method_recommender` API, `VariablePicker` reuse, `StepNav` dengan status guided. Referensi: `ARCHITECTURE.md`, `PHASE_4_GUIDED_FLOW.md`, existing `ProjectView.tsx` components.

### Agent: frontend-manual
> Anda adalah Frontend Engineer. Tugas: preservasi `ProjectView` existing sebagai Manual mode, tambah mode switcher (Guided/Manual), config migration logic, advanced JSON editor, parameter tuning. Pastikan zero regression pada 14 MVP methods. Referensi: `ARCHITECTURE.md`, `PHASE_5_MANUAL_PRESERVE.md`.

### Agent: result-renderer
> Anda adalah Frontend Engineer. Tugas: ganti `flatten()` result view dengan `ResultNarrative` per method. 7 sections: Summary, Warnings, Descriptive, Inferential, Interpretation, Methodology, Reproducibility. Renderer khusus per method (ttest_ind, chi2, regression, dll). Referensi: `METHOD_CONTRACTS/*.yaml`, `PHASE_4_GUIDED_FLOW.md` Layar 5.

### Agent: qa-audit
> Anda adalah QA Engineer. Tugas: jalankan 20 skenario via `scripts/ar01_run_audit.py` untuk guided & manual mode. Bandingkan numerik via `scripts/ar01_compare_results.py`. Validasi 6 format export. Dokumentasikan temuan di `docs/ar-01-audit/review/`. Recruit & run beta protocol Phase 6.

### Agent: docs-keeper
> Anda adalah Technical Writer. Tugas: buat 14 `METHOD_CONTRACTS/*.yaml`, user guide untuk Guided & Manual mode, sync `claims-registry.md`, dokumentasikan beta protocol. Referensi: `docs/scientific-validation.md`, `docs/ar-01-audit/METHOD_READINESS_MATRIX.md`.