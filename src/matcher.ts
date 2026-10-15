/**
 * SakhiCheck Deterministic Matching & Health Rules Engine
 *
 * Grounded in the Rotterdam Consensus Criteria (2003/2018/2023 international guidelines):
 * 1. Ovulatory Dysfunction (irregular/absent cycles)
 * 2. Hyperandrogenism (clinical hirsutism, acne, alopecia, or biochemical)
 * 3. Polycystic Ovarian Morphology (clinician/ultrasound-only; non-self-reportable)
 *
 * HARD SAFETY RULES:
 * - Never diagnoses, provides percentages, or claims certainty.
 * - Always uses cautious alignment wording ("symptoms touch upon", "aligns with").
 * - Immediate red-flag escalation before any PCOS evaluation.
 * - Differential condition tracking (Thyroid, Hyperprolactinemia, Endometriosis).
 */

import {
  findConditions,
  findSymptoms,
  getCarePathway,
  findRedFlags,
} from './db';

import type {
  ExtractedSymptoms,
  MatchResult,
  RedFlag,
  RotterdamCategoryMatch,
  ConditionMatch,
  CarePathway,
  SupportedLanguage,
} from './types';

/**
 * Check for emergency red flags in raw input text or extracted flags.
 * If any match, escalation is triggered immediately.
 */
export async function evaluateRedFlags(
  rawText: string,
  extractedFlags: string[] = []
): Promise<RedFlag[]> {
  const redFlags = await findRedFlags();
  const lower = rawText.toLowerCase();
  const triggered: RedFlag[] = [];

  for (const flag of redFlags) {
    // Check keywords across EN, HI, KN
    const allKeywords = [
      ...flag.pattern_keywords.en,
      ...flag.pattern_keywords.hi,
      ...flag.pattern_keywords.kn,
    ];

    const keywordMatch = allKeywords.some((kw) => lower.includes(kw.toLowerCase()));
    const extractedMatch = extractedFlags.some(
      (ef) =>
        ef.toLowerCase().includes(flag._id.toLowerCase()) ||
        ef.toLowerCase().includes(flag.name.toLowerCase())
    );

    if (keywordMatch || extractedMatch) {
      triggered.push(flag);
    }
  }

  return triggered;
}

/**
 * Fallback deterministic keyword extractor based on symptoms.json synonyms.
 * Useful for Phase 1 testing and offline fallback if LLM is unavailable.
 */
export async function extractSymptomsFromKeywords(
  text: string,
  lang: SupportedLanguage = 'en'
): Promise<ExtractedSymptoms> {
  const lower = text.toLowerCase();
  const symptoms = await findSymptoms();

  const isMatched = (key: string): boolean => {
    const symp = symptoms.find((s) => s.key === key);
    if (!symp) return false;
    const syns = [
      ...symp.synonyms.en,
      ...symp.synonyms.hi,
      ...symp.synonyms.kn,
    ];
    return syns.some((syn) => lower.includes(syn.toLowerCase()));
  };

  const hirsutism = isMatched('hirsutism');
  const acne = isMatched('acne');
  const hair_thinning = isMatched('hair_thinning');
  const weight_gain = isMatched('weight_gain');
  const dark_skin_patches = isMatched('dark_skin_patches');
  const fatigue = isMatched('fatigue');
  const mood_changes = isMatched('mood_changes');
  const trying_to_conceive = isMatched('trying_to_conceive');
  const pelvic_pain = isMatched('pelvic_pain');
  const heavy_bleeding = isMatched('heavy_bleeding');
  const cold_intolerance = isMatched('cold_intolerance');
  const galactorrhea = isMatched('galactorrhea');
  const missed_periods = isMatched('missed_periods_amenorrhea');
  const irregular_cycles = isMatched('irregular_cycles');
  const frequent_periods = isMatched('frequent_periods');

  let cycle_pattern: ExtractedSymptoms['cycle_pattern'] = 'unknown';
  let cycle_gap_months_approx: number | null = null;

  if (
    missed_periods ||
    lower.includes('3 months') ||
    lower.includes('तीन महीने') ||
    lower.includes('दो तीन महीने') ||
    lower.includes('2-3 महीने') ||
    lower.includes('ಮೂರು ತಿಂಗಳ')
  ) {
    cycle_pattern = 'absent';
    cycle_gap_months_approx = 3;
  } else if (lower.includes('2 महीने') || lower.includes('दो महीने') || lower.includes('ಎರಡು ತಿಂಗಳ')) {
    cycle_pattern = 'irregular';
    cycle_gap_months_approx = 2;
  } else if (frequent_periods) {
    cycle_pattern = 'very_frequent';
  } else if (
    irregular_cycles ||
    lower.includes('late') ||
    lower.includes('delay') ||
    lower.includes('लेट') ||
    lower.includes('आगे पीछे') ||
    lower.includes('ತಡ')
  ) {
    cycle_pattern = 'irregular';
    cycle_gap_months_approx = 2;
  } else if (lower.includes('regular') || lower.includes('नियमित') || lower.includes('ಸರಿಯಾಗಿದೆ')) {
    cycle_pattern = 'regular';
  }

  // Detect non-hormonal / unrelated keywords
  const unrelatedKeywords = [
    'sore throat',
    'cough',
    'fever',
    'cold and cough',
    'बुखार',
    'खांसी',
    'गले में दर्द',
    'ಜ್ವರ',
    'ಕೆಮ್ಮು',
    'ಗಂಟಲು ನೋವು',
  ];
  const hasUnrelatedOnly =
    unrelatedKeywords.some((uk) => lower.includes(uk)) &&
    !hirsutism &&
    !acne &&
    !irregular_cycles &&
    !missed_periods &&
    !heavy_bleeding &&
    !pelvic_pain;

  // Check red flags
  const redFlagsList = await evaluateRedFlags(text);
  const red_flags_names = redFlagsList.map((f) => f.name);

  const matched_keys: string[] = [];
  if (irregular_cycles) matched_keys.push('irregular_cycles');
  if (missed_periods) matched_keys.push('missed_periods_amenorrhea');
  if (frequent_periods) matched_keys.push('frequent_periods');
  if (heavy_bleeding) matched_keys.push('heavy_bleeding');
  if (hirsutism) matched_keys.push('hirsutism');
  if (acne) matched_keys.push('acne');
  if (hair_thinning) matched_keys.push('hair_thinning');
  if (weight_gain) matched_keys.push('weight_gain');
  if (dark_skin_patches) matched_keys.push('dark_skin_patches');
  if (fatigue) matched_keys.push('fatigue');
  if (mood_changes) matched_keys.push('mood_changes');
  if (trying_to_conceive) matched_keys.push('trying_to_conceive');
  if (pelvic_pain) matched_keys.push('pelvic_pain');
  if (cold_intolerance) matched_keys.push('cold_intolerance');
  if (galactorrhea) matched_keys.push('galactorrhea');

  const key_confidence_notes = matched_keys.map((k) => ({
    key: k,
    user_mention: text,
    confidence: 'high' as const,
    note: `Exact keyword matched in knowledge base synonym tree`,
  }));

  return {
    detected_language: lang,
    translated_en: text,
    matched_keys,
    key_confidence_notes,
    extraction_source: 'fuse_fuzzy_fallback',
    cycle_pattern,
    cycle_gap_months_approx,
    hirsutism,
    acne,
    hair_thinning,
    weight_gain,
    dark_skin_patches,
    fatigue,
    mood_changes,
    trying_to_conceive,
    pelvic_pain,
    heavy_bleeding,
    cold_intolerance,
    galactorrhea,
    is_unrelated: hasUnrelatedOnly,
    red_flags: red_flags_names,
    missing_info: [
      'Date of the first day of your last normal period',
      'Average length of your cycle over the past 12 months',
      'Whether you are taking hormonal pills or thyroid supplements',
    ],
  };
}

/**
 * Core Deterministic Rotterdam Criteria and Differential Matcher
 * Non-LLM, strictly explainable, rule-based logic.
 */
export async function matchSymptoms(
  extracted: ExtractedSymptoms,
  rawInput = ''
): Promise<MatchResult> {
  // 1. Red Flag Safety Check - PRIORITY ESCALATION
  const redFlags = await evaluateRedFlags(rawInput, extracted.red_flags);
  if (redFlags.length > 0) {
    const generalPathway = (await getCarePathway('pathway_general'))!;
    return {
      is_red_flag: true,
      triggered_red_flags: redFlags,
      is_unrelated_to_hormonal: false,
      rotterdam: {
        categories_touched_count: 0,
        categories: [],
        explainable_summary:
          'PCOS pattern matching paused due to urgent medical symptoms requiring immediate evaluation.',
      },
      matched_conditions: [],
      care_pathway: generalPathway,
      recommended_specialist: {
        specialist_type: 'Emergency Medical Services / Hospital Gynaecology Casualty',
        urgency: 'urgent',
        urgency_reason:
          'Your described symptoms suggest acute distress or blood loss that should be assessed immediately by healthcare providers.',
      },
      tests_to_discuss: [],
      questions_for_doctor: [
        'Is there any active acute bleeding or severe cause for my pain?',
        'Do I need immediate ultrasound or emergency stabilization?',
      ],
      things_to_note_before_visit: [
        'Go to the nearest emergency clinic or hospital.',
        'If possible, bring notes on how long heavy bleeding or pain has lasted.',
      ],
    };
  }

  // 2. Unrelated Symptoms Check
  if (extracted.is_unrelated) {
    const generalPathway = (await getCarePathway('pathway_general'))!;
    return {
      is_red_flag: false,
      triggered_red_flags: [],
      is_unrelated_to_hormonal: true,
      unrelated_message:
        'The symptoms you described (such as respiratory, fever, or viral concerns) appear unrelated to menstrual, hormonal, or reproductive health patterns. A general physician or primary care clinic is the best starting place for timely evaluation.',
      rotterdam: {
        categories_touched_count: 0,
        categories: [],
        explainable_summary:
          'No menstrual or hormonal patterns observed.',
      },
      matched_conditions: [],
      care_pathway: generalPathway,
      recommended_specialist: {
        specialist_type: 'General Physician / Primary Care Doctor',
        urgency: 'routine',
        urgency_reason: 'Consult a general physician for general health checkup and symptom relief.',
      },
      tests_to_discuss: [
        {
          name: 'General Clinical Examination',
          description: 'Basic temperature, vitals, and physical assessment.',
          framing: 'A physician may examine throat, chest, and vital signs.',
        },
      ],
      questions_for_doctor: [
        'What might be causing these acute symptoms?',
        'What supportive care or rest do you advise?',
      ],
      things_to_note_before_visit: [
        'Note when symptoms began and any fever readings.',
      ],
    };
  }

  // 3. Evaluate Rotterdam Criteria Categories (Purely Deterministic)
  const categories: RotterdamCategoryMatch[] = [];
  const keys = new Set(extracted.matched_keys || []);

  // Category 1: Ovulatory Dysfunction
  const ovulatoryTouched =
    keys.has('irregular_cycles') ||
    keys.has('missed_periods_amenorrhea') ||
    keys.has('frequent_periods') ||
    extracted.cycle_pattern === 'irregular' ||
    extracted.cycle_pattern === 'absent' ||
    extracted.cycle_pattern === 'very_long' ||
    extracted.cycle_pattern === 'very_frequent' ||
    (extracted.cycle_gap_months_approx !== null && extracted.cycle_gap_months_approx >= 1.5);

  const ovulatoryEvidence: string[] = [];
  if (keys.has('missed_periods_amenorrhea') || extracted.cycle_pattern === 'absent') {
    ovulatoryEvidence.push('Absent periods / amenorrhea');
  } else if (keys.has('irregular_cycles') || extracted.cycle_pattern === 'irregular') {
    ovulatoryEvidence.push('Unpredictable / irregular cycle intervals');
  } else if (extracted.cycle_pattern === 'very_long') {
    ovulatoryEvidence.push('Cycles longer than 35 days (oligomenorrhea)');
  }
  if (extracted.cycle_gap_months_approx && extracted.cycle_gap_months_approx >= 2) {
    ovulatoryEvidence.push(
      `Reported cycle delay of approximately ${extracted.cycle_gap_months_approx} months`
    );
  }

  categories.push({
    category: 'ovulatory_dysfunction',
    title: 'Rotterdam Criterion 1: Ovulatory Irregularity',
    status: ovulatoryTouched ? 'touched' : 'not_indicated',
    reason: ovulatoryTouched
      ? 'Your reported cycle delay or unpredictability aligns with ovulatory irregularities that clinicians examine under the international Rotterdam criteria.'
      : 'Your menstrual cycle rhythm was not reported as notably delayed or irregular.',
    evidence_symptoms: ovulatoryEvidence,
  });

  // Category 2: Signs of Hyperandrogenism
  const androgenEvidence: string[] = [];
  const hasHirsutism = keys.has('hirsutism') || extracted.hirsutism;
  const hasAcne = keys.has('acne') || extracted.acne;
  const hasHairThinning = keys.has('hair_thinning') || extracted.hair_thinning;

  if (hasHirsutism) androgenEvidence.push('Excess facial or body hair (hirsutism)');
  if (hasAcne) androgenEvidence.push('Persistent or hormonal breakouts / acne');
  if (hasHairThinning) androgenEvidence.push('Scalp hair thinning or hair fall');

  const androgenTouched = androgenEvidence.length > 0;
  categories.push({
    category: 'hyperandrogenism',
    title: 'Rotterdam Criterion 2: Clinical Signs of Hyperandrogenism',
    status: androgenTouched ? 'touched' : 'not_indicated',
    reason: androgenTouched
      ? `Your reported physical features (${androgenEvidence.join(', ')}) align with symptoms doctors review when evaluating androgen hormone sensitivity.`
      : 'No clinical physical indicators of androgen excess (such as excess facial hair or severe acne) were noted.',
    evidence_symptoms: androgenEvidence,
  });

  // Category 3: Polycystic Ovarian Morphology (Clinical / Ultrasound Only)
  categories.push({
    category: 'ultrasound_morphology',
    title: 'Rotterdam Criterion 3: Polycystic Ovarian Morphology',
    status: 'clinician_only',
    reason:
      'This criterion requires a pelvic ultrasound performed and interpreted by a medical imaging specialist (evaluating follicle count ≥ 20 per ovary or increased ovarian volume). It cannot be self-reported or assessed from home.',
    evidence_symptoms: [],
  });

  const touchedCount = categories.filter((c) => c.status === 'touched').length;

  let explainableSummary = '';
  if (touchedCount >= 2) {
    explainableSummary =
      'Your reported symptoms touch upon 2 out of the 3 Rotterdam criteria categories (ovulatory irregularity and clinical signs of androgen sensitivity). In medical practice, a doctor checks these alongside blood tests and a pelvic ultrasound to understand your pattern.';
  } else if (touchedCount === 1) {
    explainableSummary =
      'Your reported symptoms touch upon 1 Rotterdam criteria category. A doctor may look closely at other factors (lifestyle, stress, or thyroid function) before considering PCOS.';
  } else {
    explainableSummary =
      'Your reported symptoms do not clearly touch upon the primary Rotterdam criteria categories, but discussing any ongoing discomfort with a clinician is always advisable.';
  }

  // 4. Differential Diagnoses Matching
  const conditions = await findConditions();
  const matchedConditions: ConditionMatch[] = [];

  // PCOS Match Evaluation
  const pcosDoc = conditions.find((c) => c._id === 'cond_pcos');
  if (pcosDoc) {
    const pcosSymptomsMatched: string[] = [];
    if (ovulatoryTouched) pcosSymptomsMatched.push('Cycle irregularity / delay');
    if (hasHirsutism) pcosSymptomsMatched.push('Facial/body hair');
    if (hasAcne) pcosSymptomsMatched.push('Hormonal acne');
    if (hasHairThinning) pcosSymptomsMatched.push('Hair loss / thinning');
    if (keys.has('weight_gain') || extracted.weight_gain) pcosSymptomsMatched.push('Weight changes');
    if (keys.has('dark_skin_patches') || extracted.dark_skin_patches) pcosSymptomsMatched.push('Dark velvety skin (insulin resistance indicator)');
    if (keys.has('trying_to_conceive') || extracted.trying_to_conceive) pcosSymptomsMatched.push('Trying to conceive');
    if (keys.has('mood_changes') || extracted.mood_changes) pcosSymptomsMatched.push('Mood fluctuations');

    if (touchedCount >= 2) {
      matchedConditions.push({
        condition: pcosDoc,
        alignment_level: 'strong_alignment',
        rationale:
          'Symptoms touch upon both ovulatory cycle delays and physical signs often associated with androgen balances.',
        matched_symptoms: pcosSymptomsMatched,
      });
    } else if (touchedCount === 1) {
      matchedConditions.push({
        condition: pcosDoc,
        alignment_level: 'moderate_alignment',
        rationale:
          'Touches upon one Rotterdam category, which warrants discussing with a gynaecologist alongside routine health factors.',
        matched_symptoms: pcosSymptomsMatched,
      });
    }
  }

  // Thyroid Match Evaluation
  const thyroidDoc = conditions.find((c) => c._id === 'cond_thyroid');
  if (thyroidDoc) {
    const thyroidSymptoms: string[] = [];
    if (keys.has('fatigue') || extracted.fatigue) thyroidSymptoms.push('Persistent fatigue');
    if (keys.has('cold_intolerance') || extracted.cold_intolerance) thyroidSymptoms.push('Cold sensitivity');
    if (keys.has('weight_gain') || extracted.weight_gain) thyroidSymptoms.push('Weight gain');
    if (hasHairThinning) thyroidSymptoms.push('Hair loss');
    if (ovulatoryTouched) thyroidSymptoms.push('Menstrual cycle irregularity');

    if (thyroidSymptoms.length >= 2) {
      matchedConditions.push({
        condition: thyroidDoc,
        alignment_level: 'differential_consideration',
        rationale:
          'Thyroid function frequently affects cycle regularity, energy, and weight, and is one of the first things a doctor tests to rule out or differentiate from PCOS.',
        matched_symptoms: thyroidSymptoms,
      });
    }
  }

  // Hyperprolactinemia Evaluation
  const prolactinDoc = conditions.find((c) => c._id === 'cond_hyperprolactinemia');
  if (prolactinDoc) {
    const prolactinSymptoms: string[] = [];
    if (keys.has('galactorrhea') || extracted.galactorrhea) prolactinSymptoms.push('Nipple discharge (galactorrhea)');
    if (keys.has('missed_periods_amenorrhea') || extracted.cycle_pattern === 'absent') prolactinSymptoms.push('Amenorrhea (absent periods)');
    if (keys.has('trying_to_conceive') || extracted.trying_to_conceive) prolactinSymptoms.push('Conception challenges');

    if (keys.has('galactorrhea') || extracted.galactorrhea || prolactinSymptoms.length >= 2) {
      matchedConditions.push({
        condition: prolactinDoc,
        alignment_level: 'differential_consideration',
        rationale:
          'Elevated prolactin can suppress the pituitary signals for ovulation, making it a key differential test.',
        matched_symptoms: prolactinSymptoms,
      });
    }
  }

  // Endometriosis Evaluation
  const endoDoc = conditions.find((c) => c._id === 'cond_endometriosis');
  if (endoDoc) {
    const endoSymptoms: string[] = [];
    if (keys.has('pelvic_pain') || extracted.pelvic_pain) endoSymptoms.push('Significant pelvic pain');
    if (keys.has('heavy_bleeding') || extracted.heavy_bleeding) endoSymptoms.push('Heavy menstrual bleeding');

    if (endoSymptoms.length >= 1) {
      matchedConditions.push({
        condition: endoDoc,
        alignment_level: 'differential_consideration',
        rationale:
          'Significant pelvic pain or heavy bleeding often indicates pelvic or uterine lining considerations rather than pure PCOS.',
        matched_symptoms: endoSymptoms,
      });
    }
  }

  // 5. Select Care Pathway & Urgency
  const primaryPathway =
    touchedCount >= 1
      ? (await getCarePathway('pathway_pcos'))!
      : (await getCarePathway('pathway_general'))!;

  let urgency: 'routine' | 'soon' | 'urgent' = 'routine';
  let urgencyReason =
    'Your symptoms are stable and can be discussed during a planned, routine visit with a healthcare provider.';

  if (
    (extracted.cycle_gap_months_approx !== null && extracted.cycle_gap_months_approx >= 3) ||
    extracted.cycle_pattern === 'absent'
  ) {
    urgency = 'soon';
    urgencyReason =
      'Periods absent for 3 months or more warrant timely medical consultation to evaluate the uterine lining (endometrium) and hormone health.';
  } else if (extracted.trying_to_conceive && ovulatoryTouched) {
    urgency = 'soon';
    urgencyReason =
      'If you are actively trying to conceive with irregular cycles, consulting a gynaecologist soon can assist in ovulation tracking.';
  }

  let specialistType = primaryPathway.specialist.primary;
  if (matchedConditions.some((m) => m.condition._id === 'cond_thyroid') && touchedCount === 0) {
    specialistType = 'Endocrinologist or General Physician';
  }

  return {
    is_red_flag: false,
    triggered_red_flags: [],
    is_unrelated_to_hormonal: false,
    rotterdam: {
      categories_touched_count: touchedCount,
      categories,
      explainable_summary: explainableSummary,
    },
    matched_conditions: matchedConditions,
    care_pathway: primaryPathway,
    recommended_specialist: {
      specialist_type: specialistType,
      urgency,
      urgency_reason: urgencyReason,
    },
    tests_to_discuss: primaryPathway.tests,
    questions_for_doctor: primaryPathway.questions_for_doctor,
    things_to_note_before_visit: primaryPathway.things_to_note_before_visit,
  };
}
