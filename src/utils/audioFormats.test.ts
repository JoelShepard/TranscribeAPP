import { describe, expect, it } from "bun:test";
import {
  AUDIO_FILE_INPUT_ACCEPT,
  isSupportedAudioFile,
  SUPPORTED_AUDIO_FORMATS_LABEL,
} from "./audioFormats";

describe("isSupportedAudioFile", () => {
  it("accepts known mime types", () => {
    const file = new File(["audio"], "voice.bin", { type: "audio/mpeg" });

    expect(isSupportedAudioFile(file)).toBe(true);
  });

  it("accepts known extensions even when mime type is empty", () => {
    const file = new File(["audio"], "meeting.WAV", { type: "" });

    expect(isSupportedAudioFile(file)).toBe(true);
  });

  it("rejects unsupported audio formats", () => {
    const file = new File(["audio"], "music.flac", { type: "audio/flac" });

    expect(isSupportedAudioFile(file)).toBe(false);
  });
});

describe("audio format metadata", () => {
  it("exposes all supported format labels for UI copy", () => {
    expect(SUPPORTED_AUDIO_FORMATS_LABEL).toBe("WAV, MP3, M4A, OGG");
  });

  it("exports explicit file input accept value", () => {
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain(".wav");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain(".mp3");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain(".m4a");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain(".ogg");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain("audio/wav");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain("audio/mpeg");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain("audio/mp4");
    expect(AUDIO_FILE_INPUT_ACCEPT).toContain("audio/ogg");
  });
});
