import { describe, expect, it } from "bun:test";
import { isSupportedAudioFile } from "../utils/audioFormats";
import { sharedFileEventToFile } from "./useSharedFile";

describe("useSharedFile - base64 decoding logic", () => {
  it("correctly decodes base64 content to bytes", () => {
    const originalContent = "test-audio-binary-data";
    const base64Content = btoa(originalContent);

    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decodedContent = new TextDecoder().decode(bytes);
    expect(decodedContent).toBe(originalContent);
  });

  it("creates File object with correct metadata", () => {
    const fileName = "shared_audio.opus";
    const mimeType = "audio/opus";
    const file = sharedFileEventToFile({
      fileName,
      mimeType,
      content: btoa("audio-data"),
    });

    expect(file.name).toBe(fileName);
    expect(file.type).toBe(mimeType);
    expect(file.size).toBe("audio-data".length);
  });

  it("accepts octet-stream payloads when the shared filename has a supported extension", () => {
    const file = sharedFileEventToFile({
      fileName: "voice-note.opus",
      mimeType: "application/octet-stream",
      content: btoa("audio-data"),
    });

    expect(isSupportedAudioFile(file)).toBe(true);
  });
});
