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
      className="bg-[var(--md-sys-color-surface-container)] rounded-[30px] shadow-[0_8px_24px_rgba(27,34,57,0.10)] border border-[color:var(--md-sys-color-outline)]/30 overflow-hidden"
    >
      {/* Card header */}
      <div className="bg-[var(--md-sys-color-surface-container-high)] px-6 py-4 border-b border-[color:var(--md-sys-color-outline)]/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] flex items-center justify-center">
          <Languages className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-[var(--md-sys-color-on-surface)]">
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
          <div className="bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] px-4 py-3 rounded-2xl text-sm border border-red-300/40">
            {error}
          </div>
        )}

        {/* Language selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          {/* Source language */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
              Source
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full p-3 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none text-sm"
            >
              {DEEPL_SOURCE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            {detectedLang && sourceLang === "" && (
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] pl-1">
                Detected:{" "}
                <span className="font-semibold text-[var(--md-sys-color-primary)]">
                  {detectedLang}
                </span>
              </p>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="hidden sm:block w-5 h-5 text-[var(--md-sys-color-on-surface-variant)] self-end mb-3 mx-auto" />

          {/* Target language */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
              Target
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full p-3 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none text-sm"
            >
              {DEEPL_TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Source text input */}
        <div className="relative">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            rows={5}
            className="w-full p-4 rounded-2xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/50 outline-none resize-none text-sm leading-relaxed"
          />
          <span className="absolute bottom-3 right-4 text-xs text-[var(--md-sys-color-on-surface-variant)] select-none">
            {charCount.toLocaleString()} chars
          </span>
        </div>

        {/* Advanced options toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[color:var(--md-sys-color-outline)]/20">
            {/* Formality */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
                Formality
              </label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as DeepLFormality)}
                disabled={!formalitySupported}
                className={cn(
                  "w-full p-2.5 rounded-xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] outline-none text-sm",
                  !formalitySupported &&
                    "opacity-40 cursor-not-allowed",
                )}
              >
                <option value="default">Default</option>
                <option value="more">More formal</option>
                <option value="less">Less formal</option>
                <option value="prefer_more">Prefer more formal</option>
                <option value="prefer_less">Prefer less formal</option>
              </select>
              {!formalitySupported && (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  Not available for selected language
                </p>
              )}
            </div>

            {/* Model type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
                Model
              </label>
              <select
                value={modelType}
                onChange={(e) =>
                  setModelType(e.target.value as DeepLModelType)
                }
                className="w-full p-2.5 rounded-xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] outline-none text-sm"
              >
                <option value="quality_optimized">Quality optimized</option>
                <option value="prefer_quality_optimized">
                  Prefer quality optimized
                </option>
                <option value="latency_optimized">Latency optimized</option>
              </select>
            </div>

            {/* Split sentences */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
                Split sentences
              </label>
              <select
                value={splitSentences}
                onChange={(e) =>
                  setSplitSentences(e.target.value as DeepLSplitSentences)
                }
                className="w-full p-2.5 rounded-xl border border-[color:var(--md-sys-color-outline)]/40 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] outline-none text-sm"
              >
                <option value="0">No splitting</option>
                <option value="1">Split on punctuation (default)</option>
                <option value="nonewlines">
                  Split on punctuation, not newlines
                </option>
              </select>
            </div>

            {/* Preserve formatting */}
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide mb-1">
                Preserve formatting
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveFormatting}
                  onChange={(e) => setPreserveFormatting(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--md-sys-color-primary)]"
                />
                <span className="text-sm text-[var(--md-sys-color-on-surface)]">
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
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] px-8 py-3 rounded-2xl font-bold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
                Translation
              </label>
              <button
                onClick={() => void copyResult()}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors",
                  isCopied
                    ? "text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]",
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
              className="w-full p-4 rounded-2xl border border-[color:var(--md-sys-color-outline)]/20 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] outline-none resize-none text-sm leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}
