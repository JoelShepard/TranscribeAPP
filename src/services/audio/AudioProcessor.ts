/// <reference lib="dom" />

type AudioMetadata = {
  duration: number;
};

export class AudioProcessor {
  private audioContext: AudioContext | null = null;

  private getContext() {
    if (!this.audioContext) {
      const AudioContextClass =
        globalThis.AudioContext ||
        (globalThis as any).webkitAudioContext ||
        window.AudioContext ||
        (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }

  private async getAudioMetadata(file: File): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.src = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        cleanup();

        if (Number.isFinite(duration) && duration > 0) {
          resolve({ duration });
          return;
        }

        // Fallback: Try to decode the audio buffer to get the duration
        // This is necessary for some browsers (Firefox/Safari) that produce
        // WebM/Ogg blobs without proper duration headers.
        file
          .arrayBuffer()
          .then((arrayBuffer) => this.getContext().decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            resolve({ duration: audioBuffer.duration });
          })
          .catch(() => {
            reject(new Error("Unable to read audio duration."));
          });
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error("Unable to read audio metadata."));
      };
    });
  }

  async getAudioDuration(file: File): Promise<number> {
    const metadata = await this.getAudioMetadata(file);
    return metadata.duration;
  }

  private async decodeToAudioBuffer(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const context = this.getContext();
    return await context.decodeAudioData(arrayBuffer);
  }

  private mixToMono(buffer: AudioBuffer): AudioBuffer {
    if (buffer.numberOfChannels === 1) {
      return buffer;
    }

    const context = this.getContext();
    const monoBuffer = context.createBuffer(
      1,
      buffer.length,
      buffer.sampleRate,
    );
    const monoData = monoBuffer.getChannelData(0);
    const channelCount = buffer.numberOfChannels;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
      const channelData = buffer.getChannelData(channelIndex);
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i] ?? 0;
        const current = monoData[i] ?? 0;
        monoData[i] = current + sample / channelCount;
      }
    }

    return monoBuffer;
  }

  private async resampleToMono16k(buffer: AudioBuffer): Promise<AudioBuffer> {
    const monoBuffer = this.mixToMono(buffer);
    const targetSampleRate = 16000;

    if (monoBuffer.sampleRate === targetSampleRate) {
      return monoBuffer;
    }

    const targetLength = Math.ceil(monoBuffer.duration * targetSampleRate);
    const offlineContext = new OfflineAudioContext(
      1,
      targetLength,
      targetSampleRate,
    );
    const source = offlineContext.createBufferSource();
    source.buffer = monoBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    return await offlineContext.startRendering();
  }

  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += bytesPerSample;
    }

    return buffer;
  }

  private createWavBlob(samples: Float32Array, sampleRate: number): Blob {
    const wavBuffer = this.encodeWav(samples, sampleRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  async normalizeAudio(file: File): Promise<Blob> {
    const decoded = await this.decodeToAudioBuffer(file);
    const normalized = await this.resampleToMono16k(decoded);
    const samples = normalized.getChannelData(0);

    return this.createWavBlob(samples, normalized.sampleRate);
  }

  async splitAudio(
    file: File,
    segmentDuration: number = 900,
    overlap: number = 3,
  ): Promise<Blob[]> {
    const decoded = await this.decodeToAudioBuffer(file);
    const normalized = await this.resampleToMono16k(decoded);
    const sampleRate = normalized.sampleRate;
    const samples = normalized.getChannelData(0);

    const segmentSamples = Math.floor(segmentDuration * sampleRate);
    const overlapSamples = Math.floor(overlap * sampleRate);
    const chunks: Blob[] = [];

    let index = 0;
    while (index * segmentSamples < samples.length) {
      let chunkStart = index * segmentSamples;
      if (index > 0) {
        chunkStart -= overlapSamples;
      }

      let chunkLength = segmentSamples + (index > 0 ? overlapSamples : 0);
      if (chunkStart + chunkLength > samples.length) {
        chunkLength = samples.length - chunkStart;
      }

      if (chunkLength <= 0) {
        break;
      }

      const chunkSamples = samples.subarray(
        chunkStart,
        chunkStart + chunkLength,
      );
      chunks.push(this.createWavBlob(chunkSamples, sampleRate));

      if (chunkStart + chunkLength >= samples.length) {
        break;
      }

      index++;
    }

    return chunks;
  }
}

export const audioProcessor = new AudioProcessor();
