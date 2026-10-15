/**
 * Database abstraction layer for SakhiCheck
 * Exposes MongoDB driver-style async queries.
 * Backed by /data collections with in-memory persistence for runtime sessions.
 * Can be swapped directly with MongoDB client (see /server implementation).
 */

import conditionsData from '../data/conditions.json';
import symptomsData from '../data/symptoms.json';
import carePathwaysData from '../data/care_pathways.json';
import redFlagsData from '../data/red_flags.json';
import sessionsData from '../data/sessions.json';

import type {
  Condition,
  Symptom,
  CarePathway,
  RedFlag,
  SessionDoc,
} from './types';

// In-memory document collections
const conditionsCollection: Condition[] = conditionsData as Condition[];
const symptomsCollection: Symptom[] = symptomsData as Symptom[];
const carePathwaysCollection: CarePathway[] = carePathwaysData as CarePathway[];
const redFlagsCollection: RedFlag[] = redFlagsData as RedFlag[];
const sessionsCollection: SessionDoc[] = [...(sessionsData as SessionDoc[])];

/**
 * Find conditions matching optional filter.
 */
export async function findConditions(
  filter?: Partial<Record<keyof Condition, unknown>>
): Promise<Condition[]> {
  if (!filter || Object.keys(filter).length === 0) {
    return [...conditionsCollection];
  }
  return conditionsCollection.filter((item) => {
    return Object.entries(filter).every(([key, value]) => {
      return (item as unknown as Record<string, unknown>)[key] === value;
    });
  });
}

/**
 * Get condition by ID.
 */
export async function getConditionById(id: string): Promise<Condition | null> {
  const match = conditionsCollection.find((c) => c._id === id);
  return match ? { ...match } : null;
}

/**
 * Get condition by name or partial name match.
 */
export async function getConditionByName(name: string): Promise<Condition | null> {
  const query = name.toLowerCase();
  const match = conditionsCollection.find(
    (c) => c.name.toLowerCase().includes(query) || c._id.toLowerCase() === query
  );
  return match ? { ...match } : null;
}

/**
 * Find symptoms, optionally filtered by category or key.
 */
export async function findSymptoms(
  filter?: Partial<Record<keyof Symptom, unknown>>
): Promise<Symptom[]> {
  if (!filter || Object.keys(filter).length === 0) {
    return [...symptomsCollection];
  }
  return symptomsCollection.filter((item) => {
    return Object.entries(filter).every(([key, value]) => {
      return (item as unknown as Record<string, unknown>)[key] === value;
    });
  });
}

/**
 * Get symptom by its unique key (e.g. 'hirsutism', 'irregular_cycles').
 */
export async function getSymptomByKey(key: string): Promise<Symptom | null> {
  const match = symptomsCollection.find((s) => s.key === key);
  return match ? { ...match } : null;
}

/**
 * Find care pathway by condition name or pathway ID.
 */
export async function getCarePathway(
  conditionNameOrId: string
): Promise<CarePathway | null> {
  const query = conditionNameOrId.toLowerCase();
  const match = carePathwaysCollection.find(
    (p) =>
      p._id.toLowerCase() === query ||
      p.condition.toLowerCase().includes(query)
  );
  if (match) return { ...match };

  // Fallback to general pathway
  const fallback = carePathwaysCollection.find((p) => p._id === 'pathway_general');
  return fallback ? { ...fallback } : carePathwaysCollection[0] || null;
}

/**
 * Find all care pathways.
 */
export async function findCarePathways(): Promise<CarePathway[]> {
  return [...carePathwaysCollection];
}

/**
 * Find all red flags and crisis triggers.
 */
export async function findRedFlags(): Promise<RedFlag[]> {
  return [...redFlagsCollection];
}

/**
 * Save a diagnostic exploration session (MongoDB insertOne style).
 */
export async function saveSession(
  sessionData: Omit<SessionDoc, '_id' | 'created_at'>
): Promise<SessionDoc> {
  const newSession: SessionDoc = {
    ...sessionData,
    _id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  sessionsCollection.unshift(newSession);
  return { ...newSession };
}

/**
 * Retrieve recent sessions (MongoDB find().sort().limit() style).
 */
export async function getSessions(limit = 20): Promise<SessionDoc[]> {
  return sessionsCollection.slice(0, limit).map((s) => ({ ...s }));
}

/**
 * Clear in-memory sessions (for test or demo resets).
 */
export async function clearSessions(): Promise<void> {
  sessionsCollection.length = 0;
}
