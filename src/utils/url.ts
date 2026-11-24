export function sanitizeExternalUrl(rawUrl: string | undefined): string {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function isValidImageSource(rawSrc: string): boolean {
  const value = rawSrc.trim();
  if (!value) return false;
  if (value.startsWith('/src/assets/') || value.startsWith('/assets/')) {
    return !value.includes('..');
  }
  if (value.startsWith('data:image/png;base64,') || value.startsWith('data:image/jpeg;base64,') || value.startsWith('data:image/webp;base64,')) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const ALLOWED_UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_IMAGE_BYTES = 800 * 1024; // 800 KB limit for local preview persistence
