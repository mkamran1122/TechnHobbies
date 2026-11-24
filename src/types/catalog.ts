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
  sku: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  stockStatus: StockStatus;
  stockCount: number;
  condition: ProductCondition;
  featured: boolean;
  published: boolean;
  archived?: boolean;
  shortDescription: string;
  description: string;
  images: string[];
  specs: ProductSpec[];
  whatsInBox: string[];
  compatibility: string;
  warrantyInfo?: string;
  shippingInfo?: string;
  variants: ProductVariant[];
  updatedAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  featured: boolean;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  country: string;
  specialty: string;
}

export interface LearningArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  readTimeMinutes: number;
  publishedDate: string;
  summary: string;
  sections: { heading: string; body: string }[];
  relatedProductIds: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  builderName: string;
  city: string;
  category: string;
  image: string;
  caption: string;
  gearUsed: string;
  productId?: string;
}

export interface CommunityMeetup {
  id: string;
  title: string;
  city: string;
  venue: string;
  dateLabel: string;
  discipline: string;
  organizer: string;
  notes: string;
}

export interface CommunityPost {
  id: string;
  author: string;
  city: string;
  topic: string;
  title: string;
  body: string;
  postedAt: string;
  repliesCount: number;
}

export interface CustomerReview {
  id: string;
  customerName: string;
  city: string;
  productId: string;
  productName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedOwner: boolean;
  date: string;
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
  articles: LearningArticle[];
  gallery: GalleryItem[];
  meetups: CommunityMeetup[];
  communityPosts: CommunityPost[];
  reviews: CustomerReview[];
  whatsappConfig: WhatsAppConfig;
  storeSettings: StoreSettings;
  inquiryAnalytics: WhatsAppClickEvent[];
}
