import {
  SENSITIVE_DIR_NAMES,
  SENSITIVE_FILE_NAMES,
  WINDOWS_RESERVED_NAMES,
  IGNORED_METADATA_FILES,
} from './constants';

export function humanSize(value: number): string {
  let size = Number(value);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (size < 1024 || i === units.length - 1) {
      return unit === 'B' ? `${Math.floor(size)} B` : `${size.toFixed(1)} ${unit}`;
    }
    size /= 1024;
  }
  return `${size.toFixed(1)} PB`;
}

/**
 * Sanitizes and normalizes file paths to prevent directory traversal (Zip Slip),
 * Unicode Trojan Source attacks, Windows reserved device names, and null-byte injection.
 */
export function normalizeAiPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new Error('文件路径不能为空');
  }

  // 1. Remove dangerous zero-width, bidi override, control and null characters
  let path = rawPath
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();

  // 2. Iteratively decode multi-level URL encoded traversal attempts (e.g. %252e%252e, %2e%2e, %2f, %5c)
  let decoded = path;
  for (let i = 0; i < 3; i++) {
    if (/%[0-9a-fA-F]{2}/.test(decoded)) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  path = decoded;

  // 3. Normalize backslashes to forward slashes & trim markdown code markers / quotes / brackets
  path = path
    .replace(/\\/g, '/')
    .replace(/^[`"'\s*#\[\(]+|[`"'\s*#\]\)]+$/g, '')
    .trim();

  if (!path) {
    throw new Error(`非法空文件路径: ${JSON.stringify(rawPath)}`);
  }

  // Disallow UNC network shares and drive letters (C:, D:, //server/...)
  if (/^[A-Za-z]:/.test(path) || path.startsWith('//')) {
    throw new Error(`必须使用仓库相对路径，禁止绝对路径与网络共享路径: ${rawPath}`);
  }

  // 4. Remove leading slashes and relative './' or '.\\' prefixes
  path = path.replace(/^\/+/, '');
  while (path.startsWith('./')) {
    path = path.slice(2).replace(/^\/+/, '');
  }

  if (!path) {
    throw new Error(`非法空文件路径: ${JSON.stringify(rawPath)}`);
  }

  // 5. Strict path traversal parts (Zip Slip defense)
  const rawParts = path.split('/');
  const parts: string[] = [];

  for (const part of rawParts) {
    const trimmedPart = part.trim();
    if (!trimmedPart || trimmedPart === '.') {
      continue;
    }
    // Prevent Zip Slip variations like "..", "...", "%2e%2e", or parts containing dangerous traversal sequences
    if (
      trimmedPart === '..' ||
      trimmedPart.toLowerCase() === '%2e%2e' ||
      trimmedPart.includes('..')
    ) {
      throw new Error(`检测到路径穿越攻击 (Zip Slip) 被严格拦截: ${rawPath}`);
    }
    parts.push(trimmedPart);
  }

  if (parts.length === 0) {
    throw new Error(`路径解析后为空，非法路径: ${rawPath}`);
  }

  // 6. Check Windows reserved device names (CON, PRN, AUX, NUL, COM1..9, LPT1..9)
  for (const part of parts) {
    const baseName = part.split('.')[0].toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(baseName)) {
      throw new Error(`禁止使用系统保留设备名: ${part} (${rawPath})`);
    }
  }

  return parts.join('/');
}

/**
 * Checks if a path points to sensitive credentials, git repositories, or key files.
 */
export function isSensitivePath(relPath: string): boolean {
  try {
    const normalized = normalizeAiPath(relPath);
    const parts = normalized.split('/');
    
    // Check directory names
    if (parts.some(p => SENSITIVE_DIR_NAMES.has(p.toLowerCase()))) {
      return true;
    }
    
    const fileName = parts[parts.length - 1].toLowerCase();
    
    // Check sensitive file names or patterns
    if (SENSITIVE_FILE_NAMES.has(fileName)) {
      return true;
    }

    if (
      fileName.startsWith('.env') ||
      fileName.endsWith('.pem') ||
      fileName.endsWith('.key') ||
      fileName.endsWith('.pfx') ||
      fileName.endsWith('.p12') ||
      fileName.includes('id_rsa') ||
      fileName.includes('id_ed25519') ||
      fileName.includes('service_account') ||
      fileName.includes('service-account')
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Checks whether a file path is junk OS metadata that should be ignored by default
 */
export function isIgnoredMetadataPath(relPath: string): boolean {
  const parts = relPath.split('/');
  for (const p of parts) {
    if (IGNORED_METADATA_FILES.has(p) || p.startsWith('._') || p === '__MACOSX') {
      return true;
    }
  }
  return false;
}

export async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
