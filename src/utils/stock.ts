import type { Product, StockStatus } from '../types/catalog';

export function getEffectiveStockStatus(product: Product): StockStatus {
  if (
    product.stockCount <= 0 &&
    (product.stockStatus === 'In Stock' || product.stockStatus === 'Limited Stock')
  ) {
    return 'Out of Stock';
  }
  return product.stockStatus;
}

export function isProductAvailable(product: Product): boolean {
  return getEffectiveStockStatus(product) !== 'Out of Stock';
}
