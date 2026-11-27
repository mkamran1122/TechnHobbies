export type StockStatus = 'In Stock' | 'Limited Stock' | 'Pre-Order' | 'Out of Stock';

export type ProductCondition = 'Brand New' | 'Open Box' | 'Refurbished';

export interface ProductVariant {
  id: string;
  group: string;
  label: string;
  priceDelta: number;
  skuSuffix: string;
  inStock: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  categoryId: string;
  subcategoryId?: string;
  sku: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  stockStatus: StockStatus;
  stockCount: number;
  condition: ProductCondition;
  featured: boolean;
  published: boolean;
  archived: boolean;
  shortDescription: string;
  description: string;
  primaryImage?: string;
  images: string[];
  specs: ProductSpec[];
  whatsInBox: string[];
  compatibility: string;
  warrantyInfo?: string;
  shippingInfo?: string;
  variants: ProductVariant[];
  createdAt?: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  featured: boolean;
  displayOrder?: number;
  parentId?: string;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  country: string;
  specialty: string;
}

export interface WhatsAppConfig {
  businessNumber: string;
  defaultMessageTemplate: string;
  primaryButtonLabel: string;
  cardButtonLabel: string;
  showCardInquiryButton: boolean;
  trackLocalClicks: boolean;
}

export interface WhatsAppClickEvent {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  price: number;
  timestamp: string;
  source: 'pdp' | 'card' | 'general';
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  contactEmail: string;
  cityBase: string;
  socialLinks: {
    instagram: string;
    youtube: string;
    facebook: string;
  };
  seoTitle: string;
  seoDescription: string;
}

export interface CatalogStoreState {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  whatsappConfig: WhatsAppConfig;
  storeSettings: StoreSettings;
  inquiryAnalytics: WhatsAppClickEvent[];
}
