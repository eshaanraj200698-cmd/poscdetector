/**
 * SakhiCheck Full-Stack Server
 * Express backend running Vite middlewares in dev.
 * Provides secure server-side Gemini 3.8 Flash extraction endpoint with strict JSON schema.
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize server-side Gemini client with required User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Fixed canonical list of symptom keys from symptoms.json
const ALLOWED_SYMPTOM_KEYS = [
  'irregular_cycles',
  'missed_periods_amenorrhea',
  'heavy_bleeding',
  'frequent_periods',
  'hirsutism',
  'acne',
  'hair_thinning',
  'weight_gain',
  'dark_skin_patches',
  'fatigue',
  'mood_changes',
  'pelvic_pain',
  'trying_to_conceive',
  'cold_intolerance',
  'heat_intolerance',
  'galactorrhea',
  'sleep_issues',
];

// Response Schema for structured symptom extraction
const extractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    detected_language: {
      type: Type.STRING,
      description: "Detected language of the user input ('en', 'hi', 'kn', or 'mixed')",
    },
    translated_en: {
      type: Type.STRING,
      description: "English translation and clinical paraphrase of the user's input",
    },
    matched_keys: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: `Array of matched keys. Must ONLY contain strings from: ${ALLOWED_SYMPTOM_KEYS.join(', ')}. Never invent keys.`,
    },
    key_confidence_notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: {
            type: Type.STRING,
            description: 'One of the allowed symptom keys',
          },
          user_mention: {
            type: Type.STRING,
            description: 'The exact or fuzzy phrase user wrote',
          },
          confidence: {
            type: Type.STRING,
            description: "'high' or 'medium'",
          },
          note: {
            type: Type.STRING,
            description: 'Short clinical mapping rationale',
          },
        },
        required: ['key', 'user_mention', 'confidence', 'note'],
      },
      description: 'Mapping notes explaining how user phrasing mapped to each key',
    },
    cycle_pattern: {
      type: Type.STRING,
      description:
        "One of: 'regular', 'irregular', 'absent', 'very_long', 'very_frequent', 'unknown'",
    },
    cycle_gap_months_approx: {
      type: Type.NUMBER,
      description:
        'Approximate months gap/delay between cycles if mentioned or inferred (e.g. 3, 2, or null/0 if not mentioned)',
    },
    red_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description:
        'Any emergency triggers found (e.g. pad soaking hourly, sudden severe pain, syncope, pregnancy with bleeding, self harm)',
    },
    missing_info: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description:
        'Key missing clinical information that a gynaecologist or physician would need to know',
    },
    is_unrelated: {
      type: Type.BOOLEAN,
      description:
        'True if the input is exclusively unrelated to menstrual or hormonal health (e.g. cold, cough, fever)',
    },
  },
  required: [
    'detected_language',
    'translated_en',
    'matched_keys',
    'key_confidence_notes',
    'cycle_pattern',
    'red_flags',
    'missing_info',
    'is_unrelated',
  ],
};

const EXTRACTION_SYSTEM_INSTRUCTION = `You are the clinical symptom extraction engine for SakhiCheck, a women's reproductive health companion focused on PCOS pattern understanding.
Your role is to map everyday user speech (typed or spoken in English, Hindi, Kannada, Hinglish, Kanglish, or mixed codes, with typos, slang, or colloquialisms) onto a STRICT FIXED SET of symptom keys.

ALLOWED SYMPTOM KEYS (DO NOT INVENT ANY OTHERS):
- irregular_cycles: late dates, unpredictable periods, cycles fluctuating (e.g. "mensturation irregulr", "date aage piche")
- missed_periods_amenorrhea: periods absent or stopped (e.g. "mujhe 3 mahine se period nahi aaya", "periods nai aaye 3 mahine", "periods stopped")
- heavy_bleeding: excessive flow, large clots, soaking through clothes
- frequent_periods: bleeding twice a month, cycle < 21 days
- hirsutism: excess coarse facial or body hair, chin hair, upper lip, beard-like hair (e.g. "facial hair", "chin pe baal", "thodi par baal")
- acne: persistent, cystic or hormonal breakouts (e.g. "acn", "pimples", "jawline breakouts")
- hair_thinning: scalp hair loss, shedding, female pattern baldness (e.g. "hair shedding", "baal jhad rahe", "hair fall", "koodlu uduruvudu")
- weight_gain: unexplained weight increase, stubborn belly fat (e.g. "wajan badh gaya", "pet nikal raha")
- dark_skin_patches: velvety dark skin folds on neck, underarms (acanthosis nigricans)
- fatigue: chronic exhaustion, lethargy, no energy
- mood_changes: irritability, mood swings, anxiety, depression (e.g. "mood swings", "chidhchidapan")
- pelvic_pain: lower abdominal or pelvic cramping, ovarian pain
- trying_to_conceive: fertility difficulties, actively planning pregnancy
- cold_intolerance: extreme sensitivity to cold, cold feet and hands
- heat_intolerance: excessive sweating, cannot tolerate heat
- galactorrhea: non-lactational breast or nipple fluid discharge
- sleep_issues: insomnia, disrupted sleep, sleep apnea

CRITICAL INSTRUCTIONS:
1. ONLY return keys from the allowed list above. Never return unlisted keys.
2. Accurately resolve typos and slang:
   - "mood swings, hair shedding" -> ["mood_changes", "hair_thinning"]
   - "mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain" -> ["missed_periods_amenorrhea", "hair_thinning"], cycle_pattern: "absent", cycle_gap_months_approx: 3
   - "periods nai aaye 3 mahine, baal jhad rahe" -> ["missed_periods_amenorrhea", "hair_thinning"], cycle_pattern: "absent", cycle_gap_months_approx: 3
   - "mood swings aur facial hair" -> ["mood_changes", "hirsutism"]
   - "mensturation irregulr and acn" -> ["irregular_cycles", "acne"], cycle_pattern: "irregular"
3. Red Flags: If user mentions soaking a pad every hour, severe sudden pelvic pain, fainting, pregnant with bleeding/pain, or self-harm thoughts, list it under red_flags.
4. If input is completely unrelated to reproductive/hormonal health (e.g., "cough and fever"), set is_unrelated: true.`;

// API endpoint: Extract symptoms with Gemini 3.8 Flash
app.post('/api/extract', async (req: Request, res: Response): Promise<void> => {
  const { text, language } = req.body;

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Text input is required' });
    return;
  }

  try {
    const prompt = `User Input: "${text}"\nPreferred Language Context: ${language || 'en'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: extractionResponseSchema,
        temperature: 0.1, // low temperature for precise factual extraction
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    // Sanitize matched_keys to ensure no unauthorized keys ever escape
    const validKeys = (parsed.matched_keys || []).filter((k: string) =>
      ALLOWED_SYMPTOM_KEYS.includes(k)
    );

    // Ensure boolean flags are synchronized with matched_keys
    const keySet = new Set(validKeys);

    res.json({
      success: true,
      extraction_source: 'gemini_ai',
      data: {
        detected_language: parsed.detected_language || language || 'en',
        translated_en: parsed.translated_en || text,
        matched_keys: validKeys,
        key_confidence_notes: parsed.key_confidence_notes || [],
        cycle_pattern: parsed.cycle_pattern || 'unknown',
        cycle_gap_months_approx: parsed.cycle_gap_months_approx ?? null,
        hirsutism: keySet.has('hirsutism'),
        acne: keySet.has('acne'),
        hair_thinning: keySet.has('hair_thinning'),
        weight_gain: keySet.has('weight_gain'),
        dark_skin_patches: keySet.has('dark_skin_patches'),
        fatigue: keySet.has('fatigue'),
        mood_changes: keySet.has('mood_changes'),
        trying_to_conceive: keySet.has('trying_to_conceive'),
        pelvic_pain: keySet.has('pelvic_pain'),
        heavy_bleeding: keySet.has('heavy_bleeding'),
        cold_intolerance: keySet.has('cold_intolerance'),
        heat_intolerance: keySet.has('heat_intolerance'),
        galactorrhea: keySet.has('galactorrhea'),
        sleep_issues: keySet.has('sleep_issues'),
        is_unrelated: Boolean(parsed.is_unrelated),
        red_flags: parsed.red_flags || [],
        missing_info: parsed.missing_info || [],
      },
    });
  } catch (error) {
    console.error('Gemini extraction error in server.ts:', error);
    res.status(500).json({
      success: false,
      error: 'Gemini extraction failed or timed out',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SakhiCheck server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
