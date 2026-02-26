import { CapacitorHttp } from "@capacitor/core";
import { isTauriRuntime, isCapacitorRuntime } from "../../utils/platform";

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
    const isTauri = isTauriRuntime();
    // Check Tauri first: @capacitor/core sets window.Capacitor even when
    // bundled in a Tauri build, so we must exclude Tauri before testing
    // for Capacitor to avoid routing desktop traffic through CapacitorHttp.
    const isCapacitor = !isTauri && isCapacitorRuntime();

    if (isCapacitor) {
      // Use CapacitorHttp to bypass CORS on Android/iOS
      const url = `${this.baseUrl}${path}`;
      const options = {
        url,
        method: init.method || "GET",
        headers: {
          "Authorization": `DeepL-Auth-Key ${this.apiKey}`,
          ...(init.headers as Record<string, string>),
        },
        data: init.body ? JSON.parse(init.body as string) : undefined,
      };

      try {
        const response = await CapacitorHttp.request(options);
        if (response.status >= 200 && response.status < 300) {
          return response.data as T;
        }
        throw new DeepLError(`HTTP ${response.status}: ${JSON.stringify(response.data)}`, response.status);
      } catch (err: any) {
        if (err instanceof DeepLError) throw err;
        throw new DeepLError(`Capacitor Network Error: ${err.message || "Failed to fetch"}`);
      }
    }

    let url: string;
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    if (isTauri) {
      // DeepL API does not send Access-Control-Allow-Origin headers, so any
      // fetch from the WebKit2GTK webview fails with a CORS error. We route
      // the request through a dedicated Rust command (`deepl_request`) that
      // uses `reqwest` on the Tauri side, completely bypassing the webview.
      url = `${this.baseUrl}${path}`;
      headers["Authorization"] = `DeepL-Auth-Key ${this.apiKey}`;

      const { invoke } = await import("@tauri-apps/api/core");

      let invokeResult: { status: number; body: string };
      try {
        invokeResult = await invoke<{ status: number; body: string }>(
          "deepl_request",
          {
            url,
            method: (init.method ?? "GET").toUpperCase(),
            headers,
            body: (init.body as string | undefined) ?? null,
          },
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DeepLClient] Tauri invoke failed:", err);
        throw new DeepLError(`Network error: ${msg}.`);
      }

      const { status, body } = invokeResult;
      if (status < 200 || status >= 300) {
        let message = `HTTP ${status}`;
        if (status === 400) {
          message = "Bad request — check source/target language codes.";
        } else if (status === 403) {
          message = "Authentication failed — check your DeepL API key.";
        } else if (status === 404) {
          message = "Requested resource not found.";
        } else if (status === 413) {
          message = "Request too large — text exceeds DeepL size limits.";
        } else if (status === 429) {
          message = "Too many requests — please wait before retrying.";
        } else if (status === 456) {
          message = "Quota exceeded — you have used up your character limit.";
        } else if (status === 500) {
          message = "DeepL internal server error.";
        } else if (status === 529) {
          message =
            "DeepL is temporarily unavailable — please try again later.";
        } else if (body) {
          message = `HTTP ${status}: ${body}`;
        }
        throw new DeepLError(message, status);
      }

      return JSON.parse(body) as T;
    }

    // Web browser path — DeepL cannot be reached directly due to CORS, so
    // all requests are proxied through /deepl-proxy/<plan><path>.
    url = `/deepl-proxy/${this.plan}${path}`;
    headers["X-DeepL-Auth-Key"] = this.apiKey;

    const response = await fetch(url, { ...init, headers }).catch((err) => {
      console.error("[DeepLClient] Fetch failed:", err);
      throw new DeepLError(`Network error: ${err.message || "Failed to fetch"}. This might be a CORS issue or network problem.`);
    });

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
