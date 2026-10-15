/**
 * SakhiCheck - Women's Health & PCOS Pattern Companion
 * Phase 2: Gemini 3.8 Flash Extraction + Fuse.js Fuzzy Normalizer + Deterministic Rotterdam Engine
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Stethoscope,
  Database,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  ArrowRight,
  Flame,
  Globe2,
  Cpu,
  Zap,
  Info,
} from 'lucide-react';

import {
  SAMPLE_TEST_CASES,
  runAllTests,
  type TestResult,
} from './tests/matcher.test';
import {
  PHASE_2_TEST_CASES,
  runAllPhase2Tests,
  type Phase2TestExecutionResult,
} from './tests/phase2_runner';
import { extractSymptomsWithFallback } from './services/extractionService';
import { matchSymptoms } from './matcher';
import {
  findConditions,
  findSymptoms,
  findCarePathways,
  getCarePathway,
  findRedFlags,
  getSessions,
  saveSession,
} from './db';
import type {
  SupportedLanguage,
  ExtractedSymptoms,
  MatchResult,
  Condition,
  Symptom,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'interactive' | 'phase2_benchmarks' | 'unit_tests' | 'database'>('interactive');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [inputText, setInputText] = useState('mood swings, hair shedding');

  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedSymptoms | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [extractionMeta, setExtractionMeta] = useState<{
    source: 'gemini_ai' | 'fuse_fuzzy_fallback';
    durationMs: number;
  } | null>(null);

  // Phase 2 benchmark state
  const [phase2Results, setPhase2Results] = useState<Phase2TestExecutionResult[] | null>(null);
  const [isRunningPhase2, setIsRunningPhase2] = useState(false);

  // Unit tests state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    allPassed: boolean;
    results: TestResult[];
  } | null>(null);

  // DB API Inspection state
  const [dbInspectionOutput, setDbInspectionOutput] = useState<{
    title: string;
    funcSignature: string;
    data: unknown;
  } | null>(null);

  // Database inspection state
  const [dbStats, setDbStats] = useState<{
    conditions: Condition[];
    symptoms: Symptom[];
    redFlagsCount: number;
    carePathwaysCount: number;
    sessionsCount: number;
  }>({
    conditions: [],
    symptoms: [],
    redFlagsCount: 0,
    carePathwaysCount: 0,
    sessionsCount: 0,
  });

  // Run initial test case on mount
  useEffect(() => {
    handleRunExtraction(inputText, selectedLanguage);
    loadDatabaseOverview();
  }, []);

  const loadDatabaseOverview = async () => {
    const conditions = await findConditions();
    const symptoms = await findSymptoms();
    const redFlags = await findRedFlags();
    const pathways = await findCarePathways();
    const sessions = await getSessions();
    setDbStats({
      conditions,
      symptoms,
      redFlagsCount: redFlags.length,
      carePathwaysCount: pathways.length,
      sessionsCount: sessions.length,
    });
  };

  const handleRunExtraction = async (
    customText?: string,
    lang?: SupportedLanguage
  ) => {
    setIsProcessing(true);
    const textToProcess = customText ?? inputText;
    const languageToUse = lang ?? selectedLanguage;

    try {
      const res = await extractSymptomsWithFallback(textToProcess, languageToUse);
      const matched = await matchSymptoms(res.extracted, textToProcess);

      setExtractedData(res.extracted);
      setMatchResult(matched);
      setExtractionMeta({
        source: res.source,
        durationMs: res.durationMs,
      });

      // Log session into mock MongoDB sessions collection
      await saveSession({
        language: languageToUse,
        raw_input: textToProcess,
        extracted: res.extracted,
        matched,
        urgency: matched.recommended_specialist.urgency,
      });

      loadDatabaseOverview();
    } catch (err) {
      console.error('Error in extraction pipeline:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectPhase2Case = (tc: (typeof PHASE_2_TEST_CASES)[0]) => {
    setInputText(tc.input);
    setSelectedLanguage(tc.language);
    handleRunExtraction(tc.input, tc.language);
  };

  const handleExecutePhase2Benchmarks = async () => {
    setIsRunningPhase2(true);
    try {
      const results = await runAllPhase2Tests();
      setPhase2Results(results);
    } catch (err) {
      console.error('Error executing Phase 2 benchmarks:', err);
    } finally {
      setIsRunningPhase2(false);
    }
  };

  const handleExecuteAllTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runAllTests();
      setTestResults(res);
    } catch (err) {
      console.error('Error executing tests:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleInspectFindSymptoms = async () => {
    const results = await findSymptoms({ category: 'androgenic' });
    setDbInspectionOutput({
      title: 'findSymptoms({ category: "androgenic" })',
      funcSignature: 'findSymptoms(filter?: Partial<Record<keyof Symptom, unknown>>): Promise<Symptom[]>',
      data: results,
    });
  };

  const handleInspectGetCarePathway = async () => {
    const pathway = await getCarePathway('pathway_pcos');
    setDbInspectionOutput({
      title: 'getCarePathway("pathway_pcos")',
      funcSignature: 'getCarePathway(conditionNameOrId: string): Promise<CarePathway | null>',
      data: pathway,
    });
  };

  const handleInspectSaveSession = async () => {
    const extractionResult = await extractSymptomsWithFallback(
      'मेरे पीरियड्स दो तीन महीने से नहीं आए हैं, चिन पर मोटे बाल आ रहे हैं',
      'hi'
    );
    const sampleMatch = await matchSymptoms(extractionResult.extracted);
    const saved = await saveSession({
      language: 'hi',
      raw_input: 'मेरे पीरियड्स दो तीन महीने से नहीं आए हैं, चिन पर मोटे बाल आ रहे हैं',
      extracted: extractionResult.extracted,
      matched: sampleMatch,
      urgency: sampleMatch.recommended_specialist.urgency,
    });
    setDbInspectionOutput({
      title: 'saveSession(sessionData)',
      funcSignature: 'saveSession(sessionData: Omit<SessionDoc, "_id" | "created_at">): Promise<SessionDoc>',
      data: saved,
    });
    loadDatabaseOverview();
  };

  const handleLanguageSwitch = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    if (lang === 'hi' && inputText.includes('mood swings, hair shedding')) {
      const hiSample = 'mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain';
      setInputText(hiSample);
      handleRunExtraction(hiSample, 'hi');
    } else if (lang === 'kn' && (inputText.includes('mood swings') || inputText.includes('period nahi aaya'))) {
      const knSample = 'ನನ್ನ ಮುಟ್ಟು ಕಳೆದ ಮೂರು ತಿಂಗಳಿಂದ ಬಂದಿಲ್ಲ, ಗಲ್ಲದ ಮೇಲೆ ಕೂದಲು ಬರ್ತಿದೆ ಮತ್ತು ಮೊಡವೆಗಳು ಜಾಸ್ತಿಯಾಗಿವೆ.';
      setInputText(knSample);
      handleRunExtraction(knSample, 'kn');
    } else if (lang === 'en' && (inputText.includes('period nahi aaya') || inputText.includes('ನನ್ನ ಮುಟ್ಟು'))) {
      const enSample = 'mood swings, hair shedding';
      setInputText(enSample);
      handleRunExtraction(enSample, 'en');
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8fc] text-[#1e1e24] flex flex-col font-sans">
      {/* Top Banner / Non-negotiable Disclaimer */}
      <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs">
        <div className="max-w-6xl mx-auto w-full flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Medical & Safety Disclaimer:</strong> SakhiCheck is an educational
            prototype designed for symptom pattern understanding. It does <em>not</em>{' '}
            diagnose conditions, provide percentages, or recommend medications.
            Always consult a qualified healthcare professional.
          </span>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-purple-100 shadow-xs sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 to-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
              स
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-purple-950">
                  SakhiCheck
                </h1>
                <span className="bg-gradient-to-r from-purple-700 to-teal-700 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                  Phase 2 Hybrid Engine
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Gemini 3.8 Flash Extraction + Fuse.js Normalizer + Deterministic Rotterdam Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-purple-50/80 p-1 rounded-xl border border-purple-200/60 text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab('interactive')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'interactive'
                  ? 'bg-white text-purple-900 shadow-xs font-semibold'
                  : 'text-purple-700 hover:text-purple-950'
              }`}
            >
              Interactive Matcher
            </button>
            <button
              onClick={() => {
                setActiveTab('phase2_benchmarks');
                if (!phase2Results) handleExecutePhase2Benchmarks();
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'phase2_benchmarks'
                  ? 'bg-white text-purple-900 shadow-xs font-semibold'
                  : 'text-purple-700 hover:text-purple-950'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-purple-700" />
              <span>Phase 2 Benchmarks</span>
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
            </button>
            <button
              onClick={() => {
                setActiveTab('unit_tests');
                if (!testResults) handleExecuteAllTests();
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'unit_tests'
                  ? 'bg-white text-purple-900 shadow-xs font-semibold'
                  : 'text-purple-700 hover:text-purple-950'
              }`}
            >
              <span>Unit Tests</span>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'bg-white text-purple-900 shadow-xs font-semibold'
                  : 'text-purple-700 hover:text-purple-950'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>KB Collections</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* Interactive Matcher Tab */}
        {activeTab === 'interactive' && (
          <div className="space-y-6">
            {/* Phase 2 Quick Benchmark Clickers */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-100 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Phase 2 Mandatory Verification Cases (Click any to test instant mapping):
                </span>
                <span className="text-xs text-slate-400">Slang • Typos • Hinglish • Red-flags</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {PHASE_2_TEST_CASES.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => handleSelectPhase2Case(tc)}
                    className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 uppercase">
                        {tc.id}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {tc.language === 'en' ? 'EN' : 'HI/Hinglish'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      "{tc.input}"
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {tc.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form Box */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-purple-700" />
                  Describe menstrual or physical symptoms (English, हिन्दी, ಕನ್ನಡ, Hinglish, slang, or typos):
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                  {(['en', 'hi', 'kn'] as SupportedLanguage[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageSwitch(lang)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        selectedLanguage === lang
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="w-full p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm leading-relaxed"
                placeholder={
                  selectedLanguage === 'hi'
                    ? 'जैसे: mujhe 3 mahine se period nahi aaya aur baal jhad rahe hain...'
                    : selectedLanguage === 'kn'
                    ? 'ಉದಾಹರಣೆಗೆ: ನನ್ನ ಮುಟ್ಟು ಕಳೆದ ಮೂರು ತಿಂಗಳಿಂದ ಬಂದಿಲ್ಲ, ಗಲ್ಲದ ಮೇಲೆ ಕೂದಲು ಬರ್ತಿದೆ...'
                    : 'e.g. mood swings, hair shedding, mensturation irregulr and acn...'
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  {extractionMeta && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                        extractionMeta.source === 'gemini_ai'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {extractionMeta.source === 'gemini_ai' ? (
                        <>
                          <Zap className="w-3 h-3 text-teal-600 fill-teal-600" />
                          <span>Gemini 3.8 Flash Extractor ({extractionMeta.durationMs}ms)</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="w-3 h-3 text-amber-600" />
                          <span>Fuse.js Fuzzy Fallback ({extractionMeta.durationMs}ms)</span>
                        </>
                      )}
                    </span>
                  )}
                  <span className="text-slate-400">
                    Rotterdam rules run 100% deterministically on extracted keys.
                  </span>
                </div>
                <button
                  onClick={() => handleRunExtraction()}
                  disabled={isProcessing || !inputText.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-700 to-teal-700 hover:from-purple-800 hover:to-teal-800 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isProcessing ? 'Analyzing with Gemini...' : 'Extract & Match'}</span>
                </button>
              </div>
            </div>

            {/* Results Section */}
            {matchResult && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* 1. Red Flag Emergency Alert Card (Displayed FIRST if triggered) */}
                {matchResult.is_red_flag && (
                  <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-5 sm:p-6 shadow-md text-rose-950 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
                            Immediate Medical Attention Needed
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-rose-950">
                          Urgent Red-Flag Escalation Detected
                        </h2>
                        <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                          Your input contains symptoms that require immediate in-person emergency
                          care. Routine PCOS pattern analysis has been paused so you can focus on
                          seeking prompt medical attention.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-rose-200">
                      {matchResult.triggered_red_flags.map((flag) => (
                        <div
                          key={flag._id}
                          className="bg-white/80 p-3.5 rounded-xl border border-rose-200 space-y-1 text-sm"
                        >
                          <div className="font-semibold text-rose-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                            {flag.name}
                          </div>
                          <p className="text-xs text-rose-800">
                            <strong>English:</strong> {flag.message.en}
                          </p>
                          <p className="text-xs text-rose-800">
                            <strong>हिन्दी:</strong> {flag.message.hi}
                          </p>
                          <p className="text-xs text-rose-800">
                            <strong>ಕನ್ನಡ:</strong> {flag.message.kn}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-rose-600 text-white p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-medium">
                      <span>
                        Recommended Action: Call local emergency services (112 / 108 / 911) or visit
                        the nearest hospital emergency room immediately.
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Unrelated Symptoms Notice */}
                {matchResult.is_unrelated_to_hormonal && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs text-blue-950 space-y-3">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-base font-bold text-blue-900">
                          Non-Hormonal / General Health Symptoms
                        </h2>
                        <p className="text-xs sm:text-sm text-blue-800 mt-1 leading-relaxed">
                          {matchResult.unrelated_message}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 flex items-center gap-2 text-xs text-blue-700">
                      <span className="font-semibold">Recommended step:</span> Schedule an
                      appointment with a General Physician / Family Doctor.
                    </div>
                  </div>
                )}

                {/* 3. Normal Pattern Results (If NOT a Red Flag and NOT Unrelated) */}
                {!matchResult.is_red_flag && !matchResult.is_unrelated_to_hormonal && (
                  <div className="space-y-6">
                    {/* Card A: Structured Extraction with Exact Keys & Confidence Notes */}
                    {extractedData && (
                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-50 pb-3">
                          <h2 className="text-base font-bold text-purple-950 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-purple-700" />
                            What We Understood (Phase 2 Structured Extraction)
                          </h2>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md font-semibold">
                              {extractedData.matched_keys.length} fixed keys matched
                            </span>
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                              Cycle: {extractedData.cycle_pattern}
                            </span>
                          </div>
                        </div>

                        {/* Matched Keys Chips */}
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                            Canonical Symptom Keys Mapped from Input:
                          </div>
                          {extractedData.matched_keys.length === 0 ? (
                            <div className="text-xs text-slate-500 italic">
                              No known reproductive/hormonal symptom keys extracted.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {extractedData.matched_keys.map((k) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 text-purple-950 border border-purple-200 text-xs font-semibold"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                                  <code>{k}</code>
                                </span>
                              ))}
                              {extractedData.cycle_gap_months_approx && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-xs font-semibold">
                                  <span>Cycle delay: ~{extractedData.cycle_gap_months_approx} months</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Confidence Notes Table */}
                        {extractedData.key_confidence_notes.length > 0 && (
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                              Extraction Transparency & Confidence Notes:
                            </div>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                              <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                                <thead className="bg-slate-50 text-slate-700 font-semibold">
                                  <tr>
                                    <th className="p-2.5">Canonical Key</th>
                                    <th className="p-2.5">User Phrasing / Mention</th>
                                    <th className="p-2.5">Confidence</th>
                                    <th className="p-2.5">Clinical Mapping Note</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {extractedData.key_confidence_notes.map((note, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/60">
                                      <td className="p-2.5 font-mono text-[11px] text-purple-800 font-semibold">
                                        {note.key}
                                      </td>
                                      <td className="p-2.5 text-slate-800 font-medium">
                                        "{note.user_mention}"
                                      </td>
                                      <td className="p-2.5">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            note.confidence === 'high'
                                              ? 'bg-teal-100 text-teal-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {note.confidence}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-slate-600 leading-relaxed">
                                        {note.note}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card B: Rotterdam Criteria Diagnostic Framework */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-xs space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-50 pb-3">
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-purple-950 flex items-center gap-2">
                            <Stethoscope className="w-5 h-5 text-purple-700" />
                            Rotterdam Criteria Framework (Deterministic Logic)
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Grounded in the international 2023 Rotterdam Consensus. Rules run
                            exclusively on extracted keys.
                          </p>
                        </div>
                        <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900">
                          {matchResult.rotterdam.categories_touched_count} of 2 self-reportable
                          categories touched
                        </div>
                      </div>

                      {/* Summary Banner */}
                      <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 text-xs sm:text-sm text-purple-900 leading-relaxed font-medium">
                        {matchResult.rotterdam.explainable_summary}
                      </div>

                      {/* Criteria 3-Box Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {matchResult.rotterdam.categories.map((cat, idx) => (
                          <div
                            key={cat.category}
                            className={`p-4 rounded-xl border flex flex-col justify-between ${
                              cat.status === 'touched'
                                ? 'bg-purple-50/40 border-purple-300'
                                : cat.status === 'clinician_only'
                                ? 'bg-slate-50/80 border-slate-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">
                                  Category {idx + 1}
                                </span>
                                {cat.status === 'touched' ? (
                                  <span className="text-[11px] font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-purple-700" /> Touched
                                  </span>
                                ) : cat.status === 'clinician_only' ? (
                                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                                    Doctor-checked only
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    Not reported
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-slate-900">{cat.title}</h3>
                              <p className="text-xs text-slate-600 leading-relaxed">{cat.reason}</p>
                            </div>

                            {cat.evidence_symptoms.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-purple-100 text-[11px] text-purple-900 font-medium">
                                Reported: {cat.evidence_symptoms.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card C: Conditions Alignment & Differentials */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-xs space-y-4">
                      <h2 className="text-base font-bold text-purple-950 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-700" />
                        Patterns Worth Discussing with a Doctor
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {matchResult.matched_conditions.map((match) => (
                          <div
                            key={match.condition._id}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900">
                                {match.condition.name}
                              </h3>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase ${
                                  match.alignment_level === 'strong_alignment'
                                    ? 'bg-purple-100 text-purple-900'
                                    : match.alignment_level === 'moderate_alignment'
                                    ? 'bg-teal-100 text-teal-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {match.alignment_level === 'strong_alignment'
                                  ? 'Noticeable Pattern'
                                  : match.alignment_level === 'moderate_alignment'
                                  ? 'Moderate Pattern'
                                  : 'Differential Consideration'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {match.rationale}
                            </p>
                            <div className="text-[11px] text-slate-500 pt-1">
                              <strong>Key symptoms noted:</strong>{' '}
                              {match.matched_symptoms.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card D: Recommended Care Pathway & Urgency */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Specialist & Urgency */}
                      <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                          Who to See & Urgency
                        </span>
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <div className="text-base font-bold text-purple-950">
                              {matchResult.recommended_specialist.specialist_type}
                            </div>
                            <div className="text-xs text-slate-500">
                              Primary recommended clinician
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-xl uppercase ${
                              matchResult.recommended_specialist.urgency === 'urgent'
                                ? 'bg-rose-100 text-rose-800'
                                : matchResult.recommended_specialist.urgency === 'soon'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-teal-100 text-teal-900'
                            }`}
                          >
                            {matchResult.recommended_specialist.urgency === 'soon'
                              ? 'Schedule Soon (1-2 weeks)'
                              : 'Routine Planned Visit'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {matchResult.recommended_specialist.urgency_reason}
                        </p>
                      </div>

                      {/* Tests a Doctor May Suggest */}
                      <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                          Tests a Doctor May Suggest (Framed cautiously)
                        </span>
                        <ul className="space-y-2 pt-1 text-xs text-slate-700">
                          {matchResult.tests_to_discuss.slice(0, 3).map((test, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5 shrink-0"></span>
                              <div>
                                <strong>{test.name}:</strong> {test.framing}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Card E: Questions for Doctor */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-xs space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                        Checklist: Questions to Ask Your Doctor
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {matchResult.questions_for_doctor.slice(0, 4).map((q, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-950 flex items-start gap-2"
                          >
                            <span className="font-bold text-purple-600 shrink-0">
                              Q{idx + 1}.
                            </span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 2 Benchmarks Tab (Real Output of the 6 Mandatory Inputs) */}
        {activeTab === 'phase2_benchmarks' && (
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-50 pb-4">
              <div>
                <h2 className="text-lg font-bold text-purple-950 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-700" />
                  Phase 2 Benchmark Test Execution (Real Output)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated execution of the 6 required test inputs through Gemini extraction,
                  canonical key mapping, Fuse.js fallback readiness, and deterministic Rotterdam
                  matching.
                </p>
              </div>
              <button
                onClick={handleExecutePhase2Benchmarks}
                disabled={isRunningPhase2}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRunningPhase2 ? 'animate-spin' : ''}`} />
                <span>{isRunningPhase2 ? 'Executing benchmarks...' : 'Re-run All 6 Benchmarks'}</span>
              </button>
            </div>

            {phase2Results && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 flex items-center justify-between">
                  <span>
                    Benchmark status: All 6 test inputs processed with canonical key mappings,
                    confidence notes, and deterministic criteria audit.
                  </span>
                  <span className="font-bold text-purple-900 bg-white px-2.5 py-1 rounded-md">
                    {phase2Results.filter((r) => r.passed).length} / {phase2Results.length} Verified
                  </span>
                </div>

                <div className="space-y-3">
                  {phase2Results.map((r) => (
                    <div
                      key={r.testCase.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">
                            {r.testCase.name}
                          </span>
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            Raw Input: "{r.testCase.input}"
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              r.extraction.source === 'gemini_ai'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.extraction.source === 'gemini_ai' ? 'Gemini 3.8 Flash' : 'Fuse.js Fallback'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              r.passed
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.passed ? 'PASSED' : 'FLAGGED'}
                          </span>
                        </div>
                      </div>

                      {/* Extracted Structured Data */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Matched Keys:
                          </span>
                          <div className="font-mono text-purple-800 font-semibold mt-1">
                            {r.extraction.extracted.matched_keys.length > 0
                              ? r.extraction.extracted.matched_keys.join(', ')
                              : 'None'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Cycle Rhythm:
                          </span>
                          <div className="font-semibold text-slate-800 mt-1">
                            {r.extraction.extracted.cycle_pattern}
                            {r.extraction.extracted.cycle_gap_months_approx &&
                              ` (~${r.extraction.extracted.cycle_gap_months_approx} mo)`}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Rotterdam Criteria Touched:
                          </span>
                          <div className="font-semibold text-slate-800 mt-1">
                            {r.match.rotterdam.categories_touched_count} of 2 self-reportable
                          </div>
                        </div>
                      </div>

                      {/* Confidence Notes */}
                      {r.extraction.extracted.key_confidence_notes.length > 0 && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                          <span className="font-semibold text-slate-700">Confidence Mapping:</span>
                          {r.extraction.extracted.key_confidence_notes.map((cn, i) => (
                            <div key={i} className="text-slate-600 flex items-center gap-2">
                              <span className="font-mono text-purple-700 font-semibold">{cn.key}</span>
                              <span>←</span>
                              <span className="italic">"{cn.user_mention}"</span>
                              <span className="text-slate-400">({cn.note})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Clinical outcome */}
                      <div className="text-slate-600 pt-1 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Clinical Recommendation:</strong>{' '}
                          {r.match.recommended_specialist.specialist_type} (
                          {r.match.recommended_specialist.urgency.toUpperCase()})
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Duration: {r.extraction.durationMs}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unit Tests Tab */}
        {activeTab === 'unit_tests' && (
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-50 pb-4">
              <div>
                <h2 className="text-lg font-bold text-purple-950">
                  Unit Test Suite (Deterministic Engine Audit)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated test cases covering English, conversational Hindi, Kannada, Red-Flag
                  escalation, Thyroid differentials, and non-hormonal illness.
                </p>
              </div>
              <button
                onClick={handleExecuteAllTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Running tests...' : 'Re-run All Tests'}</span>
              </button>
            </div>

            {testResults && (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between text-sm font-semibold ${
                    testResults.allPassed
                      ? 'bg-teal-50 border-teal-200 text-teal-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResults.allPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-teal-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    )}
                    <span>
                      {testResults.allPassed
                        ? 'All Unit Test Cases Passed Successfully'
                        : 'Some tests failed'}
                    </span>
                  </div>
                  <span className="text-xs font-bold uppercase bg-white/80 px-2.5 py-1 rounded-lg">
                    {testResults.results.filter((r) => r.passed).length} /{' '}
                    {testResults.results.length} Passed
                  </span>
                </div>

                <div className="space-y-3">
                  {testResults.results.map((res) => (
                    <div
                      key={res.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{res.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                            res.passed
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {res.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-1">
                        <div>
                          <strong>Red Flag:</strong>{' '}
                          {res.actual.is_red_flag ? 'YES (Urgent)' : 'No'}
                        </div>
                        <div>
                          <strong>Unrelated:</strong>{' '}
                          {res.actual.is_unrelated ? 'YES (Redirect)' : 'No'}
                        </div>
                        <div>
                          <strong>Rotterdam Touched:</strong> {res.actual.categories_touched}
                        </div>
                        <div>
                          <strong>Urgency:</strong> {res.actual.urgency}
                        </div>
                      </div>
                      <div className="text-slate-500 pt-1 border-t border-slate-200/60">
                        <strong>Outcome:</strong> {res.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Database Collections Tab */}
        {activeTab === 'database' && (
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-xs space-y-6">
            <div className="border-b border-purple-50 pb-3">
              <h2 className="text-lg font-bold text-purple-950 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-700" />
                MongoDB Document Collections (/data folder)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Each collection mirrors production MongoDB schemas and is queried via{' '}
                <code>src/db.ts</code> driver functions.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
                <div className="text-2xl font-bold text-purple-900">
                  {dbStats.conditions.length}
                </div>
                <div className="text-xs text-purple-700 font-medium">conditions</div>
              </div>
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100 text-center">
                <div className="text-2xl font-bold text-teal-900">{dbStats.symptoms.length}</div>
                <div className="text-xs text-teal-700 font-medium">symptoms (multi-lingual)</div>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
                <div className="text-2xl font-bold text-rose-900">{dbStats.redFlagsCount}</div>
                <div className="text-xs text-rose-700 font-medium">red_flags</div>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                <div className="text-2xl font-bold text-indigo-900">
                  {dbStats.carePathwaysCount}
                </div>
                <div className="text-xs text-indigo-700 font-medium">care_pathways</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center">
                <div className="text-2xl font-bold text-slate-800">{dbStats.sessionsCount}</div>
                <div className="text-xs text-slate-600 font-medium">sessions logged</div>
              </div>
            </div>

            {/* Symptoms Knowledge Base Preview */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-900">
                Multi-lingual Symptoms Synonyms Sample ({dbStats.symptoms.length} items loaded):
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2.5">Key</th>
                      <th className="p-2.5">English</th>
                      <th className="p-2.5">Hindi Colloquial (हिन्दी)</th>
                      <th className="p-2.5">Kannada Colloquial (ಕನ್ನಡ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {dbStats.symptoms.slice(0, 6).map((symp) => (
                      <tr key={symp._id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-[11px] text-purple-800 font-semibold">
                          {symp.key}
                        </td>
                        <td className="p-2.5 text-slate-800">{symp.label_en}</td>
                        <td className="p-2.5 text-slate-600">{symp.synonyms.hi.slice(0, 2).join(', ')}</td>
                        <td className="p-2.5 text-slate-600">{symp.synonyms.kn.slice(0, 2).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Driver API Functions Demonstration */}
            <div className="pt-4 border-t border-purple-100 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-700" />
                  MongoDB Driver Module: <code>src/db.ts</code> Functions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All data queries route strictly through these async functions. Click each button below to execute the live driver call and inspect the MongoDB-shaped output document:
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleInspectFindSymptoms}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Play className="w-3 h-3 fill-purple-700 text-purple-700" />
                  <span>Execute findSymptoms({'{'} category: "androgenic" {'}'})</span>
                </button>
                <button
                  onClick={handleInspectGetCarePathway}
                  className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Play className="w-3 h-3 fill-teal-700 text-teal-700" />
                  <span>Execute getCarePathway("pathway_pcos")</span>
                </button>
                <button
                  onClick={handleInspectSaveSession}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Play className="w-3 h-3 fill-indigo-700 text-indigo-700" />
                  <span>Execute saveSession(sessionData)</span>
                </button>
              </div>

              {dbInspectionOutput && (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-2 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-purple-300 font-semibold">
                      {dbInspectionOutput.title}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {dbInspectionOutput.funcSignature}
                    </span>
                  </div>
                  <pre className="max-h-60 overflow-y-auto font-mono text-[11px] text-teal-300 p-2 bg-black/40 rounded-lg">
                    {JSON.stringify(dbInspectionOutput.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-100 bg-white py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>SakhiCheck</strong> — Built with Rotterdam Diagnostic Guidelines & Multi-lingual Health Informatics.
          </span>
          <span className="text-slate-400">
            Phase 2 Hybrid Engine Active (Gemini 3.8 Flash + Fuse.js)
          </span>
        </div>
      </footer>
    </div>
  );
}
