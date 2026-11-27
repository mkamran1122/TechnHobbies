import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  type FieldValue,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_CATALOG_STATE } from '../data/sampleCatalog';
import { ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Brand,
  Category,
  Product,
  ProductSpec,
  ProductVariant,
  StoreSettings,
  WhatsAppConfig,
} from '../types/catalog';
import {
  buildNonDestructiveRecoveryState,
  STORAGE_KEY,
} from './dataService';
import { wouldCreateCategoryCycle } from '../utils/categoryTree';
import {
  isValidImageSource,
  MAX_PRODUCT_IMAGES,
  validateProductImageUrl,
} from '../utils/url';

export interface PublicSettingsPayload {
  storeSettings: StoreSettings;
  whatsappConfig: Omit<WhatsAppConfig, 'trackLocalClicks'>;
  existsInFirestore: boolean;
}

export interface PrivateAdminSettingsPayload {
  trackLocalClicks: boolean;
  migratedAt?: string;
}

export interface MigrationReport {
  source: 'localStorage' | 'sampleCatalog';
  addedCategories: number;
  skippedCategories: number;
  addedBrands: number;
  skippedBrands: number;
  addedProducts: number;
  skippedProducts: number;
  settingsInitialized: boolean;
  idbImageWarnings: string[];
}

function sanitizeDocId(raw: string, prefix: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return cleaned || `${prefix}-${Date.now()}`;
}

function formatTimestampDate(value: unknown, fallback = ''): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback || new Date().toISOString();
}

function mapDocToCategory(id: string, data: Record<string, unknown>): Category {
  const parentId =
    typeof data.parentId === 'string' && data.parentId.trim() ? data.parentId.trim() : undefined;
  return {
    id,
    slug: String(data.slug || id),
    name: String(data.name || ''),
    description: String(data.description || ''),
    image: String(data.image || ''),
    featured: Boolean(data.featured),
    displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 999,
    ...(parentId ? { parentId } : {}),
  };
}

function mapDocToBrand(id: string, data: Record<string, unknown>): Brand {
  return {
    id,
    slug: String(data.slug || id),
    name: String(data.name || ''),
    country: String(data.country || ''),
    specialty: String(data.specialty || ''),
  };
}

function mapDocToProduct(id: string, data: Record<string, unknown>): Product {
  const rawImages = Array.isArray(data.images)
    ? Array.from(
        new Set(
          data.images
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => isValidImageSource(item))
        )
      ).slice(0, MAX_PRODUCT_IMAGES)
    : [];
  const rawPrimary =
    typeof data.primaryImage === 'string' && isValidImageSource(data.primaryImage)
      ? data.primaryImage.trim()
      : '';
  const primaryImage = rawPrimary || rawImages[0] || '';
  const images =
    rawImages.length > 0
      ? primaryImage && rawImages[0] !== primaryImage
        ? [primaryImage, ...rawImages.filter((img) => img !== primaryImage)].slice(0, MAX_PRODUCT_IMAGES)
        : rawImages
      : primaryImage
        ? [primaryImage]
        : [];

  const price = typeof data.price === 'number' ? data.price : Number(data.price) || 0;
  const originalPrice =
    typeof data.originalPrice === 'number' && data.originalPrice > 0
      ? data.originalPrice
      : undefined;
  const discountPercentage =
    typeof data.discountPercentage === 'number' && data.discountPercentage > 0
      ? data.discountPercentage
      : undefined;

  const specs: ProductSpec[] = Array.isArray(data.specs)
    ? data.specs
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s) => ({
          label: String(s.label || ''),
          value: String(s.value || ''),
        }))
        .filter((s) => s.label || s.value)
    : [];

  const whatsInBox: string[] = Array.isArray(data.whatsInBox)
    ? data.whatsInBox.filter((item): item is string => typeof item === 'string')
    : [];

  const variants: ProductVariant[] = Array.isArray(data.variants)
    ? data.variants
        .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
        .map((v, idx) => ({
          id: String(v.id || `var-${idx}`),
          group: String(v.group || 'Option'),
          label: String(v.label || ''),
          priceDelta: typeof v.priceDelta === 'number' ? v.priceDelta : Number(v.priceDelta) || 0,
          skuSuffix: String(v.skuSuffix || ''),
          inStock: Boolean(v.inStock),
        }))
        .filter((v) => v.label)
    : [];

  const subcategoryId =
    typeof data.subcategoryId === 'string' && data.subcategoryId.trim()
      ? data.subcategoryId.trim()
      : undefined;

  return {
    id,
    slug: String(data.slug || id),
    name: String(data.name || ''),
    brandId: String(data.brandId || ''),
    categoryId: String(data.categoryId || ''),
    ...(subcategoryId ? { subcategoryId } : {}),
    sku: String(data.sku || ''),
    price,
    originalPrice,
    discountPercentage,
    stockStatus: (data.stockStatus as Product['stockStatus']) || 'In Stock',
    stockCount: typeof data.stockCount === 'number' ? data.stockCount : Number(data.stockCount) || 0,
    condition: (data.condition as Product['condition']) || 'Brand New',
    featured: Boolean(data.featured),
    published: Boolean(data.published),
    archived: Boolean(data.archived),
    shortDescription: String(data.shortDescription || ''),
    description: String(data.description || ''),
    primaryImage,
    images,
    specs,
    whatsInBox,
    compatibility: String(data.compatibility || ''),
    variants,
    createdAt: formatTimestampDate(data.createdAt),
    updatedAt: formatTimestampDate(data.updatedAt),
  };
}

export async function ensureAdminProfileAndLog(
  user: User,
  action: 'ADMIN_LOGIN' | 'ADMIN_LOGOUT' | 'CATALOG_UPDATE'
): Promise<void> {
  if (!user.emailVerified || user.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
    return;
  }

  try {
    const adminRef = doc(db, 'admins', user.uid);
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: ADMIN_EMAIL,
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (action === 'ADMIN_LOGIN') {
      await updateDoc(adminRef, {
        updatedAt: serverTimestamp(),
      });
    }

    const logId = sanitizeDocId(`log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, 'log');
    await setDoc(doc(db, 'admin_logs', logId), {
      uid: user.uid,
      email: ADMIN_EMAIL,
      action,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit sync; catalog operations still enforce rules server-side
  }
}

export function subscribeCategories(
  onData: (categories: Category[]) => void,
  onError: (error: unknown) => void
): () => void {
  const path = 'categories';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDocToCategory(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 9999;
          const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeBrands(
  onData: (brands: Brand[]) => void,
  onError: (error: unknown) => void
): () => void {
  const path = 'brands';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDocToBrand(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeProducts(
  includeUnpublished: boolean,
  onData: (products: Product[]) => void,
  onError: (error: unknown) => void
): () => void {
  const path = 'products';
  const targetQuery = includeUnpublished
    ? collection(db, path)
    : query(
        collection(db, path),
        where('published', '==', true),
        where('archived', '==', false)
      );

  return onSnapshot(
    targetQuery,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDocToProduct(d.id, d.data() as Record<string, unknown>))
        .filter((p) => includeUnpublished || (p.published && !p.archived))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribePublicStoreSettings(
  onData: (payload: PublicSettingsPayload) => void,
  onError: (error: unknown) => void
): () => void {
  const path = 'store_settings/public';
  return onSnapshot(
    doc(db, 'store_settings', 'public'),
    (snapshot) => {
      if (!snapshot.exists()) {
        const { trackLocalClicks: _ignored, ...publicWa } = INITIAL_CATALOG_STATE.whatsappConfig;
        onData({
          storeSettings: INITIAL_CATALOG_STATE.storeSettings,
          whatsappConfig: publicWa,
          existsInFirestore: false,
        });
        return;
      }
      const data = snapshot.data() as Record<string, unknown>;
      const social = (data.socialLinks && typeof data.socialLinks === 'object'
        ? data.socialLinks
        : {}) as Record<string, unknown>;

      onData({
        existsInFirestore: true,
        storeSettings: {
          storeName: String(data.storeName || INITIAL_CATALOG_STATE.storeSettings.storeName),
          tagline: String(data.tagline || INITIAL_CATALOG_STATE.storeSettings.tagline),
          contactEmail:
            typeof data.contactEmail === 'string'
              ? data.contactEmail
              : INITIAL_CATALOG_STATE.storeSettings.contactEmail,
          cityBase: String(data.cityBase || INITIAL_CATALOG_STATE.storeSettings.cityBase),
          socialLinks: {
            instagram: String(social.instagram || ''),
            youtube: String(social.youtube || ''),
            facebook: String(social.facebook || ''),
          },
          seoTitle: String(data.seoTitle || INITIAL_CATALOG_STATE.storeSettings.seoTitle),
          seoDescription: String(data.seoDescription || INITIAL_CATALOG_STATE.storeSettings.seoDescription),
        },
        whatsappConfig: {
          businessNumber:
            typeof data.whatsappNumber === 'string'
              ? data.whatsappNumber
              : INITIAL_CATALOG_STATE.whatsappConfig.businessNumber,
          defaultMessageTemplate: String(
            data.defaultMessageTemplate || INITIAL_CATALOG_STATE.whatsappConfig.defaultMessageTemplate
          ),
          primaryButtonLabel: String(
            data.primaryButtonLabel || INITIAL_CATALOG_STATE.whatsappConfig.primaryButtonLabel
          ),
          cardButtonLabel: String(
            data.cardButtonLabel || INITIAL_CATALOG_STATE.whatsappConfig.cardButtonLabel
          ),
          showCardInquiryButton:
            typeof data.showCardInquiryButton === 'boolean'
              ? data.showCardInquiryButton
              : INITIAL_CATALOG_STATE.whatsappConfig.showCardInquiryButton,
        },
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribePrivateAdminSettings(
  onData: (payload: PrivateAdminSettingsPayload) => void,
  onError: (error: unknown) => void
): () => void {
  const path = 'store_settings/admin_private';
  return onSnapshot(
    doc(db, 'store_settings', 'admin_private'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({ trackLocalClicks: true });
        return;
      }
      const data = snapshot.data() as Record<string, unknown>;
      onData({
        trackLocalClicks:
          typeof data.trackLocalClicks === 'boolean' ? data.trackLocalClicks : true,
        migratedAt: typeof data.migratedAt === 'string' ? data.migratedAt : undefined,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function saveProductToFirestore(product: Product, uid: string): Promise<void> {
  const productId = sanitizeDocId(product.id, 'prod');
  const path = `products/${productId}`;
  const cleanSku = product.sku.trim().toUpperCase();
  const cleanName = product.name.trim();
  const cleanSlug = product.slug.trim();

  if (!cleanName || !cleanSlug || !cleanSku) {
    throw new Error('Product name, URL slug, and SKU are required.');
  }
  if (!product.categoryId || !product.brandId) {
    throw new Error('Select a valid category and brand before saving to Firestore.');
  }
  if (!Number.isFinite(product.price) || product.price <= 0) {
    throw new Error('Price must be greater than 0 PKR.');
  }
  if (!Number.isFinite(product.stockCount) || product.stockCount < 0) {
    throw new Error('Stock quantity cannot be negative.');
  }

  try {
    // Enforce SKU and URL slug uniqueness across Firestore products
    const [skuSnap, slugSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('sku', '==', cleanSku))),
      getDocs(query(collection(db, 'products'), where('slug', '==', cleanSlug))),
    ]);
    const duplicateSkuDoc = skuSnap.docs.find((d) => d.id !== productId);
    if (duplicateSkuDoc) {
      throw new Error(`SKU "${cleanSku}" is already assigned to another product in Firestore.`);
    }
    const duplicateSlugDoc = slugSnap.docs.find((d) => d.id !== productId);
    if (duplicateSlugDoc) {
      throw new Error(`URL slug "${cleanSlug}" is already assigned to another product in Firestore.`);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('SKU "') || error.message.startsWith('URL slug "'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.LIST, 'products');
  }

  const rawImageInputs = (product.images || [])
    .map((img) => img.trim())
    .filter(Boolean);

  const normalizedImages: string[] = [];
  for (const rawUrl of rawImageInputs) {
    const check = validateProductImageUrl(rawUrl);
    if (!check.valid || !check.normalized) {
      throw new Error(check.error || `Invalid product image URL: "${rawUrl}"`);
    }
    if (!normalizedImages.includes(check.normalized)) {
      normalizedImages.push(check.normalized);
    }
  }

  if (normalizedImages.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Maximum ${MAX_PRODUCT_IMAGES} product images are allowed.`);
  }

  let primaryImage = '';
  const requestedPrimary = (product.primaryImage || '').trim();
  if (requestedPrimary) {
    const primaryCheck = validateProductImageUrl(requestedPrimary);
    if (!primaryCheck.valid || !primaryCheck.normalized) {
      throw new Error(primaryCheck.error || `Invalid primary image URL: "${requestedPrimary}"`);
    }
    primaryImage = primaryCheck.normalized;
  }

  const cleanImages = primaryImage
    ? [primaryImage, ...normalizedImages.filter((img) => img !== primaryImage)].slice(
        0,
        MAX_PRODUCT_IMAGES
      )
    : normalizedImages;
  const resolvedPrimaryImage = (cleanImages[0] || '').slice(0, 500);

  const isArchived = Boolean(product.archived);
  const isPublished = isArchived ? false : Boolean(product.published);

  if (isPublished && cleanImages.length === 0) {
    throw new Error('At least one valid product image URL is required before publishing.');
  }

  const docRef = doc(db, 'products', productId);

  try {
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists()
      ? (existingSnap.data() as Record<string, unknown>)
      : null;

    const payload: Record<string, unknown | FieldValue> = {
      id: productId,
      slug: cleanSlug.slice(0, 160),
      name: cleanName.slice(0, 200),
      brandId: sanitizeDocId(product.brandId, 'brand'),
      categoryId: sanitizeDocId(product.categoryId, 'cat'),
      sku: cleanSku.slice(0, 64),
      price: Math.round(product.price),
      stockStatus: product.stockStatus,
      stockCount: Math.max(0, Math.floor(product.stockCount)),
      condition: product.condition,
      featured: Boolean(product.featured),
      published: isPublished,
      archived: isArchived,
      shortDescription: (product.shortDescription.trim() || cleanName).slice(0, 400),
      description: (product.description.trim() || product.shortDescription.trim() || cleanName).slice(0, 5000),
      primaryImage: resolvedPrimaryImage,
      images: cleanImages,
      specs: (product.specs || []).slice(0, 40).map((s) => ({
        label: String(s.label || '').slice(0, 120),
        value: String(s.value || '').slice(0, 300),
      })),
      whatsInBox: (product.whatsInBox || []).slice(0, 30).map((item) => String(item).slice(0, 200)),
      compatibility: (product.compatibility || '').trim().slice(0, 1000),
      variants: (product.variants || []).slice(0, 20).map((v) => ({
        id: String(v.id || ''),
        group: String(v.group || 'Option').slice(0, 60),
        label: String(v.label || '').slice(0, 120),
        priceDelta: Number(v.priceDelta) || 0,
        skuSuffix: String(v.skuSuffix || '').slice(0, 40),
        inStock: Boolean(v.inStock),
      })),
      updatedBy: uid,
      createdAt: existingData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (product.subcategoryId?.trim()) {
      payload.subcategoryId = sanitizeDocId(product.subcategoryId, 'cat');
    } else if (existingData && 'subcategoryId' in existingData) {
      payload.subcategoryId = deleteField();
    }

    if (typeof product.originalPrice === 'number' && product.originalPrice > product.price) {
      payload.originalPrice = Math.round(product.originalPrice);
    } else if (existingData && 'originalPrice' in existingData) {
      payload.originalPrice = deleteField();
    }

    if (
      typeof product.discountPercentage === 'number' &&
      product.discountPercentage > 0 &&
      product.discountPercentage <= 99
    ) {
      payload.discountPercentage = Math.round(product.discountPercentage);
    } else if (existingData && 'discountPercentage' in existingData) {
      payload.discountPercentage = deleteField();
    }

    if (existingSnap.exists()) {
      const { id: _id, createdAt: _createdAt, ...updateFields } = payload;
      await updateDoc(docRef, updateFields);
    } else {
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, existingIsUpdateHint(product), path);
  }
}

function existingIsUpdateHint(product: Product): OperationType {
  return product.createdAt ? OperationType.UPDATE : OperationType.WRITE;
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const cleanId = sanitizeDocId(productId, 'prod');
  const path = `products/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'products', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCategoryToFirestore(category: Category, uid: string): Promise<void> {
  const categoryId = sanitizeDocId(category.id, 'cat');
  const path = `categories/${categoryId}`;
  const cleanName = category.name.trim();
  const cleanSlug = (
    category.slug.trim() ||
    cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  ).slice(0, 128);
  const rawParentId = category.parentId?.trim() || '';
  const cleanParentId = rawParentId ? sanitizeDocId(rawParentId, 'cat') : '';
  const cleanImage = category.image.trim();

  if (!cleanName || !cleanSlug) {
    throw new Error('Category name and slug are required.');
  }
  if (cleanParentId === categoryId) {
    throw new Error('A category cannot be its own parent.');
  }
  if (cleanImage) {
    const imgCheck = validateProductImageUrl(cleanImage);
    if (!imgCheck.valid) {
      throw new Error(imgCheck.error || 'Enter a valid category image URL or /assets/ path.');
    }
  }

  try {
    const allCatsSnap = await getDocs(collection(db, 'categories'));
    const allCats = allCatsSnap.docs.map((d) =>
      mapDocToCategory(d.id, d.data() as Record<string, unknown>)
    );

    const duplicateSlug = allCats.find(
      (c) => c.id !== categoryId && c.slug.trim().toLowerCase() === cleanSlug.toLowerCase()
    );
    if (duplicateSlug) {
      throw new Error(
        `Category slug "${cleanSlug}" is already assigned to "${duplicateSlug.name}".`
      );
    }

    if (cleanParentId) {
      const parentExists = allCats.some((c) => c.id === cleanParentId);
      if (!parentExists) {
        throw new Error('Selected parent category does not exist in Firestore.');
      }
      if (wouldCreateCategoryCycle(categoryId, cleanParentId, allCats)) {
        throw new Error('Cannot assign a subcategory as its own parent or descendant.');
      }
    }

    const docRef = doc(db, 'categories', categoryId);
    const snap = await getDoc(docRef);
    const existingData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
    const displayOrder =
      typeof category.displayOrder === 'number' && Number.isFinite(category.displayOrder)
        ? Math.max(0, Math.min(10000, Math.floor(category.displayOrder)))
        : 100;

    if (snap.exists()) {
      const updatePayload: Record<string, unknown | FieldValue> = {
        slug: cleanSlug,
        name: cleanName.slice(0, 120),
        description: category.description.trim().slice(0, 500),
        image: cleanImage.slice(0, 500),
        featured: Boolean(category.featured),
        displayOrder,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      };
      if (cleanParentId) {
        updatePayload.parentId = cleanParentId;
      } else if (existingData && 'parentId' in existingData) {
        updatePayload.parentId = deleteField();
      }
      await updateDoc(docRef, updatePayload);
    } else {
      const createPayload: Record<string, unknown | FieldValue> = {
        id: categoryId,
        slug: cleanSlug,
        name: cleanName.slice(0, 120),
        description: category.description.trim().slice(0, 500),
        image: cleanImage.slice(0, 500),
        featured: Boolean(category.featured),
        displayOrder,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanParentId) {
        createPayload.parentId = cleanParentId;
      }
      await setDoc(docRef, createPayload);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('Category slug "') ||
        error.message.startsWith('Selected parent') ||
        error.message.startsWith('Cannot assign'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromFirestore(categoryId: string): Promise<void> {
  const cleanId = sanitizeDocId(categoryId, 'cat');
  const path = `categories/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'categories', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBrandToFirestore(brand: Brand, uid: string): Promise<void> {
  const brandId = sanitizeDocId(brand.id, 'brand');
  const path = `brands/${brandId}`;
  const cleanName = brand.name.trim();
  const cleanSlug = (brand.slug.trim() || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 128);

  if (!cleanName || !cleanSlug) {
    throw new Error('Brand name and slug are required.');
  }

  try {
    const docRef = doc(db, 'brands', brandId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        slug: cleanSlug,
        name: cleanName.slice(0, 120),
        country: brand.country.trim().slice(0, 100),
        specialty: brand.specialty.trim().slice(0, 200),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id: brandId,
        slug: cleanSlug,
        name: cleanName.slice(0, 120),
        country: brand.country.trim().slice(0, 100),
        specialty: brand.specialty.trim().slice(0, 200),
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBrandFromFirestore(brandId: string): Promise<void> {
  const cleanId = sanitizeDocId(brandId, 'brand');
  const path = `brands/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'brands', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePublicStoreSettingsToFirestore(
  storeSettings: StoreSettings,
  whatsappConfig: Omit<WhatsAppConfig, 'trackLocalClicks'>,
  uid: string
): Promise<void> {
  const path = 'store_settings/public';
  try {
    const docRef = doc(db, 'store_settings', 'public');
    const snap = await getDoc(docRef);

    const fields = {
      storeName: (storeSettings.storeName.trim() || 'TechnHobbies').slice(0, 120),
      tagline: storeSettings.tagline.trim().slice(0, 200),
      cityBase: storeSettings.cityBase.trim().slice(0, 120),
      contactEmail: storeSettings.contactEmail.trim().slice(0, 254),
      socialLinks: {
        instagram: storeSettings.socialLinks.instagram.trim().slice(0, 500),
        youtube: storeSettings.socialLinks.youtube.trim().slice(0, 500),
        facebook: storeSettings.socialLinks.facebook.trim().slice(0, 500),
      },
      whatsappNumber: whatsappConfig.businessNumber.trim().slice(0, 20),
      defaultMessageTemplate: whatsappConfig.defaultMessageTemplate.trim().slice(0, 1000),
      primaryButtonLabel: whatsappConfig.primaryButtonLabel.trim().slice(0, 80),
      cardButtonLabel: whatsappConfig.cardButtonLabel.trim().slice(0, 80),
      showCardInquiryButton: Boolean(whatsappConfig.showCardInquiryButton),
      seoTitle: storeSettings.seoTitle.trim().slice(0, 160),
      seoDescription: storeSettings.seoDescription.trim().slice(0, 320),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(docRef, fields);
    } else {
      await setDoc(docRef, {
        ...fields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePrivateAdminSettingsToFirestore(
  trackLocalClicks: boolean,
  uid: string,
  migratedAt?: string
): Promise<void> {
  const path = 'store_settings/admin_private';
  try {
    const docRef = doc(db, 'store_settings', 'admin_private');
    const snap = await getDoc(docRef);
    const fields: Record<string, unknown> = {
      trackLocalClicks: Boolean(trackLocalClicks),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    };
    if (migratedAt) {
      fields.migratedAt = migratedAt.slice(0, 64);
    }
    if (snap.exists()) {
      await updateDoc(docRef, fields);
    } else {
      await setDoc(docRef, {
        ...fields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function hasLocalCatalogBackup(): boolean {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Safely migrates existing localStorage catalog records (or initial sample catalog
 * when explicitly requested on an empty Firestore database) without overwriting
 * existing Firestore records or duplicating SKUs, slugs, or IDs.
 */
export async function migrateCatalogToFirestore(
  uid: string,
  mode: 'localStorage' | 'sampleCatalog' | 'restoreCombined'
): Promise<MigrationReport> {
  const combined = buildNonDestructiveRecoveryState();
  const sourceState =
    mode === 'sampleCatalog' ? INITIAL_CATALOG_STATE : combined.state;

  const [existingCatsSnap, existingBrandsSnap, existingProdsSnap, publicSettingsSnap] =
    await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'brands')),
      getDocs(collection(db, 'products')),
      getDoc(doc(db, 'store_settings', 'public')),
    ]);

  const existingCatIds = new Set(existingCatsSnap.docs.map((d) => d.id));
  const existingCatSlugs = new Set(
    existingCatsSnap.docs.map((d) => String(d.data().slug || '').toLowerCase())
  );
  const existingBrandIds = new Set(existingBrandsSnap.docs.map((d) => d.id));
  const existingBrandSlugs = new Set(
    existingBrandsSnap.docs.map((d) => String(d.data().slug || '').toLowerCase())
  );
  const existingProdIds = new Set(existingProdsSnap.docs.map((d) => d.id));
  const existingProdSkus = new Set(
    existingProdsSnap.docs.map((d) => String(d.data().sku || '').trim().toUpperCase())
  );
  const existingProdSlugs = new Set(
    existingProdsSnap.docs.map((d) => String(d.data().slug || '').trim().toLowerCase())
  );

  // Build slug->id maps so products reference valid Firestore category/brand IDs
  const catIdBySlug = new Map<string, string>();
  existingCatsSnap.docs.forEach((d) => {
    catIdBySlug.set(String(d.data().slug || '').toLowerCase(), d.id);
  });
  const brandIdBySlug = new Map<string, string>();
  existingBrandsSnap.docs.forEach((d) => {
    brandIdBySlug.set(String(d.data().slug || '').toLowerCase(), d.id);
  });

  // Sort categories so top-level parent categories are committed before child subcategories
  const topLevelFirst = [
    ...sourceState.categories.filter((c) => !c.parentId?.trim()),
    ...sourceState.categories.filter((c) => Boolean(c.parentId?.trim())),
  ];

  // Batch 1: Missing Categories, Subcategories & Brands (never overwrite existing Firestore docs)
  const taxonomyBatch = writeBatch(db);
  let addedCategories = 0;
  let skippedCategories = 0;
  let addedBrands = 0;
  let skippedBrands = 0;

  topLevelFirst.forEach((cat, idx) => {
    const cleanId = sanitizeDocId(cat.id, 'cat');
    const cleanSlug = cat.slug.trim().toLowerCase();
    if (existingCatIds.has(cleanId) || existingCatSlugs.has(cleanSlug)) {
      skippedCategories += 1;
      return;
    }
    const order = typeof cat.displayOrder === 'number' ? cat.displayOrder : idx + 1;
    const rawParent = cat.parentId?.trim() ? sanitizeDocId(cat.parentId, 'cat') : '';
    const parentId = rawParent && rawParent !== cleanId ? rawParent : '';
    const catDocPayload: Record<string, unknown> = {
      id: cleanId,
      slug: cat.slug.trim().slice(0, 128),
      name: cat.name.trim().slice(0, 120),
      description: cat.description.trim().slice(0, 500),
      image: cat.image.trim().slice(0, 500),
      featured: Boolean(cat.featured),
      displayOrder: order,
      updatedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (parentId) {
      catDocPayload.parentId = parentId;
    }
    taxonomyBatch.set(doc(db, 'categories', cleanId), catDocPayload);
    existingCatIds.add(cleanId);
    existingCatSlugs.add(cleanSlug);
    catIdBySlug.set(cleanSlug, cleanId);
    addedCategories += 1;
  });

  sourceState.brands.forEach((brand) => {
    const cleanId = sanitizeDocId(brand.id, 'brand');
    const cleanSlug = brand.slug.trim().toLowerCase();
    if (existingBrandIds.has(cleanId) || existingBrandSlugs.has(cleanSlug)) {
      skippedBrands += 1;
      return;
    }
    taxonomyBatch.set(doc(db, 'brands', cleanId), {
      id: cleanId,
      slug: brand.slug.trim().slice(0, 128),
      name: brand.name.trim().slice(0, 120),
      country: brand.country.trim().slice(0, 100),
      specialty: brand.specialty.trim().slice(0, 200),
      updatedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    existingBrandIds.add(cleanId);
    existingBrandSlugs.add(cleanSlug);
    brandIdBySlug.set(cleanSlug, cleanId);
    addedBrands += 1;
  });

  if (addedCategories > 0 || addedBrands > 0) {
    try {
      await taxonomyBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories,brands');
    }
  }

  // Resolve fallback category/brand IDs only if a product references a deleted taxonomy record
  const fallbackCategoryId = Array.from(existingCatIds)[0] || '';
  const fallbackBrandId = Array.from(existingBrandIds)[0] || '';

  // Batch 2: Missing Products & Public Settings (non-destructive)
  const productBatch = writeBatch(db);
  let addedProducts = 0;
  let skippedProducts = 0;
  const idbImageWarnings: string[] = [];

  for (const prod of sourceState.products) {
    const cleanId = sanitizeDocId(prod.id, 'prod');
    const cleanSku = prod.sku.trim().toUpperCase();
    const cleanSlug = prod.slug.trim().toLowerCase();
    if (
      existingProdIds.has(cleanId) ||
      existingProdSkus.has(cleanSku) ||
      existingProdSlugs.has(cleanSlug)
    ) {
      skippedProducts += 1;
      continue;
    }

    const srcCatSlug =
      sourceState.categories.find((c) => c.id === prod.categoryId)?.slug.toLowerCase() || '';
    const resolvedCategoryId = existingCatIds.has(prod.categoryId)
      ? prod.categoryId
      : catIdBySlug.get(srcCatSlug) || fallbackCategoryId;

    const srcSubId = prod.subcategoryId?.trim() || '';
    const srcSubSlug =
      sourceState.categories.find((c) => c.id === srcSubId)?.slug.toLowerCase() || '';
    const resolvedSubcategoryId = srcSubId
      ? existingCatIds.has(srcSubId)
        ? srcSubId
        : catIdBySlug.get(srcSubSlug) || ''
      : '';

    const srcBrandSlug =
      sourceState.brands.find((b) => b.id === prod.brandId)?.slug.toLowerCase() || '';
    const resolvedBrandId = existingBrandIds.has(prod.brandId)
      ? prod.brandId
      : brandIdBySlug.get(srcBrandSlug) || fallbackBrandId;

    if (!resolvedCategoryId || !resolvedBrandId) {
      skippedProducts += 1;
      continue;
    }

    const hasIdb = prod.images.some((img) => img.startsWith('idb://'));
    if (hasIdb) {
      idbImageWarnings.push(`${prod.name} (${cleanSku})`);
    }
    const cleanImages = prod.images
      .map((img) => img.trim())
      .filter((img) => isValidImageSource(img))
      .slice(0, MAX_PRODUCT_IMAGES);
    const primaryImage = (cleanImages[0] || '').slice(0, 500);

    const payload: Record<string, unknown> = {
      id: cleanId,
      slug: prod.slug.trim().slice(0, 160),
      name: prod.name.trim().slice(0, 200),
      brandId: resolvedBrandId,
      categoryId: resolvedCategoryId,
      sku: cleanSku.slice(0, 64),
      price: Math.max(1, Math.round(prod.price)),
      stockStatus: prod.stockStatus,
      stockCount: Math.max(0, Math.floor(prod.stockCount)),
      condition: prod.condition,
      featured: Boolean(prod.featured),
      published: prod.archived ? false : Boolean(prod.published),
      archived: Boolean(prod.archived),
      shortDescription: (prod.shortDescription.trim() || prod.name.trim()).slice(0, 400),
      description: (prod.description.trim() || prod.shortDescription.trim() || prod.name.trim()).slice(0, 5000),
      primaryImage,
      images: cleanImages,
      specs: (prod.specs || []).slice(0, 40),
      whatsInBox: (prod.whatsInBox || []).slice(0, 30),
      compatibility: (prod.compatibility || '').trim().slice(0, 1000),
      variants: (prod.variants || []).slice(0, 20),
      updatedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (resolvedSubcategoryId) {
      payload.subcategoryId = resolvedSubcategoryId;
    }

    if (typeof prod.originalPrice === 'number' && prod.originalPrice > prod.price) {
      payload.originalPrice = Math.round(prod.originalPrice);
    }
    if (
      typeof prod.discountPercentage === 'number' &&
      prod.discountPercentage > 0 &&
      prod.discountPercentage <= 99
    ) {
      payload.discountPercentage = Math.round(prod.discountPercentage);
    }

    productBatch.set(doc(db, 'products', cleanId), payload);
    existingProdIds.add(cleanId);
    existingProdSkus.add(cleanSku);
    existingProdSlugs.add(cleanSlug);
    addedProducts += 1;
  }

  let settingsInitialized = false;
  if (!publicSettingsSnap.exists()) {
    const s = sourceState.storeSettings;
    const w = sourceState.whatsappConfig;
    productBatch.set(doc(db, 'store_settings', 'public'), {
      storeName: (s.storeName.trim() || 'TechnHobbies').slice(0, 120),
      tagline: s.tagline.trim().slice(0, 200),
      cityBase: s.cityBase.trim().slice(0, 120),
      contactEmail: s.contactEmail.trim().slice(0, 254),
      socialLinks: {
        instagram: s.socialLinks.instagram.trim().slice(0, 500),
        youtube: s.socialLinks.youtube.trim().slice(0, 500),
        facebook: s.socialLinks.facebook.trim().slice(0, 500),
      },
      whatsappNumber: w.businessNumber.trim().slice(0, 20),
      defaultMessageTemplate: w.defaultMessageTemplate.trim().slice(0, 1000),
      primaryButtonLabel: w.primaryButtonLabel.trim().slice(0, 80),
      cardButtonLabel: w.cardButtonLabel.trim().slice(0, 80),
      showCardInquiryButton: Boolean(w.showCardInquiryButton),
      seoTitle: s.seoTitle.trim().slice(0, 160),
      seoDescription: s.seoDescription.trim().slice(0, 320),
      updatedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    settingsInitialized = true;
  }

  if (addedProducts > 0 || settingsInitialized) {
    try {
      await productBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products,store_settings');
    }
  }

  await savePrivateAdminSettingsToFirestore(
    sourceState.whatsappConfig.trackLocalClicks,
    uid,
    new Date().toISOString()
  );

  const authUser = { uid, email: ADMIN_EMAIL, emailVerified: true } as User;
  void ensureAdminProfileAndLog(authUser, 'CATALOG_UPDATE');

  return {
    source: combined.hasLocalBackup && mode !== 'sampleCatalog' ? 'localStorage' : 'sampleCatalog',
    addedCategories,
    skippedCategories,
    addedBrands,
    skippedBrands,
    addedProducts,
    skippedProducts,
    settingsInitialized,
    idbImageWarnings,
  };
}

export async function restoreMissingCatalogToFirestore(uid: string): Promise<MigrationReport> {
  return migrateCatalogToFirestore(uid, 'restoreCombined');
}
