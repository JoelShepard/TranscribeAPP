export class MistralClient {
  private apiKey: string;
  private model: string;
  private sourceLanguage?: string;
  private baseUrl = "https://api.mistral.ai/v1";

  constructor(
    apiKey: string,
    model: string = "voxtral-mini-latest",
    sourceLanguage?: string,
  ) {
    this.apiKey = apiKey;
    this.model = model;
    const normalizedSourceLanguage = sourceLanguage?.trim();
    this.sourceLanguage =
      normalizedSourceLanguage && normalizedSourceLanguage.length > 0
        ? normalizedSourceLanguage
        : undefined;
  }

  async validateApiKey(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
      },
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
    formData.append("model", this.model);
    if (this.sourceLanguage) {
      formData.append("language", this.sourceLanguage);
    }

    console.log("[MistralClient] Sending request to Mistral API...");
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
