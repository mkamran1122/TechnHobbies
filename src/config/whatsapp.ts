import type { WhatsAppConfig } from '../types/catalog';
import { formatPKRNumber } from '../utils/currency';

export const DEFAULT_WHATSAPP_TEMPLATE = `Hello TechnHobbies!

I am interested in this product:

Product: {productName}
SKU: {sku}
Price: Rs. {price}
Product Link: {url}

Please share availability and further details.`;

export function sanitizeWhatsAppDigits(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '');
}

export function toInternationalWhatsAppNumber(raw?: string): string {
  let digits = sanitizeWhatsAppDigits(raw || '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return `92${digits.slice(1)}`;
  }
  return digits;
}

export function formatWhatsAppDisplayNumber(raw?: string): string {
  const digits = sanitizeWhatsAppDigits(raw || '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return digits;
  }
  if (digits.startsWith('92') && digits.length >= 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function resolveEffectiveWhatsAppNumber(configNumber?: string): string {
  const fromConfig = sanitizeWhatsAppDigits(configNumber || '');
  if (fromConfig.length >= 7) {
    return fromConfig;
  }
  const fromEnv = sanitizeWhatsAppDigits(import.meta.env?.VITE_WHATSAPP_BUSINESS_NUMBER || '');
  if (fromEnv.length >= 7) {
    return fromEnv;
  }
  return '';
}

export function isWhatsAppConfigured(config?: WhatsAppConfig): boolean {
  return toInternationalWhatsAppNumber(resolveEffectiveWhatsAppNumber(config?.businessNumber)).length >= 7;
}

export function getEnvWhatsAppNumber(): string {
  return sanitizeWhatsAppDigits(import.meta.env?.VITE_WHATSAPP_BUSINESS_NUMBER || '');
}

export interface ProductInquiryPayload {
  productName: string;
  sku: string;
  price: number;
  productUrl: string;
  variantLabel?: string;
}

export function buildProductInquiryMessage(
  payload: ProductInquiryPayload,
  template?: string
): string {
  const activeTemplate = (template || DEFAULT_WHATSAPP_TEMPLATE).trim();
  const displayProduct = payload.variantLabel
    ? `${payload.productName} (${payload.variantLabel})`
    : payload.productName;

  return activeTemplate
    .replace(/\{productName\}/g, displayProduct)
    .replace(/\{sku\}/g, payload.sku)
    .replace(/\{price\}/g, formatPKRNumber(payload.price))
    .replace(/\{url\}/g, payload.productUrl);
}

export function buildGeneralInquiryMessage(topic?: string): string {
  const base = topic
    ? `Hello TechnHobbies!\n\nI would like assistance regarding: ${topic}\n\nPlease share details.`
    : `Hello TechnHobbies!\n\nI am browsing your RC & Hobby catalog and would like expert advice on product availability.`;
  return base;
}

export function buildWhatsAppClickToChatUrl(
  businessNumber: string,
  message: string
): string | null {
  const digits = toInternationalWhatsAppNumber(businessNumber);
  if (digits.length < 7) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
