import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DeepLClient, DeepLError } from "./deepLClient";

const originalFetch = globalThis.fetch;

describe("DeepLClient", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── translateText ─────────────────────────────────────────────────────────

  describe("translateText", () => {
    it("sends translation request and returns translated text (happy path)", async () => {
      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = (async (
        url: string | URL | Request,
        init?: RequestInit,
      ) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(
          JSON.stringify({
            translations: [
              { detected_source_language: "IT", text: "Hello world" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;

      const client = new DeepLClient("secret-key", "free");
      const results = await client.translateText(["Ciao mondo"], "EN-US");

      expect(results).toHaveLength(1);
      expect(results[0]!.text).toBe("Hello world");
      expect(results[0]!.detectedSourceLanguage).toBe("IT");

      // Uses free endpoint
      expect(capturedUrl).toBe(
        "https://api-free.deepl.com/v2/translate",
      );
      expect(capturedInit?.method).toBe("POST");
      expect(
        (capturedInit?.headers as Record<string, string>)?.Authorization,
      ).toBe("DeepL-Auth-Key secret-key");

      const body = JSON.parse(capturedInit?.body as string);
      expect(body.text).toEqual(["Ciao mondo"]);
      expect(body.target_lang).toBe("EN-US");
    });

    it("uses pro endpoint when plan is 'pro'", async () => {
      let capturedUrl = "";

      globalThis.fetch = (async (url: string | URL | Request) => {
        capturedUrl = String(url);
        return new Response(
          JSON.stringify({
            translations: [
              { detected_source_language: "EN", text: "Bonjour" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;

      const client = new DeepLClient("pro-key", "pro");
      await client.translateText(["Hello"], "FR");

      expect(capturedUrl).toBe("https://api.deepl.com/v2/translate");
    });

    it("passes optional parameters to the request body", async () => {
      let capturedBody: Record<string, unknown> = {};

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            translations: [{ detected_source_language: "EN", text: "Hola" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;

      const client = new DeepLClient("key", "free");
      await client.translateText(["Hello"], "ES", {
        sourceLang: "EN",
        formality: "more",
        modelType: "latency_optimized",
        preserveFormatting: true,
        splitSentences: "0",
      });

      expect(capturedBody.source_lang).toBe("EN");
      expect(capturedBody.formality).toBe("more");
      expect(capturedBody.model_type).toBe("latency_optimized");
      expect(capturedBody.preserve_formatting).toBe(true);
      expect(capturedBody.split_sentences).toBe("0");
    });

    it("throws DeepLError with auth message on 403", async () => {
      globalThis.fetch = (async () => {
        return new Response("Forbidden", { status: 403 });
      }) as unknown as typeof fetch;

      const client = new DeepLClient("bad-key", "free");
      const err = await client
        .translateText(["Hello"], "DE")
        .catch((e) => e);

      expect(err).toBeInstanceOf(DeepLError);
      expect((err as DeepLError).statusCode).toBe(403);
      expect((err as DeepLError).message).toContain("Authentication failed");
    });

    it("throws DeepLError with quota message on 456", async () => {
      globalThis.fetch = (async () => {
        return new Response("Quota exceeded", { status: 456 });
      }) as unknown as typeof fetch;

      const client = new DeepLClient("key", "free");
      const err = await client
        .translateText(["Hello"], "DE")
        .catch((e) => e);

      expect(err).toBeInstanceOf(DeepLError);
      expect((err as DeepLError).statusCode).toBe(456);
      expect((err as DeepLError).message).toContain("Quota exceeded");
    });

    it("throws DeepLError with rate-limit message on 429", async () => {
      globalThis.fetch = (async () => {
        return new Response("Too Many Requests", { status: 429 });
      }) as unknown as typeof fetch;

      const client = new DeepLClient("key", "free");
      const err = await client
        .translateText(["Hello"], "DE")
        .catch((e) => e);

      expect(err).toBeInstanceOf(DeepLError);
      expect((err as DeepLError).statusCode).toBe(429);
      expect((err as DeepLError).message).toContain("Too many requests");
    });

    it("throws DeepLError with unavailable message on 529", async () => {
      globalThis.fetch = (async () => {
        return new Response("Service Unavailable", { status: 529 });
      }) as unknown as typeof fetch;

      const client = new DeepLClient("key", "free");
      const err = await client
        .translateText(["Hello"], "DE")
        .catch((e) => e);

      expect(err).toBeInstanceOf(DeepLError);
      expect((err as DeepLError).statusCode).toBe(529);
      expect((err as DeepLError).message).toContain("temporarily unavailable");
    });
  });

  // ── getUsage ──────────────────────────────────────────────────────────────

  describe("getUsage", () => {
    it("returns usage data on success", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            character_count: 12345,
            character_limit: 500000,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;

      const client = new DeepLClient("key", "free");
      const usage = await client.getUsage();

      expect(usage.character_count).toBe(12345);
      expect(usage.character_limit).toBe(500000);
    });

    it("throws DeepLError on auth failure", async () => {
      globalThis.fetch = (async () => {
        return new Response("Forbidden", { status: 403 });
      }) as unknown as typeof fetch;

      const client = new DeepLClient("bad-key", "free");
      const err = await client.getUsage().catch((e) => e);

      expect(err).toBeInstanceOf(DeepLError);
      expect((err as DeepLError).statusCode).toBe(403);
    });
  });
});
