import React, { useState, useRef, useEffect } from "react";
import {
  Languages,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  DeepLClient,
  DeepLError,
  FORMALITY_SUPPORTED_LANGS,
  type DeepLFormality,
  type DeepLModelType,
  type DeepLPlan,
  type DeepLSplitSentences,
  type DeepLTranslation,
  type DeepLUsage,
} from "../services/deepl/deepLClient";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Language lists
// ---------------------------------------------------------------------------

export const DEEPL_SOURCE_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "", name: "Auto-detect" },
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN", name: "English" },
  { code: "ES", name: "Spanish" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian (Bokmål)" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT", name: "Portuguese" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "ZH", name: "Chinese" },
];

export const DEEPL_TARGET_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN-GB", name: "English (British)" },
  { code: "EN-US", name: "English (American)" },
  { code: "ES", name: "Spanish" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian (Bokmål)" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT-BR", name: "Portuguese (Brazilian)" },
  { code: "PT-PT", name: "Portuguese (European)" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "ZH-HANS", name: "Chinese (Simplified)" },
  { code: "ZH-HANT", name: "Chinese (Traditional)" },
];

// Soft warning threshold: 90% of 500 000 free-tier chars/month
const FREE_TIER_LIMIT = 500_000;
const QUOTA_WARN_RATIO = 0.9;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TranslationCardProps {
  apiKey: string;
  plan: DeepLPlan;
  initialText?: string;
  defaultTargetLang?: string;
  usage?: DeepLUsage | null;
  onTranslateComplete?: (translation: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationCard({
  apiKey,
  plan,
  initialText = "",
  defaultTargetLang = "EN-US",
  usage,
  onTranslateComplete,
}: TranslationCardProps) {
  const [sourceText, setSourceText] = useState(initialText);
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options
  const [formality, setFormality] = useState<DeepLFormality>("default");
  const [modelType, setModelType] = useState<DeepLModelType>(
    "quality_optimized",
  );
  const [preserveFormatting, setPreserveFormatting] = useState(false);
  const [splitSentences, setSplitSentences] =
    useState<DeepLSplitSentences>("1");

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initialText when parent pushes transcript text into the card
  useEffect(() => {
    if (initialText) {
      setSourceText(initialText);
      setTranslatedText("");
      setDetectedLang("");
      setError("");
    }
  }, [initialText]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const formalitySupported = FORMALITY_SUPPORTED_LANGS.has(
    targetLang.split("-")[0] ?? "",
  );

  const charCount = sourceText.length;

  // Quota warning (soft, non-blocking)
  const quotaWarning =
    usage &&
    usage.character_count / usage.character_limit >= QUOTA_WARN_RATIO
      ? `Warning: ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} characters used this billing period.`
      : null;

  const freeTierWarning =
    !usage && charCount >= FREE_TIER_LIMIT * QUOTA_WARN_RATIO
      ? `You are approaching the typical DeepL free-tier limit (500 000 chars/month).`
      : null;

  const translate = async () => {
    if (!apiKey) {
      setError("DeepL API key is not configured. Add it in Settings.");
      return;
    }
    if (!sourceText.trim()) {
      setError("Please enter some text to translate.");
      return;
    }

    setError("");
    setIsTranslating(true);
    setTranslatedText("");
    setDetectedLang("");

    try {
      const client = new DeepLClient(apiKey, plan);
      const results: DeepLTranslation[] = await client.translateText(
        [sourceText],
        targetLang,
        {
          sourceLang: sourceLang || undefined,
          formality: formalitySupported ? formality : undefined,
          modelType,
          preserveFormatting,
          splitSentences,
        },
      );

      const result = results[0];
      if (result) {
        setTranslatedText(result.text);
        setDetectedLang(result.detectedSourceLanguage);
        onTranslateComplete?.(result.text);
      }
    } catch (err: unknown) {
      console.error("[TranslationCard] Translation failed:", err);
      if (err instanceof DeepLError) {
        setError(err.message);
      } else {
        setError("Translation failed. Please try again.");
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      setIsCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
    } catch {
      console.error("[TranslationCard] Clipboard copy failed");
    }
  };

  return (
    <div
      id="translation-card"
      className="bg-surface-container rounded-[30px] shadow-[0_8px_24px_rgba(27,34,57,0.10)] border border-outline/30 overflow-hidden"
    >
      {/* Card header */}
      <div className="bg-surface-container-high px-6 py-4 border-b border-outline/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
          <Languages className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-on-surface">
          DeepL Translation
        </h3>
      </div>

      <div className="p-6 space-y-5">
        {/* Quota warning banner */}
        {(quotaWarning || freeTierWarning) && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{quotaWarning ?? freeTierWarning}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-error-container text-on-error-container px-4 py-3 rounded-2xl text-sm border border-red-300/40">
            {error}
          </div>
        )}

        {/* Language selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          {/* Source language */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Source
            </label>
            <div className="relative group">
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full p-3 pr-10 rounded-2xl border border-outline/40 bg-surface text-on-surface focus:ring-2 focus:ring-primary/50 outline-none text-sm appearance-none transition-all cursor-pointer"
              >
                {DEEPL_SOURCE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-surface text-on-surface">
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform" />
            </div>
            {detectedLang && sourceLang === "" && (
              <p className="text-xs text-on-surface-variant pl-1">
                Detected:{" "}
                <span className="font-semibold text-primary">
                  {detectedLang}
                </span>
              </p>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="hidden sm:block w-5 h-5 text-on-surface-variant self-end mb-3 mx-auto" />

          {/* Target language */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Target
            </label>
            <div className="relative group">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full p-3 pr-10 rounded-2xl border border-outline/40 bg-surface text-on-surface focus:ring-2 focus:ring-primary/50 outline-none text-sm appearance-none transition-all cursor-pointer"
              >
                {DEEPL_TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-surface text-on-surface">
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform" />
            </div>
          </div>
        </div>

        {/* Source text input */}
        <div className="relative">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            rows={5}
            className="w-full p-4 rounded-2xl border border-outline/40 bg-surface text-on-surface focus:ring-2 focus:ring-primary/50 outline-none resize-none text-sm leading-relaxed"
          />
          <span className="absolute bottom-3 right-4 text-xs text-on-surface-variant select-none">
            {charCount.toLocaleString()} chars
          </span>
        </div>

        {/* Advanced options toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          Advanced options
        </button>

        {/* Advanced options panel */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline/20">
            {/* Formality */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Formality
              </label>
              <div className="relative group">
                <select
                  value={formality}
                  onChange={(e) => setFormality(e.target.value as DeepLFormality)}
                  disabled={!formalitySupported}
                  className={cn(
                    "w-full p-2.5 pr-9 rounded-xl border border-outline/40 bg-surface text-on-surface outline-none text-sm appearance-none cursor-pointer transition-all",
                    !formalitySupported && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <option value="default" className="bg-surface">Default</option>
                  <option value="more" className="bg-surface">More formal</option>
                  <option value="less" className="bg-surface">Less formal</option>
                  <option value="prefer_more" className="bg-surface">Prefer more formal</option>
                  <option value="prefer_less" className="bg-surface">Prefer less formal</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform" />
              </div>
              {!formalitySupported && (
                <p className="text-xs text-on-surface-variant pl-0.5 mt-0.5">
                  Not available for target language
                </p>
              )}
            </div>

            {/* Model type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Model
              </label>
              <div className="relative group">
                <select
                  value={modelType}
                  onChange={(e) =>
                    setModelType(e.target.value as DeepLModelType)
                  }
                  className="w-full p-2.5 pr-9 rounded-xl border border-outline/40 bg-surface text-on-surface outline-none text-sm appearance-none cursor-pointer transition-all"
                >
                  <option value="quality_optimized" className="bg-surface">Quality optimized</option>
                  <option value="prefer_quality_optimized" className="bg-surface">
                    Prefer quality optimized
                  </option>
                  <option value="latency_optimized" className="bg-surface">Latency optimized</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform" />
              </div>
            </div>

            {/* Split sentences */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Split sentences
              </label>
              <div className="relative group">
                <select
                  value={splitSentences}
                  onChange={(e) =>
                    setSplitSentences(e.target.value as DeepLSplitSentences)
                  }
                  className="w-full p-2.5 pr-9 rounded-xl border border-outline/40 bg-surface text-on-surface outline-none text-sm appearance-none cursor-pointer transition-all"
                >
                  <option value="0" className="bg-surface">No splitting</option>
                  <option value="1" className="bg-surface">Split on punctuation (default)</option>
                  <option value="nonewlines" className="bg-surface">
                    Split on punctuation, not newlines
                  </option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none group-focus-within:rotate-180 transition-transform" />
              </div>
            </div>

            {/* Preserve formatting */}
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
                Preserve formatting
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={preserveFormatting}
                    onChange={(e) => setPreserveFormatting(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/40 bg-surface accent-primary cursor-pointer transition-all"
                  />
                </div>
                <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                  Keep original formatting
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Translate button */}
        <button
          onClick={() => void translate()}
          disabled={isTranslating || !sourceText.trim()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-2xl font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Translating…
            </>
          ) : (
            <>
              <Languages className="w-4 h-4" />
              Translate
            </>
          )}
        </button>

        {/* Output */}
        {translatedText && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                Translation
              </label>
              <button
                onClick={() => void copyResult()}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors",
                  isCopied
                    ? "text-primary bg-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-highest",
                )}
                aria-label={isCopied ? "Copied" : "Copy translation"}
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {isCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              rows={5}
              value={translatedText}
              className="w-full p-4 rounded-2xl border border-outline/20 bg-surface text-on-surface outline-none resize-none text-sm leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
