/**
 * SakhiCheck Unit Tests for Phase 1 Engine
 * Tests multi-lingual inputs (English, Hindi, Kannada),
 * Rotterdam criteria matching, differentials, and hard red-flag safety rules.
 */

import { extractSymptomsFromKeywords, matchSymptoms } from '../matcher';
import type { SupportedLanguage, MatchResult } from '../types';

export interface TestCase {
  id: string;
  name: string;
  language: SupportedLanguage;
  input: string;
  expected: {
    is_red_flag: boolean;
    is_unrelated: boolean;
    rotterdam_touched_min?: number;
    rotterdam_touched_max?: number;
    expected_conditions?: string[];
    expected_urgency?: 'routine' | 'soon' | 'urgent';
  };
}

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  actual: {
    is_red_flag: boolean;
    is_unrelated: boolean;
    categories_touched: number;
    urgency: 'routine' | 'soon' | 'urgent';
    matched_conditions: string[];
    specialist: string;
  };
  details: string;
}

export const SAMPLE_TEST_CASES: TestCase[] = [
  {
    id: 'test_en_pcos',
    name: 'English: Classic Ovulatory Delay + Androgen Signs',
    language: 'en',
    input:
      'My periods are delayed by 2-3 months, I have noticed coarse hair on my chin and jawline, and stubborn acne.',
    expected: {
      is_red_flag: false,
      is_unrelated: false,
      rotterdam_touched_min: 2,
      rotterdam_touched_max: 2,
      expected_conditions: ['Polycystic Ovary Syndrome (PCOS)'],
      expected_urgency: 'soon',
    },
  },
  {
    id: 'test_hi_pcos',
    name: 'Hindi: पीरियड्स मिस होना और चिन पर मोटे बाल (Conversational Everyday Hindi)',
    language: 'hi',
    input:
      'मेरे पीरियड्स दो तीन महीने से नहीं आए हैं, ठोड़ी पर मोटे बाल आ रहे हैं और वजन अचानक बहुत बढ़ गया है।',
    expected: {
      is_red_flag: false,
      is_unrelated: false,
      rotterdam_touched_min: 2,
      rotterdam_touched_max: 2,
      expected_conditions: ['Polycystic Ovary Syndrome (PCOS)'],
      expected_urgency: 'soon',
    },
  },
  {
    id: 'test_kn_pcos',
    name: 'Kannada: ಮುಟ್ಟು ಬಾರದಿರುವುದು ಮತ್ತು ಗಲ್ಲದ ಮೇಲೆ ಕೂದಲು (Conversational Kannada)',
    language: 'kn',
    input:
      'ನನ್ನ ಮುಟ್ಟು ಕಳೆದ ಮೂರು ತಿಂಗಳಿಂದ ಬಂದಿಲ್ಲ, ಗಲ್ಲದ ಮೇಲೆ ಕೂದಲು ಬರ್ತಿದೆ ಮತ್ತು ಮುಖದಲ್ಲಿ ಮೊಡವೆಗಳು ಜಾಸ್ತಿಯಾಗಿವೆ.',
    expected: {
      is_red_flag: false,
      is_unrelated: false,
      rotterdam_touched_min: 2,
      rotterdam_touched_max: 2,
      expected_conditions: ['Polycystic Ovary Syndrome (PCOS)'],
      expected_urgency: 'soon',
    },
  },
  {
    id: 'test_red_flag_emergency',
    name: 'Safety Rule: Acute Red Flag Emergency Escalation',
    language: 'en',
    input:
      'I am having severe sudden pelvic pain and soaking a pad every hour, feeling very dizzy and faint.',
    expected: {
      is_red_flag: true,
      is_unrelated: false,
      rotterdam_touched_min: 0,
      rotterdam_touched_max: 0,
      expected_urgency: 'urgent',
    },
  },
  {
    id: 'test_thyroid_differential',
    name: 'Differential: Thyroid Indicators (Cold intolerance & fatigue)',
    language: 'en',
    input:
      'I have irregular periods, extreme fatigue, severe cold intolerance even in summer, and unexplained weight gain.',
    expected: {
      is_red_flag: false,
      is_unrelated: false,
      expected_conditions: [
        'Polycystic Ovary Syndrome (PCOS)',
        'Thyroid Dysfunction (Hypothyroidism / Hyperthyroidism)',
      ],
    },
  },
  {
    id: 'test_unrelated_symptoms',
    name: 'Out of Scope: Non-hormonal illness (Cough / Fever)',
    language: 'hi',
    input: 'मुझे बहुत तेज खांसी है, गले में दर्द और हल्का बुखार है।',
    expected: {
      is_red_flag: false,
      is_unrelated: true,
      expected_urgency: 'routine',
    },
  },
];

/**
 * Executes all Phase 1 test cases deterministically.
 */
export async function runAllTests(): Promise<{
  allPassed: boolean;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  for (const tc of SAMPLE_TEST_CASES) {
    const extracted = await extractSymptomsFromKeywords(tc.input, tc.language);
    const matched: MatchResult = await matchSymptoms(extracted, tc.input);

    const conditionNames = matched.matched_conditions.map((m) => m.condition.name);
    const categoriesTouched = matched.rotterdam.categories_touched_count;

    let passed = true;
    const failures: string[] = [];

    if (matched.is_red_flag !== tc.expected.is_red_flag) {
      passed = false;
      failures.push(
        `Red flag mismatch: expected ${tc.expected.is_red_flag}, got ${matched.is_red_flag}`
      );
    }

    if (matched.is_unrelated_to_hormonal !== tc.expected.is_unrelated) {
      passed = false;
      failures.push(
        `Unrelated mismatch: expected ${tc.expected.is_unrelated}, got ${matched.is_unrelated_to_hormonal}`
      );
    }

    if (tc.expected.rotterdam_touched_min !== undefined) {
      if (categoriesTouched < tc.expected.rotterdam_touched_min) {
        passed = false;
        failures.push(
          `Rotterdam categories touched too low: got ${categoriesTouched}, expected >= ${tc.expected.rotterdam_touched_min}`
        );
      }
    }

    if (tc.expected.rotterdam_touched_max !== undefined) {
      if (categoriesTouched > tc.expected.rotterdam_touched_max) {
        passed = false;
        failures.push(
          `Rotterdam categories touched too high: got ${categoriesTouched}, expected <= ${tc.expected.rotterdam_touched_max}`
        );
      }
    }

    if (tc.expected.expected_urgency) {
      if (matched.recommended_specialist.urgency !== tc.expected.expected_urgency) {
        passed = false;
        failures.push(
          `Urgency mismatch: expected ${tc.expected.expected_urgency}, got ${matched.recommended_specialist.urgency}`
        );
      }
    }

    if (tc.expected.expected_conditions) {
      for (const cond of tc.expected.expected_conditions) {
        if (!conditionNames.includes(cond)) {
          passed = false;
          failures.push(`Expected condition "${cond}" was not matched`);
        }
      }
    }

    results.push({
      id: tc.id,
      name: tc.name,
      passed,
      actual: {
        is_red_flag: matched.is_red_flag,
        is_unrelated: matched.is_unrelated_to_hormonal,
        categories_touched: categoriesTouched,
        urgency: matched.recommended_specialist.urgency,
        matched_conditions: conditionNames,
        specialist: matched.recommended_specialist.specialist_type,
      },
      details: passed ? 'All verification criteria passed.' : failures.join('; '),
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
