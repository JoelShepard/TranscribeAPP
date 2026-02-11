import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { AudioProcessor } from './AudioProcessor';

type MockAudioOutcome =
  | { type: 'metadata'; duration: number }
  | { type: 'error' };

class MockAudio {
  static nextOutcome: MockAudioOutcome = { type: 'metadata', duration: 1 };

  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  duration = 0;
  preload = '';

  set src(_value: string) {
    const outcome = MockAudio.nextOutcome;
    queueMicrotask(() => {
      if (outcome.type === 'metadata') {
        this.duration = outcome.duration;
        this.onloadedmetadata?.();
        return;
      }
      this.onerror?.();
    });
  }
}

const originalAudio = globalThis.Audio;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let createdUrls: string[] = [];
let revokedUrls: string[] = [];

describe('AudioProcessor.getAudioDuration', () => {
  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];

    globalThis.Audio = MockAudio as unknown as typeof Audio;
    URL.createObjectURL = () => {
      const url = `blob:mock-${createdUrls.length}`;
      createdUrls.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };
  });

  afterEach(() => {
    globalThis.Audio = originalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('returns duration when metadata loads successfully', async () => {
    MockAudio.nextOutcome = { type: 'metadata', duration: 12.5 };
    const processor = new AudioProcessor();
    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });

    const duration = await processor.getAudioDuration(file);

    expect(duration).toBe(12.5);
    expect(createdUrls.length).toBe(1);
    expect(revokedUrls).toEqual(createdUrls);
  });

  it('rejects when metadata duration is invalid', async () => {
    MockAudio.nextOutcome = { type: 'metadata', duration: 0 };
    const processor = new AudioProcessor();
    const file = new File(['audio'], 'invalid.wav', { type: 'audio/wav' });

    await expect(processor.getAudioDuration(file)).rejects.toThrow('Unable to read audio duration.');
    expect(revokedUrls).toEqual(createdUrls);
  });

  it('rejects when audio metadata cannot be loaded', async () => {
    MockAudio.nextOutcome = { type: 'error' };
    const processor = new AudioProcessor();
    const file = new File(['audio'], 'broken.wav', { type: 'audio/wav' });

    await expect(processor.getAudioDuration(file)).rejects.toThrow('Unable to read audio metadata.');
    expect(revokedUrls).toEqual(createdUrls);
  });
});

function createMockAudioBuffer(samples: Float32Array, sampleRate: number) {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
}

describe('AudioProcessor.splitAudio', () => {
  it('splits long audio into overlapping chunks', async () => {
    const processor = new AudioProcessor() as any;
    const sampleRate = 10;
    const samples = Float32Array.from({ length: 50 }, (_, i) => i / 50);
    const normalizedBuffer = createMockAudioBuffer(samples, sampleRate);

    processor.decodeToAudioBuffer = async () => normalizedBuffer;
    processor.resampleToMono16k = async () => normalizedBuffer;

    const file = new File(['audio'], 'long.wav', { type: 'audio/wav' });
    const chunks = await processor.splitAudio(file, 2, 0.5);

    expect(chunks.length).toBe(3);
    expect(chunks[0]?.size).toBe(44 + (20 * 2));
    expect(chunks[1]?.size).toBe(44 + (25 * 2));
    expect(chunks[2]?.size).toBe(44 + (15 * 2));
  });

  it('returns a single chunk for short audio', async () => {
    const processor = new AudioProcessor() as any;
    const sampleRate = 10;
    const samples = Float32Array.from({ length: 8 }, (_, i) => i / 8);
    const normalizedBuffer = createMockAudioBuffer(samples, sampleRate);

    processor.decodeToAudioBuffer = async () => normalizedBuffer;
    processor.resampleToMono16k = async () => normalizedBuffer;

    const file = new File(['audio'], 'short.wav', { type: 'audio/wav' });
    const chunks = await processor.splitAudio(file, 2, 0.5);

    expect(chunks.length).toBe(1);
    expect(chunks[0]?.size).toBe(44 + (8 * 2));
  });
});

describe('AudioProcessor.normalizeAudio', () => {
  it('returns a mono wav blob with expected format metadata', async () => {
    const processor = new AudioProcessor() as any;
    const samples = new Float32Array([0, 0.5, -0.5, 1]);
    const normalizedBuffer = createMockAudioBuffer(samples, 16000);

    processor.decodeToAudioBuffer = async () => normalizedBuffer;
    processor.resampleToMono16k = async () => normalizedBuffer;

    const file = new File(['audio'], 'normalize.wav', { type: 'audio/wav' });
    const blob = await processor.normalizeAudio(file);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + (samples.length * 2));
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it('clamps sample values when encoding wav data', async () => {
    const processor = new AudioProcessor() as any;
    const samples = new Float32Array([2, -2, 0.25]);
    const normalizedBuffer = createMockAudioBuffer(samples, 16000);

    processor.decodeToAudioBuffer = async () => normalizedBuffer;
    processor.resampleToMono16k = async () => normalizedBuffer;

    const file = new File(['audio'], 'clamp.wav', { type: 'audio/wav' });
    const blob = await processor.normalizeAudio(file);
    const view = new DataView(await blob.arrayBuffer());

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(8191);
  });
});
