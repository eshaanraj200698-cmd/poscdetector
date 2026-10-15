/**
 * SakhiCheck Data & Engine Type Definitions
 * Designed around Rotterdam diagnostic framework, MongoDB collection schema,
 * and multi-lingual health informatics standards.
 */

export type SupportedLanguage = 'en' | 'hi' | 'kn';

export type CyclePattern =
  | 'regular'
  | 'irregular'
  | 'absent'
  | 'very_long'
  | 'very_frequent'
  | 'unknown';

export interface ConditionCriterion {
  name: string;
  description: string;
  rotterdam_category: 'ovulatory_dysfunction' | 'hyperandrogenism' | 'ultrasound_morphology' | 'differential_endocrine' | 'differential_pelvic';
  can_self_report: boolean;
  clinician_note?: string;
}

export interface Condition {
  _id: string;
  name: string;
  summary_simple: string;
  criteria: ConditionCriterion[];
  related_symptoms: string[];
  when_to_see_doctor: string;
  sources: string[];
}

export interface SymptomSynonyms {
  en: string[];
  hi: string[];
  kn: string[];
}

export interface Symptom {
  _id: string;
  key: string;
  label_en: string;
  category: 'menstrual' | 'androgenic' | 'metabolic' | 'general' | 'emotional' | 'pelvic' | 'reproductive' | 'endocrine';
  synonyms: SymptomSynonyms;
  linked_conditions: string[];
}

export interface CarePathwayUrgencyRule {
  trigger: string;
  level: 'routine' | 'soon' | 'urgent';
  description: string;
}

export interface SuggestedMedicalTest {
  name: string;
  description: string;
  framing: string;
}

export interface CarePathway {
  _id: string;
  condition: string;
  specialist: {
    primary: string;
    secondary: string;
    first_line: string;
  };
  urgency_rules: CarePathwayUrgencyRule[];
  tests: SuggestedMedicalTest[];
  questions_for_doctor: string[];
  things_to_note_before_visit: string[];
}

export interface RedFlag {
  _id: string;
  name: string;
  pattern_keywords: {
    en: string[];
    hi: string[];
    kn: string[];
  };
  message: {
    en: string;
    hi: string;
    kn: string;
  };
  action: 'urgent_emergency_care' | 'immediate_crisis_helpline';
}

export interface KeyConfidenceNote {
  key: string;
  user_mention: string;
  confidence: 'high' | 'medium';
  note: string;
}

/**
 * Structured symptoms extracted from user free-text / voice.
 */
export interface ExtractedSymptoms {
  detected_language: SupportedLanguage | 'mixed';
  translated_en: string;
  matched_keys: string[];
  key_confidence_notes: KeyConfidenceNote[];
  extraction_source?: 'gemini_ai' | 'fuse_fuzzy_fallback';
  cycle_pattern: CyclePattern;
  cycle_gap_months_approx: number | null;
  hirsutism: boolean;
  acne: boolean;
  hair_thinning: boolean;
  weight_gain: boolean;
  dark_skin_patches: boolean;
  fatigue: boolean;
  mood_changes: boolean;
  trying_to_conceive: boolean;
  pelvic_pain: boolean;
  heavy_bleeding: boolean;
  cold_intolerance: boolean;
  heat_intolerance?: boolean;
  galactorrhea: boolean;
  sleep_issues?: boolean;
  is_unrelated: boolean;
  red_flags: string[];
  missing_info: string[];
}

export interface RotterdamCategoryMatch {
  category: 'ovulatory_dysfunction' | 'hyperandrogenism' | 'ultrasound_morphology';
  title: string;
  status: 'touched' | 'not_indicated' | 'clinician_only';
  reason: string;
  evidence_symptoms: string[];
}

export interface ConditionMatch {
  condition: Condition;
  alignment_level: 'strong_alignment' | 'moderate_alignment' | 'differential_consideration';
  rationale: string;
  matched_symptoms: string[];
}

export interface MatchResult {
  is_red_flag: boolean;
  triggered_red_flags: RedFlag[];
  is_unrelated_to_hormonal: boolean;
  unrelated_message?: string;
  rotterdam: {
    categories_touched_count: number;
    categories: RotterdamCategoryMatch[];
    explainable_summary: string;
  };
  matched_conditions: ConditionMatch[];
  care_pathway: CarePathway;
  recommended_specialist: {
    specialist_type: string;
    urgency: 'routine' | 'soon' | 'urgent';
    urgency_reason: string;
  };
  tests_to_discuss: SuggestedMedicalTest[];
  questions_for_doctor: string[];
  things_to_note_before_visit: string[];
}

export interface SessionDoc {
  _id: string;
  created_at: string;
  language: SupportedLanguage | 'mixed';
  raw_input: string;
  extracted: ExtractedSymptoms;
  matched: MatchResult;
  urgency: 'routine' | 'soon' | 'urgent';
}
