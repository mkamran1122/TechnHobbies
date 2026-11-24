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
const TAXONOMY_MIGRATION_KEY = 'technhobbies_taxonomy_v2_migrated';

const NEW_RC_CATEGORY_IDS = [
  'cat-rc-trucks',
  'cat-rc-buggy',
  'cat-rc-drift',
  'cat-rc-crawler',
  'cat-rc-engine-car',
  'cat-rc-car-shells',
] as const;

function isLegacyCarsCategory(cat: Category): boolean {
  return (
    cat.id === 'cat-cars' ||
    cat.slug === 'rc-cars-crawlers' ||
    cat.name.trim().toLowerCase() === 'rc cars & crawlers'
  );
}

function inferNewRcCategoryId(product: Product): string {
  const titleSummary = `${product.name} ${product.shortDescription}`;
  if (
    /\b(body\s*shell|car\s*shell|clear\s*body|lexan\s*body|polycarbonate\s*body|unpainted\s*body|shells?)\b/i.test(
      titleSummary
    )
  ) {
    return 'cat-rc-car-shells';
  }

  const fullText = [
    product.name,
    product.shortDescription,
    product.description,
    ...(product.specs || []).map((s) => `${s.label} ${s.value}`),
  ].join(' ');

  if (
    /\b(nitro|gasoline|petrol|gas-powered|2-stroke|glow\s*plug|cc\s*engine|engine\s*car)\b/i.test(
      fullText
    )
  ) {
    return 'cat-rc-engine-car';
  }
  if (/\b(crawler|rock\s*crawler|trail\s*crawler|portal\s*axle)\b/i.test(fullText)) {
    return 'cat-rc-crawler';
  }
  if (/\b(drift|drifting)\b/i.test(fullText)) {
    return 'cat-rc-drift';
  }
  if (/\b(buggy|buggies)\b/i.test(fullText)) {
    return 'cat-rc-buggy';
  }
  if (
    /\b(monster\s*truck|truggy|short\s*course|stadium\s*truck|desert\s*truck|rc\s*truck|trucks?)\b/i.test(
      fullText
    )
  ) {
    return 'cat-rc-trucks';
  }

  return '';
}

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

      let categories = Array.isArray(parsed.categories)
        ? parsed.categories
        : INITIAL_CATALOG_STATE.categories;
      let products = Array.isArray(parsed.products)
        ? parsed.products
        : INITIAL_CATALOG_STATE.products;

      const hasLegacyCarsCat = categories.some(isLegacyCarsCategory);
      const alreadyMigrated = window.localStorage.getItem(TAXONOMY_MIGRATION_KEY) === '1';

      if (hasLegacyCarsCat || !alreadyMigrated) {
        const legacyIds = new Set(categories.filter(isLegacyCarsCategory).map((c) => c.id));
        legacyIds.add('cat-cars');

        const cleanedCategories = categories.filter((c) => !isLegacyCarsCategory(c));
        const newCategoryTemplates = INITIAL_CATALOG_STATE.categories.filter((c) =>
          (NEW_RC_CATEGORY_IDS as readonly string[]).includes(c.id)
        );
        const missingNewCategories = newCategoryTemplates.filter(
          (tmpl) =>
            !cleanedCategories.some(
              (existing) =>
                existing.id === tmpl.id ||
                existing.name.trim().toLowerCase() === tmpl.name.trim().toLowerCase()
            )
        );

        categories = [...missingNewCategories, ...cleanedCategories];

        const categoryIdByName = new Map(
          categories.map((c) => [c.name.trim().toLowerCase(), c.id])
        );

        products = products.map((product) => {
          const { warrantyInfo: _w, shippingInfo: _s, ...rest } = product;
          if (!legacyIds.has(product.categoryId)) {
            return rest;
          }
          const inferredId = inferNewRcCategoryId(product);
          const matchedTemplate = newCategoryTemplates.find((c) => c.id === inferredId);
          const resolvedId = matchedTemplate
            ? categoryIdByName.get(matchedTemplate.name.trim().toLowerCase()) || matchedTemplate.id
            : '';
          return {
            ...rest,
            categoryId: resolvedId,
          };
        });
      }

      const hydrated: CatalogStoreState = {
        ...INITIAL_CATALOG_STATE,
        ...parsed,
        categories,
        products,
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

      if (hasLegacyCarsCat || !alreadyMigrated) {
        this.saveState(hydrated);
        window.localStorage.setItem(TAXONOMY_MIGRATION_KEY, '1');
      }

      return hydrated;
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
      window.localStorage.setItem(TAXONOMY_MIGRATION_KEY, '1');
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
