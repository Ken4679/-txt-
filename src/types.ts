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

export type ActivePage = 'dashboard' | 'convert' | 'patch' | 'diff' | 'audit' | 'help' | 'export' | 'import';

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

export interface DiffFile {
  relativePath: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  originalContent?: string;
  newContent: string;
  language?: string;
  isSensitive: boolean;
}

export interface ProjectSummary {
  name: string;
  totalFiles: number;
  textFiles: number;
  binaryFiles: number;
  totalSize: number;
  totalLines: number;
  estimatedTokens: number;
  asciiTree: string;
  txtContent: string;
  entries: ZipFileEntry[];
}
