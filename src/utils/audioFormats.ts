const SUPPORTED_AUDIO_FORMATS = [
  {
    label: 'WAV',
    extension: '.wav',
    mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'],
  },
  {
    label: 'MP3',
    extension: '.mp3',
    mimeTypes: ['audio/mpeg', 'audio/mp3'],
  },
  {
    label: 'M4A',
    extension: '.m4a',
    mimeTypes: ['audio/mp4', 'audio/x-m4a'],
  },
  {
    label: 'OGG',
    extension: '.ogg',
    mimeTypes: ['audio/ogg'],
  },
] as const;

const SUPPORTED_AUDIO_MIME_TYPES: ReadonlySet<string> = new Set(
  SUPPORTED_AUDIO_FORMATS.flatMap((format) => format.mimeTypes),
);
const SUPPORTED_AUDIO_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_AUDIO_FORMATS.map((format) => format.extension),
);

export const SUPPORTED_AUDIO_FORMATS_LABEL = SUPPORTED_AUDIO_FORMATS.map(
  (format) => format.label,
).join(', ');

export const AUDIO_FILE_INPUT_ACCEPT = [
  ...SUPPORTED_AUDIO_EXTENSIONS,
  ...SUPPORTED_AUDIO_MIME_TYPES,
].join(',');

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '';
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

export function isSupportedAudioFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType && SUPPORTED_AUDIO_MIME_TYPES.has(mimeType)) {
    return true;
  }

  const extension = getFileExtension(file.name);
  return SUPPORTED_AUDIO_EXTENSIONS.has(extension);
}
