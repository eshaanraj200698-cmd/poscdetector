/**
 * Extraction Service for SakhiCheck
 * Coordinates Gemini 3.8 Flash structured extraction via /api/extract with
 * instant automatic failover to Fuse.js fuzzy matching if API fails or times out.
 */

import { extractSymptomsFuzzy } from '../fuzzyMatcher';
import { evaluateRedFlags } from '../matcher';
import type { ExtractedSymptoms, SupportedLanguage } from '../types';

export interface ExtractionResult {
  extracted: ExtractedSymptoms;
  source: 'gemini_ai' | 'fuse_fuzzy_fallback';
  durationMs: number;
  apiSuccess: boolean;
  error?: string;
}

/**
 * Extracts symptoms from raw user text via Gemini API,
 * falling back to normalized Fuse.js fuzzy matching on failure.
 */
export async function extractSymptomsWithFallback(
  text: string,
  language: SupportedLanguage = 'en'
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Invalid API response format');
    }

    const durationMs = Date.now() - startTime;
    const extractedData: ExtractedSymptoms = json.data;

    // Safety rule: Combine red flags from both raw text and LLM output
    const rawRedFlags = await evaluateRedFlags(text);
    const combinedRedFlags = Array.from(
      new Set([
        ...extractedData.red_flags,
        ...rawRedFlags.map((rf) => rf.name),
      ])
    );
    extractedData.red_flags = combinedRedFlags;
    extractedData.extraction_source = 'gemini_ai';

    return {
      extracted: extractedData,
      source: 'gemini_ai',
      durationMs,
      apiSuccess: true,
    };
  } catch (err) {
    console.warn('Gemini extraction failed or timed out, executing Fuse.js fallback:', err);
    const durationMs = Date.now() - startTime;

    // Execute Fuse.js fuzzy fallback
    const fallbackExtracted = await extractSymptomsFuzzy(text, language);

    // Merge red flags from raw text
    const rawRedFlags = await evaluateRedFlags(text);
    const combinedRedFlags = Array.from(
      new Set([
        ...fallbackExtracted.red_flags,
        ...rawRedFlags.map((rf) => rf.name),
      ])
    );
    fallbackExtracted.red_flags = combinedRedFlags;
    fallbackExtracted.extraction_source = 'fuse_fuzzy_fallback';

    return {
      extracted: fallbackExtracted,
      source: 'fuse_fuzzy_fallback',
      durationMs,
      apiSuccess: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
