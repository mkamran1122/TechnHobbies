export function formatPKR(amount: number): string {
  const safeValue = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rs. ${safeValue.toLocaleString('en-US')}`;
}

export function formatPKRNumber(amount: number): string {
  const safeValue = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return safeValue.toLocaleString('en-US');
}

export function computeDiscountPercentage(price: number, originalPrice?: number): number | undefined {
  if (!originalPrice || originalPrice <= price || price <= 0) {
    return undefined;
  }
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
  return pct > 0 ? pct : undefined;
}
