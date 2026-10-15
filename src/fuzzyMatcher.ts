/**
 * SakhiCheck Fuse.js Fuzzy Normalizer & Matcher Fallback
 *
 * Used as an instant, resilient fallback if the Gemini API call fails or times out.
 * Features:
 * - Text normalization: lowercase, punctuation removal, collapsing repeated letters
 * - Common colloquial phonetic variant normalization (nahi/nahin/nai, mahine/mahina, etc.)
 * - Fuzzy dictionary matching using Fuse.js (threshold ~0.35) over all multi-lingual synonyms.
 */

import Fuse from 'fuse.js';
import symptomsData from '../data/symptoms.json';
import { evaluateRedFlags } from './matcher';
import type {
  ExtractedSymptoms,
  CyclePattern,
  KeyConfidenceNote,
  SupportedLanguage,
  Symptom,
} from './types';

const symptomsList: Symptom[] = symptomsData as Symptom[];

/**
 * Normalizes user text by removing punctuation, collapsing repeated letters,
 * and canonicalizing frequent multi-lingual spelling variants.
 */
export function normalizeUserText(input: string): string {
  if (!input) return '';

  let text = input.toLowerCase();

  // 1. Remove punctuation and special characters while preserving Unicode (Devanagari, Kannada, Latin)
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // 2. Collapse letters repeated 3 or more times (e.g. "irregulllar" -> "irregular", "acnnne" -> "acne", "bohoooot" -> "bohot")
  text = text.replace(/(.)\1{2,}/gu, '$1$1');

  // 3. Canonicalize common Hindi / Hinglish / English phonetic spelling variants
  text = text
    .replace(/\b(nahi|nahin|nai|nhn|nahe|illa|illaa)\b/gi, 'nahi')
    .replace(/\b(mahine|mahina|maheene|months|month|tingalu|tingal)\b/gi, 'mahine')
    .replace(/\b(jhad|jhar|jhadna|shedding|shed|fall|falling|uduru|uduruvudu)\b/gi, 'shedding')
    .replace(/\b(baal|bal|koodlu|hair)\b/gi, 'hair')
    .replace(/\b(mensturation|menstruation|menses|mense|period|periods|prds|peroid|peroids|muttu)\b/gi, 'periods')
    .replace(/\b(irregulr|irreguler|irregulat|irregular|aniyamita|anregulr)\b/gi, 'irregular')
    .replace(/\b(acn|acnee|acne|pimple|pimples|pimpal|modave)\b/gi, 'acne')
    .replace(/\b(moodswings|mood swing|mood swings)\b/gi, 'mood swings')
    .replace(/\b(facial hair|chin hair|thodi ke baal|chin pe baal)\b/gi, 'facial hair');

  // Normalize excessive spaces
  return text.replace(/\s+/g, ' ').trim();
}

interface SynonymIndexItem {
  key: string;
  synonym: string;
  normalizedSynonym: string;
  label: string;
}

// Build pre-indexed synonym list for Fuse.js
const synonymIndex: SynonymIndexItem[] = [];

for (const symp of symptomsList) {
  const allSyns = [
    symp.label_en,
    ...symp.synonyms.en,
    ...symp.synonyms.hi,
    ...symp.synonyms.kn,
  ];

  for (const s of allSyns) {
    synonymIndex.push({
      key: symp.key,
      synonym: s,
      normalizedSynonym: normalizeUserText(s),
      label: symp.label_en,
    });
  }
}

// Configure Fuse.js with ~0.35 threshold
const fuse = new Fuse(synonymIndex, {
  keys: ['normalizedSynonym', 'synonym'],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 3,
});

/**
 * Executes fallback fuzzy extraction using Fuse.js over normalized n-grams.
 */
export async function extractSymptomsFuzzy(
  rawInput: string,
  lang: SupportedLanguage = 'en'
): Promise<ExtractedSymptoms> {
  const normalized = normalizeUserText(rawInput);
  const words = normalized.split(/\s+/);
  const matchedKeySet = new Set<string>();
  const confidenceNotes: KeyConfidenceNote[] = [];

  // Generate candidate phrases (1-word, 2-word, 3-word, 4-word windows)
  const phrases: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= 4 && i + len <= words.length; len++) {
      phrases.push(words.slice(i, i + len).join(' '));
    }
  }

  // Also include the entire normalized string if short
  if (words.length <= 6) {
    phrases.push(normalized);
  }

  for (const phrase of phrases) {
    if (phrase.length < 3) continue;

    // Ignore isolated generic single words that cause ambiguous cross-matching
    const genericSingleWords = new Set(['hair', 'baal', 'pain', 'gain', 'dark', 'loss', 'time', 'heat']);
    if (phrase.split(/\s+/).length === 1 && genericSingleWords.has(phrase)) {
      continue;
    }

    const results = fuse.search(phrase);
    if (results.length > 0) {
      const best = results[0];
      const score = best.score ?? 1;

      if (score <= 0.35) {
        const key = best.item.key;
        if (!matchedKeySet.has(key)) {
          matchedKeySet.add(key);
          confidenceNotes.push({
            key,
            user_mention: phrase,
            confidence: score < 0.2 ? 'high' : 'medium',
            note: `Fuzzy matched with "${best.item.synonym}" (score: ${score.toFixed(2)})`,
          });
        }
      }
    }
  }

  // Detect cycle pattern & cycle gap months
  let cycle_pattern: CyclePattern = 'unknown';
  let cycle_gap_months_approx: number | null = null;

  const has3Months =
    /(\b3\s*mahine\b|\bteen\s*mahine\b|\bthree\s*months?\b|\b3\s*months?\b)/i.test(normalized);
  const has2Months =
    /(\b2\s*mahine\b|\bdo\s*mahine\b|\btwo\s*months?\b|\b2\s*months?\b)/i.test(normalized);
  const hasMissed =
    /(nahi\s*aaye|nahi\s*aaya|missed|miss|absent|band|ruk\s*gaye|billa)/i.test(normalized);
  const hasIrregular =
    /(irregular|aniyamita|aage\s*piche|unpredictable|delay|late)/i.test(normalized);

  if (has3Months || (hasMissed && has3Months)) {
    cycle_pattern = 'absent';
    cycle_gap_months_approx = 3;
    matchedKeySet.add('missed_periods_amenorrhea');
  } else if (has2Months) {
    cycle_pattern = 'irregular';
    cycle_gap_months_approx = 2;
    matchedKeySet.add('irregular_cycles');
  } else if (hasMissed) {
    cycle_pattern = 'absent';
    cycle_gap_months_approx = 2;
    matchedKeySet.add('missed_periods_amenorrhea');
  } else if (hasIrregular) {
    cycle_pattern = 'irregular';
    matchedKeySet.add('irregular_cycles');
  } else if (/(regular|sari\s*aagi|time\s*par)/i.test(normalized)) {
    cycle_pattern = 'regular';
  }

  // Detect red flags on raw text
  const redFlags = await evaluateRedFlags(rawInput);
  const red_flag_names = redFlags.map((rf) => rf.name);

  // Check if completely unrelated
  const unrelatedWords = ['cough', 'fever', 'cold', 'bukhar', 'khansi', 'throat', 'gala', 'jwara'];
  const hasUnrelated =
    unrelatedWords.some((w) => normalized.includes(w)) &&
    matchedKeySet.size === 0 &&
    cycle_pattern === 'unknown';

  const matched_keys = Array.from(matchedKeySet);

  return {
    detected_language: lang,
    translated_en: rawInput,
    matched_keys,
    key_confidence_notes: confidenceNotes,
    extraction_source: 'fuse_fuzzy_fallback',
    cycle_pattern,
    cycle_gap_months_approx,
    hirsutism: matched_keys.includes('hirsutism'),
    acne: matched_keys.includes('acne'),
    hair_thinning: matched_keys.includes('hair_thinning'),
    weight_gain: matched_keys.includes('weight_gain'),
    dark_skin_patches: matched_keys.includes('dark_skin_patches'),
    fatigue: matched_keys.includes('fatigue'),
    mood_changes: matched_keys.includes('mood_changes'),
    trying_to_conceive: matched_keys.includes('trying_to_conceive'),
    pelvic_pain: matched_keys.includes('pelvic_pain'),
    heavy_bleeding: matched_keys.includes('heavy_bleeding'),
    cold_intolerance: matched_keys.includes('cold_intolerance'),
    heat_intolerance: matched_keys.includes('heat_intolerance'),
    galactorrhea: matched_keys.includes('galactorrhea'),
    sleep_issues: matched_keys.includes('sleep_issues'),
    is_unrelated: hasUnrelated,
    red_flags: red_flag_names,
    missing_info: [
      'Date of the first day of your last menstrual period',
      'Average cycle length over the past 6 to 12 months',
      'Any medications, supplements, or contraceptive pills',
    ],
  };
}
