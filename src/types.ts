export interface ZipFileEntry {
  path: string;
  relativePath: string;
  size: number;
  isBinary: boolean;
  sha256?: string;
  content?: string;
  base64?: string;
}

export interface ParsedAiFile {
  relativePath: string;
  content: string;
  size: number;
  isSensitive: boolean;
  language?: string;
  isAutoClosed?: boolean;
}

export type ActivePage = 'export' | 'import' | 'audit' | 'help';

export interface ExportOptions {
  includeBinary: boolean;
  filterIgnoredFolders: boolean;
  ignoredFolders: string[];
}

export interface ProcessStatus {
  message: string;
  progress: number; // 0 to 100
  isProcessing: boolean;
  error?: string;
}
