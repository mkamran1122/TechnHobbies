import { INITIAL_CATALOG_STATE } from '../data/sampleCatalog';
import type {
  Brand,
  CatalogStoreState,
  Category,
  CommunityPost,
  CustomerReview,
  GalleryItem,
  LearningArticle,
  Product,
  StoreSettings,
  WhatsAppClickEvent,
  WhatsAppConfig,
} from '../types/catalog';

const STORAGE_KEY = 'technhobbies_catalog_state_v1';

/**
 * Modular Catalog Repository Interface.
 * Currently backed by LocalSampleAdapter (local sample data + browser localStorage).
 * Structured so a future Firebase Firestore / REST adapter can replace this without
 * refactoring UI components.
 */
export interface ICatalogService {
  loadState(): CatalogStoreState;
  saveState(state: CatalogStoreState): boolean;
  getLastStorageWarning(): string | null;
  resetToSampleData(): CatalogStoreState;
  upsertProduct(state: CatalogStoreState, product: Product): CatalogStoreState;
  deleteProduct(state: CatalogStoreState, productId: string): CatalogStoreState;
  upsertCategory(state: CatalogStoreState, category: Category): CatalogStoreState;
  deleteCategory(state: CatalogStoreState, categoryId: string): CatalogStoreState;
  upsertBrand(state: CatalogStoreState, brand: Brand): CatalogStoreState;
  deleteBrand(state: CatalogStoreState, brandId: string): CatalogStoreState;
  upsertArticle(state: CatalogStoreState, article: LearningArticle): CatalogStoreState;
  deleteArticle(state: CatalogStoreState, articleId: string): CatalogStoreState;
  upsertGalleryItem(state: CatalogStoreState, item: GalleryItem): CatalogStoreState;
  deleteGalleryItem(state: CatalogStoreState, itemId: string): CatalogStoreState;
  addCommunityPost(state: CatalogStoreState, post: CommunityPost): CatalogStoreState;
  addReview(state: CatalogStoreState, review: CustomerReview): CatalogStoreState;
  updateWhatsAppConfig(state: CatalogStoreState, config: WhatsAppConfig): CatalogStoreState;
  updateStoreSettings(state: CatalogStoreState, settings: StoreSettings): CatalogStoreState;
  recordWhatsAppClick(state: CatalogStoreState, event: WhatsAppClickEvent): CatalogStoreState;
}

class LocalSampleCatalogService implements ICatalogService {
  private lastStorageWarning: string | null = null;

  getLastStorageWarning(): string | null {
    return this.lastStorageWarning;
  }

  loadState(): CatalogStoreState {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return INITIAL_CATALOG_STATE;
      }
      const parsed = JSON.parse(raw) as Partial<CatalogStoreState>;
      const cachedBusinessNumber = parsed.whatsappConfig?.businessNumber?.trim();
      const cachedContactEmail = parsed.storeSettings?.contactEmail?.trim();
      const cachedCityBase = parsed.storeSettings?.cityBase;
      return {
        ...INITIAL_CATALOG_STATE,
        ...parsed,
        whatsappConfig: {
          ...INITIAL_CATALOG_STATE.whatsappConfig,
          ...(parsed.whatsappConfig || {}),
          businessNumber: cachedBusinessNumber || INITIAL_CATALOG_STATE.whatsappConfig.businessNumber,
        },
        storeSettings: {
          ...INITIAL_CATALOG_STATE.storeSettings,
          ...(parsed.storeSettings || {}),
          contactEmail: cachedContactEmail || INITIAL_CATALOG_STATE.storeSettings.contactEmail,
          cityBase:
            !cachedCityBase || cachedCityBase === 'Lahore · Nationwide Pakistan Dispatch'
              ? INITIAL_CATALOG_STATE.storeSettings.cityBase
              : cachedCityBase,
          socialLinks: {
            ...INITIAL_CATALOG_STATE.storeSettings.socialLinks,
            ...(parsed.storeSettings?.socialLinks || {}),
          },
        },
      };
    } catch {
      return INITIAL_CATALOG_STATE;
    }
  }

  saveState(state: CatalogStoreState): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.lastStorageWarning = null;
      return true;
    } catch {
      this.lastStorageWarning =
        'Browser localStorage quota reached. Changes remain in memory for this session only; reduce uploaded image sizes or reset sample data.';
      return false;
    }
  }

  resetToSampleData(): CatalogStoreState {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      this.lastStorageWarning = null;
    } catch {
      // Ignore storage errors
    }
    return INITIAL_CATALOG_STATE;
  }

  upsertProduct(state: CatalogStoreState, product: Product): CatalogStoreState {
    const exists = state.products.some((p) => p.id === product.id);
    const products = exists
      ? state.products.map((p) => (p.id === product.id ? product : p))
      : [product, ...state.products];
    const next = { ...state, products };
    this.saveState(next);
    return next;
  }

  deleteProduct(state: CatalogStoreState, productId: string): CatalogStoreState {
    const next = {
      ...state,
      products: state.products.filter((p) => p.id !== productId),
    };
    this.saveState(next);
    return next;
  }

  upsertCategory(state: CatalogStoreState, category: Category): CatalogStoreState {
    const exists = state.categories.some((c) => c.id === category.id);
    const categories = exists
      ? state.categories.map((c) => (c.id === category.id ? category : c))
      : [...state.categories, category];
    const next = { ...state, categories };
    this.saveState(next);
    return next;
  }

  deleteCategory(state: CatalogStoreState, categoryId: string): CatalogStoreState {
    const next = {
      ...state,
      categories: state.categories.filter((c) => c.id !== categoryId),
    };
    this.saveState(next);
    return next;
  }

  upsertBrand(state: CatalogStoreState, brand: Brand): CatalogStoreState {
    const exists = state.brands.some((b) => b.id === brand.id);
    const brands = exists
      ? state.brands.map((b) => (b.id === brand.id ? brand : b))
      : [...state.brands, brand];
    const next = { ...state, brands };
    this.saveState(next);
    return next;
  }

  deleteBrand(state: CatalogStoreState, brandId: string): CatalogStoreState {
    const next = {
      ...state,
      brands: state.brands.filter((b) => b.id !== brandId),
    };
    this.saveState(next);
    return next;
  }

  upsertArticle(state: CatalogStoreState, article: LearningArticle): CatalogStoreState {
    const exists = state.articles.some((a) => a.id === article.id);
    const articles = exists
      ? state.articles.map((a) => (a.id === article.id ? article : a))
      : [article, ...state.articles];
    const next = { ...state, articles };
    this.saveState(next);
    return next;
  }

  deleteArticle(state: CatalogStoreState, articleId: string): CatalogStoreState {
    const next = {
      ...state,
      articles: state.articles.filter((a) => a.id !== articleId),
    };
    this.saveState(next);
    return next;
  }

  upsertGalleryItem(state: CatalogStoreState, item: GalleryItem): CatalogStoreState {
    const exists = state.gallery.some((g) => g.id === item.id);
    const gallery = exists
      ? state.gallery.map((g) => (g.id === item.id ? item : g))
      : [item, ...state.gallery];
    const next = { ...state, gallery };
    this.saveState(next);
    return next;
  }

  deleteGalleryItem(state: CatalogStoreState, itemId: string): CatalogStoreState {
    const next = {
      ...state,
      gallery: state.gallery.filter((g) => g.id !== itemId),
    };
    this.saveState(next);
    return next;
  }

  addCommunityPost(state: CatalogStoreState, post: CommunityPost): CatalogStoreState {
    const next = { ...state, communityPosts: [post, ...state.communityPosts] };
    this.saveState(next);
    return next;
  }

  addReview(state: CatalogStoreState, review: CustomerReview): CatalogStoreState {
    const next = { ...state, reviews: [review, ...state.reviews] };
    this.saveState(next);
    return next;
  }

  updateWhatsAppConfig(state: CatalogStoreState, whatsappConfig: WhatsAppConfig): CatalogStoreState {
    const next = { ...state, whatsappConfig };
    this.saveState(next);
    return next;
  }

  updateStoreSettings(state: CatalogStoreState, storeSettings: StoreSettings): CatalogStoreState {
    const next = { ...state, storeSettings };
    this.saveState(next);
    return next;
  }

  recordWhatsAppClick(state: CatalogStoreState, event: WhatsAppClickEvent): CatalogStoreState {
    if (!state.whatsappConfig.trackLocalClicks) {
      return state;
    }
    const next = {
      ...state,
      inquiryAnalytics: [event, ...state.inquiryAnalytics].slice(0, 50),
    };
    this.saveState(next);
    return next;
  }
}

export const catalogService: ICatalogService = new LocalSampleCatalogService();
