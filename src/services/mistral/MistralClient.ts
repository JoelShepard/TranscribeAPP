import { CapacitorHttp } from "@capacitor/core";
import { isCapacitorRuntime } from "../../utils/platform";

export class MistralClient {
  private apiKey: string;
  private baseUrl = "https://api.mistral.ai/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(url: string, init: RequestInit = {}): Promise<any> {
    if (isCapacitorRuntime()) {
      const options = {
        url,
        method: init.method || "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          ...(init.headers as Record<string, string>),
        },
        data: init.body instanceof FormData ? undefined : (init.body ? JSON.parse(init.body as string) : undefined),
      };
      
      // Note: FormData is handled differently in Capacitor native bridge.
      // For transcription, we'll stick to standard fetch which Capacitor patches if possible,
      // or we'd need a specialized multi-part implementation.
      if (init.body instanceof FormData) {
          // Fallback to standard fetch for FormData
          return fetch(url, { ...init, headers: { "Authorization": `Bearer ${this.apiKey}`, ...init.headers } });
      }

      const response = await CapacitorHttp.request(options);
      return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          text: async () => JSON.stringify(response.data),
          json: async () => response.data,
      };
    }

    return fetch(url, {
      ...init,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        ...init.headers,
      },
    });
  }

  async validateApiKey(): Promise<void> {
    const response = await this.request(`${this.baseUrl}/models`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${errorText}`;
      try {
        const json = JSON.parse(errorText);
        if (json.error && json.error.message) {
          errorMessage = json.error.message;
        }
      } catch {
        // Ignore parse errors.
      }

      throw new Error(errorMessage);
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    console.log(
      "[MistralClient] Starting transcription, blob size:",
      audioBlob.size,
    );

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "voxtral-mini-latest");

    console.log("[MistralClient] Sending request to Mistral API...");
    
    // For transcription we use the standard fetch because of FormData complexity
    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    console.log("[MistralClient] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MistralClient] Error response:", errorText);
      let errorMessage = `HTTP ${response.status}: ${errorText}`;
      try {
        const json = JSON.parse(errorText);
        if (json.error && json.error.message) {
          errorMessage = json.error.message;
        }
      } catch {
        /* ignore */
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("[MistralClient] Transcription successful, result:", result);
    return result.text;
  }
}
