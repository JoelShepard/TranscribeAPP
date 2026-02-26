export type DeepLPlan = "free" | "pro";

export type DeepLFormality =
  | "default"
  | "more"
  | "less"
  | "prefer_more"
  | "prefer_less";

export type DeepLModelType =
  | "quality_optimized"
  | "latency_optimized"
  | "prefer_quality_optimized";

export type DeepLSplitSentences = "0" | "1" | "nonewlines";

export interface DeepLTranslateOptions {
  sourceLang?: string;
  formality?: DeepLFormality;
  modelType?: DeepLModelType;
  preserveFormatting?: boolean;
  splitSentences?: DeepLSplitSentences;
}

export interface DeepLTranslation {
  detectedSourceLanguage: string;
  text: string;
}

export interface DeepLUsage {
  character_count: number;
  character_limit: number;
}

// Languages that support formality in DeepL API
export const FORMALITY_SUPPORTED_LANGS = new Set([
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "PL",
  "PT",
  "PT-BR",
  "PT-PT",
  "RU",
  "JA",
]);

export class DeepLError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DeepLError";
  }
}

export class DeepLClient {
  private apiKey: string;
  private plan: DeepLPlan;

  constructor(apiKey: string, plan: DeepLPlan = "free") {
    this.apiKey = apiKey;
    this.plan = plan;
  }

  private get baseUrl(): string {
    return this.plan === "pro"
      ? "https://api.deepl.com/v2"
      : "https://api-free.deepl.com/v2";
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      ...(init.headers as Record<string, string>),
    };

    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      let message = `HTTP ${response.status}`;

      if (response.status === 400) {
        message = "Bad request — check source/target language codes.";
      } else if (response.status === 403) {
        message = "Authentication failed — check your DeepL API key.";
      } else if (response.status === 404) {
        message = "Requested resource not found.";
      } else if (response.status === 413) {
        message = "Request too large — text exceeds DeepL size limits.";
      } else if (response.status === 429) {
        message = "Too many requests — please wait before retrying.";
      } else if (response.status === 456) {
        message = "Quota exceeded — you have used up your character limit.";
      } else if (response.status === 500) {
        message = "DeepL internal server error.";
      } else if (response.status === 529) {
        message = "DeepL is temporarily unavailable — please try again later.";
      } else if (bodyText) {
        message = `HTTP ${response.status}: ${bodyText}`;
      }

      throw new DeepLError(message, response.status);
    }

    return response.json() as Promise<T>;
  }

  async translateText(
    texts: string[],
    targetLang: string,
    options: DeepLTranslateOptions = {},
  ): Promise<DeepLTranslation[]> {
    const body: Record<string, unknown> = {
      text: texts,
      target_lang: targetLang,
    };

    if (options.sourceLang) {
      body.source_lang = options.sourceLang;
    }
    if (options.formality) {
      body.formality = options.formality;
    }
    if (options.modelType) {
      body.model_type = options.modelType;
    }
    if (options.preserveFormatting !== undefined) {
      body.preserve_formatting = options.preserveFormatting;
    }
    if (options.splitSentences !== undefined) {
      body.split_sentences = options.splitSentences;
    }

    const result = await this.request<{
      translations: Array<{ detected_source_language: string; text: string }>;
    }>("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return result.translations.map((t) => ({
      detectedSourceLanguage: t.detected_source_language,
      text: t.text,
    }));
  }

  async getUsage(): Promise<DeepLUsage> {
    return this.request<DeepLUsage>("/usage", { method: "GET" });
  }
}
