/**
 * Phase 2 Verification Suite
 * Executes and benchmarks the 6 mandatory user test cases:
 * 1. "mood swings, hair shedding"
 * 2. "mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain"
 * 3. "periods nai aaye 3 mahine, baal jhad rahe"
 * 4. "mood swings aur facial hair"
 * 5. "mensturation irregulr and acn" (typos)
 * 6. "I am having severe sudden pelvic pain and soaking a pad every hour, feeling very dizzy and faint." (red-flag)
 */

import { extractSymptomsWithFallback, type ExtractionResult } from '../services/extractionService';
import { matchSymptoms } from '../matcher';
import type { MatchResult } from '../types';

export interface Phase2TestCase {
  id: string;
  name: string;
  input: string;
  language: 'en' | 'hi' | 'kn';
  description: string;
}

export interface Phase2TestExecutionResult {
  testCase: Phase2TestCase;
  extraction: ExtractionResult;
  match: MatchResult;
  passed: boolean;
  notes: string;
}

export const PHASE_2_TEST_CASES: Phase2TestCase[] = [
  {
    id: 'case_1',
    name: '1. Slang / Common Phrasing: mood swings, hair shedding',
    input: 'mood swings, hair shedding',
    language: 'en',
    description: 'Maps "mood swings" to mood_changes and "hair shedding" to hair_thinning',
  },
  {
    id: 'case_2',
    name: '2. Hinglish Conversational: 3 mahine se period nahi aaya aur baal jhad rahe hain',
    input: 'mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain',
    language: 'hi',
    description: 'Maps 3 mahine period nahi aaya to missed_periods_amenorrhea and baal jhad rahe to hair_thinning',
  },
  {
    id: 'case_3',
    name: '3. Colloquial Hinglish variant: periods nai aaye 3 mahine, baal jhad rahe',
    input: 'periods nai aaye 3 mahine, baal jhad rahe',
    language: 'hi',
    description: 'Tests phonetic variant "nai aaye" and "jhad rahe" mapping to missed_periods_amenorrhea and hair_thinning',
  },
  {
    id: 'case_4',
    name: '4. Mixed Code: mood swings aur facial hair',
    input: 'mood swings aur facial hair',
    language: 'hi',
    description: 'Maps mixed Hinglish "mood swings" to mood_changes and "facial hair" to hirsutism',
  },
  {
    id: 'case_5',
    name: '5. Typos: mensturation irregulr and acn',
    input: 'mensturation irregulr and acn',
    language: 'en',
    description: 'Robustly maps typos "mensturation irregulr" to irregular_cycles and "acn" to acne',
  },
  {
    id: 'case_6',
    name: '6. Acute Red-Flag Escalation: severe pain + pad soaking hourly',
    input: 'I am having severe sudden pelvic pain and soaking a pad every hour, feeling very dizzy and faint.',
    language: 'en',
    description: 'Ensures immediate emergency escalation card triggers and pauses PCOS analysis',
  },
];

/**
 * Runs a single Phase 2 test case through extraction and deterministic matching.
 */
export async function runSinglePhase2Test(tc: Phase2TestCase): Promise<Phase2TestExecutionResult> {
  const extraction = await extractSymptomsWithFallback(tc.input, tc.language);
  const match = await matchSymptoms(extraction.extracted, tc.input);

  const matchedKeys = extraction.extracted.matched_keys;
  let passed = false;
  let notes = '';

  switch (tc.id) {
    case 'case_1':
      passed = matchedKeys.includes('mood_changes') && matchedKeys.includes('hair_thinning');
      notes = `Extracted keys: [${matchedKeys.join(', ')}]. Expected mood_changes & hair_thinning.`;
      break;

    case 'case_2':
    case 'case_3':
      passed =
        (matchedKeys.includes('missed_periods_amenorrhea') || extraction.extracted.cycle_pattern === 'absent') &&
        matchedKeys.includes('hair_thinning');
      notes = `Extracted keys: [${matchedKeys.join(', ')}], cycle_pattern: ${extraction.extracted.cycle_pattern}. Expected missed_periods & hair_thinning.`;
      break;

    case 'case_4':
      passed = matchedKeys.includes('mood_changes') && matchedKeys.includes('hirsutism');
      notes = `Extracted keys: [${matchedKeys.join(', ')}]. Expected mood_changes & hirsutism.`;
      break;

    case 'case_5':
      passed = matchedKeys.includes('irregular_cycles') && matchedKeys.includes('acne');
      notes = `Extracted keys: [${matchedKeys.join(', ')}]. Expected irregular_cycles & acne from typo input.`;
      break;

    case 'case_6':
      passed = match.is_red_flag && match.recommended_specialist.urgency === 'urgent';
      notes = `Red flag triggered: ${match.is_red_flag}. Urgency: ${match.recommended_specialist.urgency}.`;
      break;

    default:
      passed = matchedKeys.length > 0;
  }

  return {
    testCase: tc,
    extraction,
    match,
    passed,
    notes,
  };
}

/**
 * Runs all 6 Phase 2 test cases sequentially.
 */
export async function runAllPhase2Tests(): Promise<Phase2TestExecutionResult[]> {
  const results: Phase2TestExecutionResult[] = [];
  for (const tc of PHASE_2_TEST_CASES) {
    const res = await runSinglePhase2Test(tc);
    results.push(res);
  }
  return results;
}
