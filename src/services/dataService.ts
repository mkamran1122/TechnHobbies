import { INITIAL_CATALOG_STATE } from '../data/sampleCatalog';
import type {
  Brand,
  CatalogStoreState,
  Category,
  Product,
  StoreSettings,
  WhatsAppClickEvent,
  WhatsAppConfig,
} from '../types/catalog';

export const STORAGE_KEY = 'technhobbies_catalog_state_v1';

/**
 * Modular Catalog Repository Interface.
 * Preserves browser localStorage catalog state non-destructively alongside
 * Cloud Firestore synchronization and recovery.
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
  updateWhatsAppConfig(state: CatalogStoreState, config: WhatsAppConfig): CatalogStoreState;
  updateStoreSettings(state: CatalogStoreState, settings: StoreSettings): CatalogStoreState;
  recordWhatsAppClick(state: CatalogStoreState, event: WhatsAppClickEvent): CatalogStoreState;
}

function normalizeCategory(raw: Category): Category {
  const parentId = typeof raw.parentId === 'string' && raw.parentId.trim() ? raw.parentId.trim() : undefined;
  return {
    ...raw,
    ...(parentId ? { parentId } : {}),
  };
}

function normalizeProduct(raw: Product): Product {
  const { warrantyInfo: _w, shippingInfo: _s, ...rest } = raw;
  const subcategoryId =
    typeof rest.subcategoryId === 'string' && rest.subcategoryId.trim()
      ? rest.subcategoryId.trim()
      : undefined;
  return {
    ...rest,
    ...(subcategoryId ? { subcategoryId } : {}),
    archived: Boolean(rest.archived),
  };
}

/**
 * Reads localStorage catalog data strictly non-destructively (never deletes,
 * renames, or rewrites user categories/subcategories/products) and merges any
 * missing baseline defaults only if absent by both id and slug.
 */
export function buildNonDestructiveRecoveryState(): {
  state: CatalogStoreState;
  hasLocalBackup: boolean;
} {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { state: INITIAL_CATALOG_STATE, hasLocalBackup: false };
    }

    const parsed = JSON.parse(raw) as Partial<CatalogStoreState>;
    const localCategories = Array.isArray(parsed.categories)
      ? parsed.categories.map(normalizeCategory)
      : [];
    const localBrands = Array.isArray(parsed.brands) ? parsed.brands : [];
    const localProducts = Array.isArray(parsed.products)
      ? parsed.products.map(normalizeProduct)
      : [];

    // Keep all local categories first, then append any missing baseline categories
    const catIds = new Set(localCategories.map((c) => c.id));
    const catSlugs = new Set(localCategories.map((c) => c.slug.trim().toLowerCase()));
    const mergedCategories = [...localCategories];
    for (const defCat of INITIAL_CATALOG_STATE.categories) {
      if (!catIds.has(defCat.id) && !catSlugs.has(defCat.slug.trim().toLowerCase())) {
        mergedCategories.push(defCat);
        catIds.add(defCat.id);
        catSlugs.add(defCat.slug.trim().toLowerCase());
      }
    }

    // Keep all local brands first, then append any missing baseline brands
    const brandIds = new Set(localBrands.map((b) => b.id));
    const brandSlugs = new Set(localBrands.map((b) => b.slug.trim().toLowerCase()));
    const mergedBrands = [...localBrands];
    for (const defBrand of INITIAL_CATALOG_STATE.brands) {
      if (!brandIds.has(defBrand.id) && !brandSlugs.has(defBrand.slug.trim().toLowerCase())) {
        mergedBrands.push(defBrand);
        brandIds.add(defBrand.id);
        brandSlugs.add(defBrand.slug.trim().toLowerCase());
      }
    }

    // Keep all local products first, then append baseline products only if local had none or SKU/slug/id is absent
    const prodIds = new Set(localProducts.map((p) => p.id));
    const prodSlugs = new Set(localProducts.map((p) => p.slug.trim().toLowerCase()));
    const prodSkus = new Set(localProducts.map((p) => p.sku.trim().toUpperCase()));
    const mergedProducts = [...localProducts];
    if (localProducts.length === 0) {
      for (const defProd of INITIAL_CATALOG_STATE.products) {
        if (
          !prodIds.has(defProd.id) &&
          !prodSlugs.has(defProd.slug.trim().toLowerCase()) &&
          !prodSkus.has(defProd.sku.trim().toUpperCase())
        ) {
          mergedProducts.push(defProd);
        }
      }
    }

    const cachedBusinessNumber = parsed.whatsappConfig?.businessNumber?.trim();
    const cachedContactEmail = parsed.storeSettings?.contactEmail?.trim();
    const cachedCityBase = parsed.storeSettings?.cityBase;
    const cachedTagline = parsed.storeSettings?.tagline?.trim();

    return {
      hasLocalBackup: true,
      state: {
        ...INITIAL_CATALOG_STATE,
        categories: mergedCategories,
        brands: mergedBrands,
        products: mergedProducts,
        inquiryAnalytics: Array.isArray(parsed.inquiryAnalytics)
          ? parsed.inquiryAnalytics
          : INITIAL_CATALOG_STATE.inquiryAnalytics,
        whatsappConfig: {
          ...INITIAL_CATALOG_STATE.whatsappConfig,
          ...(parsed.whatsappConfig || {}),
          businessNumber: cachedBusinessNumber || INITIAL_CATALOG_STATE.whatsappConfig.businessNumber,
        },
        storeSettings: {
          ...INITIAL_CATALOG_STATE.storeSettings,
          ...(parsed.storeSettings || {}),
          tagline: cachedTagline || INITIAL_CATALOG_STATE.storeSettings.tagline,
          contactEmail: cachedContactEmail || INITIAL_CATALOG_STATE.storeSettings.contactEmail,
          cityBase: cachedCityBase || INITIAL_CATALOG_STATE.storeSettings.cityBase,
          socialLinks: {
            ...INITIAL_CATALOG_STATE.storeSettings.socialLinks,
            ...(parsed.storeSettings?.socialLinks || {}),
          },
        },
      },
    };
  } catch {
    return { state: INITIAL_CATALOG_STATE, hasLocalBackup: false };
  }
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
      const cachedTagline = parsed.storeSettings?.tagline?.trim();

      const categories =
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories.map(normalizeCategory)
          : INITIAL_CATALOG_STATE.categories;

      const products = Array.isArray(parsed.products)
        ? parsed.products.map(normalizeProduct)
        : INITIAL_CATALOG_STATE.products;

      const brands =
        Array.isArray(parsed.brands) && parsed.brands.length > 0
          ? parsed.brands
          : INITIAL_CATALOG_STATE.brands;

      return {
        ...INITIAL_CATALOG_STATE,
        categories,
        products,
        brands,
        inquiryAnalytics: Array.isArray(parsed.inquiryAnalytics)
          ? parsed.inquiryAnalytics
          : INITIAL_CATALOG_STATE.inquiryAnalytics,
        whatsappConfig: {
          ...INITIAL_CATALOG_STATE.whatsappConfig,
          ...(parsed.whatsappConfig || {}),
          businessNumber: cachedBusinessNumber || INITIAL_CATALOG_STATE.whatsappConfig.businessNumber,
        },
        storeSettings: {
          ...INITIAL_CATALOG_STATE.storeSettings,
          ...(parsed.storeSettings || {}),
          tagline: cachedTagline || INITIAL_CATALOG_STATE.storeSettings.tagline,
          contactEmail: cachedContactEmail || INITIAL_CATALOG_STATE.storeSettings.contactEmail,
          cityBase: cachedCityBase || INITIAL_CATALOG_STATE.storeSettings.cityBase,
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
