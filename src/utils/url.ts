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

export const MIN_PRODUCT_IMAGES = 4;
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_IMAGE_URL_LENGTH = 500;

export interface ImageUrlValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

export function validateProductImageUrl(rawSrc: string): ImageUrlValidationResult {
  const value = (rawSrc || '').trim();
  if (!value) {
    return { valid: false, error: 'Image URL is required.' };
  }
  if (value.length > MAX_IMAGE_URL_LENGTH) {
    return {
      valid: false,
      error: `Image URL must be ${MAX_IMAGE_URL_LENGTH} characters or fewer.`,
    };
  }
  if (/^data:/i.test(value) || /;base64,/i.test(value)) {
    return {
      valid: false,
      error: 'Base64 / data: images are not allowed. Use a direct https:// image URL.',
    };
  }
  if (/^idb:\/\//i.test(value)) {
    return {
      valid: false,
      error: 'Local idb:// browser references are not allowed. Use a direct https:// image URL.',
    };
  }
  if (value.startsWith('/src/assets/') || value.startsWith('/assets/')) {
    if (value.includes('..')) {
      return { valid: false, error: 'Invalid local asset path.' };
    }
    return { valid: true, normalized: value };
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        error: 'Only https:// or http:// image URLs are supported.',
      };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'Enter a valid image URL with a domain name.' };
    }
    return { valid: true, normalized: value };
  } catch {
    return {
      valid: false,
      error: 'Enter a valid https:// (or http://) image URL.',
    };
  }
}

export function isValidImageSource(rawSrc: string): boolean {
  return validateProductImageUrl(rawSrc).valid;
}
