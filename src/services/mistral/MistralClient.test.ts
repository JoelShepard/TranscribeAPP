import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { MistralClient } from './MistralClient';

const originalFetch = globalThis.fetch;

describe('MistralClient', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends transcription request with auth and returns text', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ text: 'transcribed text' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const client = new MistralClient('secret-key');
    const result = await client.transcribe(new Blob(['audio-bytes'], { type: 'audio/wav' }));

    expect(result).toBe('transcribed text');
    expect(capturedUrl).toBe('https://api.mistral.ai/v1/audio/transcriptions');
    expect(capturedInit?.method).toBe('POST');
    expect((capturedInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer secret-key');
    expect(capturedInit?.body).toBeInstanceOf(FormData);

    const body = capturedInit?.body as FormData;
    expect(body.get('model')).toBe('voxtral-mini-latest');
    expect(body.get('language')).toBeNull();
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('uses API error message from JSON response when available', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
      });
    }) as unknown as typeof fetch;

    const client = new MistralClient('bad-key');
    await expect(client.transcribe(new Blob(['audio']))).rejects.toThrow('Invalid API key');
  });

  it('falls back to HTTP status + body for non-JSON error', async () => {
    globalThis.fetch = (async () => {
      return new Response('gateway timeout', { status: 504 });
    }) as unknown as typeof fetch;

    const client = new MistralClient('key');
    await expect(client.transcribe(new Blob(['audio']))).rejects.toThrow('HTTP 504: gateway timeout');
  });

  it('uses custom model when provided', async () => {
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ text: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const client = new MistralClient('key', 'mistral-small');
    await client.transcribe(new Blob(['audio-bytes'], { type: 'audio/wav' }));

    const body = capturedInit?.body as FormData;
    expect(body.get('model')).toBe('mistral-small');
    expect(body.get('language')).toBeNull();
  });

  it('adds source language when provided', async () => {
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ text: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const client = new MistralClient('key', 'voxtral-mini-latest', '  it  ');
    await client.transcribe(new Blob(['audio-bytes'], { type: 'audio/wav' }));

    const body = capturedInit?.body as FormData;
    expect(body.get('language')).toBe('it');
  });
});
