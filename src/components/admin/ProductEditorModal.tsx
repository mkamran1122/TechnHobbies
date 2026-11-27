import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_CATALOG_STATE } from '../../data/sampleCatalog';
import { formatFirestoreUserMessage } from '../../firebase';
import type {
  Brand,
  Category,
  Product,
  ProductCondition,
  ProductSpec,
  ProductVariant,
  StockStatus,
  WhatsAppConfig,
} from '../../types/catalog';
import {
  getCategoryAncestors,
  getChildCategories,
  getTopLevelCategories,
} from '../../utils/categoryTree';
import { computeDiscountPercentage } from '../../utils/currency';
import {
  isValidImageSource,
  MAX_PRODUCT_IMAGES,
  MIN_PRODUCT_IMAGES,
  validateProductImageUrl,
} from '../../utils/url';
import { ProductPreviewModal } from './ProductPreviewModal';

interface ProductEditorModalProps {
  initialProduct: Product | null;
  categories: Category[];
  brands: Brand[];
  whatsappConfig?: WhatsAppConfig;
  existingSkus?: string[];
  existingSlugs?: string[];
  onSave: (product: Product) => Promise<void> | void;
  onClose: () => void;
}

type ImageLoadStatus = 'empty' | 'invalid-url' | 'loading' | 'loaded' | 'error';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface ImageSlotItem {
  id: string;
  rawUrl: string;
  loadStatus: 'loading' | 'loaded' | 'error';
  retryCount: number;
}

let imageSlotSequence = 0;
function createImageSlot(rawUrl = ''): ImageSlotItem {
  imageSlotSequence += 1;
  return {
    id: `img-slot-${Date.now()}-${imageSlotSequence}`,
    rawUrl,
    loadStatus: 'loading',
    retryCount: 0,
  };
}

function buildInitialImageSlots(initialProduct: Product | null): ImageSlotItem[] {
  if (!initialProduct) {
    return Array.from({ length: MIN_PRODUCT_IMAGES }, () => createImageSlot(''));
  }
  const validRaw = (initialProduct.images || [])
    .map((img) => img.trim())
    .filter((img) => isValidImageSource(img));
  const validPrimary =
    initialProduct.primaryImage && isValidImageSource(initialProduct.primaryImage)
      ? initialProduct.primaryImage.trim()
      : '';
  const ordered = validPrimary
    ? [validPrimary, ...validRaw.filter((img) => img !== validPrimary)]
    : validRaw;
  const deduped = Array.from(new Set(ordered)).slice(0, MAX_PRODUCT_IMAGES);
  while (deduped.length < MIN_PRODUCT_IMAGES) {
    deduped.push('');
  }
  return deduped.map((url) => createImageSlot(url));
}

interface ImageSlotPreviewProps {
  slotId: string;
  url: string;
  slotIndex: number;
  status: ImageLoadStatus;
  urlError?: string;
  retryCount: number;
  onStatusChange: (
    slotId: string,
    expectedUrl: string,
    status: 'loaded' | 'error'
  ) => void;
}

function ImageSlotPreview({
  slotId,
  url,
  slotIndex,
  status,
  urlError,
  retryCount,
  onStatusChange,
}: ImageSlotPreviewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [noReferrerAttemptKey, setNoReferrerAttemptKey] = useState<string | null>(null);
  const isExternalUrl = Boolean(url && /^https?:\/\//i.test(url));
  const attemptKey = `${slotId}::${url}::${retryCount}`;
  const useNoReferrer = noReferrerAttemptKey === attemptKey;

  useEffect(() => {
    if (!url || status !== 'loading') return;
    const img = imgRef.current;
    // Fast-path only already-decoded cached images; genuine failures are reported by <img> onError.
    if (img && img.complete && img.naturalWidth > 0) {
      onStatusChange(slotId, url, 'loaded');
    }
  }, [slotId, url, status, useNoReferrer, retryCount, onStatusChange]);

  if (status === 'empty') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
        <ImageIcon className="w-6 h-6 mb-1" strokeWidth={1.5} />
        <span className="text-[11px] font-medium">Slot {slotIndex + 1}</span>
      </div>
    );
  }

  if (status === 'invalid-url') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-700 p-2 text-center">
        <AlertCircle className="w-5 h-5 mb-1 shrink-0" />
        <span className="text-[10px] font-semibold leading-tight line-clamp-2">
          {urlError || 'Invalid URL'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-100">
      {status !== 'error' && (
        <img
          key={`${attemptKey}-${useNoReferrer ? 'noref' : 'std'}`}
          ref={imgRef}
          src={url}
          alt={`Product preview ${slotIndex + 1}`}
          referrerPolicy={useNoReferrer ? 'no-referrer' : undefined}
          onLoad={() => onStatusChange(slotId, url, 'loaded')}
          onError={() => {
            if (isExternalUrl && !useNoReferrer) {
              setNoReferrerAttemptKey(attemptKey);
              return;
            }
            onStatusChange(slotId, url, 'error');
          }}
          className={`w-full h-full object-cover transition-opacity ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mb-1" />
          <span className="text-[10px] font-medium">Loading...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 text-rose-700 p-2 text-center">
          <AlertCircle className="w-5 h-5 mb-1 shrink-0" />
          <span className="text-[10px] font-semibold leading-tight">
            Image failed to load
          </span>
        </div>
      )}
    </div>
  );
}

export function ProductEditorModal({
  initialProduct,
  categories,
  brands,
  whatsappConfig = INITIAL_CATALOG_STATE.whatsappConfig,
  existingSkus = [],
  existingSlugs = [],
  onSave,
  onClose,
}: ProductEditorModalProps) {
  const topLevelCategories = useMemo(
    () => getTopLevelCategories(categories),
    [categories]
  );

  const initialTaxonomy = useMemo(() => {
    if (!initialProduct) {
      return {
        catId: topLevelCategories[0]?.id || categories[0]?.id || '',
        subId: '',
      };
    }
    if (initialProduct.subcategoryId) {
      return {
        catId: initialProduct.categoryId,
        subId: initialProduct.subcategoryId,
      };
    }
    const directCat = categories.find((c) => c.id === initialProduct.categoryId);
    if (directCat?.parentId && categories.some((c) => c.id === directCat.parentId)) {
      const chain = getCategoryAncestors(directCat.id, categories);
      return {
        catId: chain[0]?.id || directCat.parentId,
        subId: directCat.id,
      };
    }
    return {
      catId: initialProduct.categoryId,
      subId: '',
    };
  }, [initialProduct, categories, topLevelCategories]);

  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [brandId, setBrandId] = useState(initialProduct?.brandId || brands[0]?.id || '');
  const [categoryId, setCategoryId] = useState(initialTaxonomy.catId);
  const [subcategoryId, setSubcategoryId] = useState(initialTaxonomy.subId);
  const [price, setPrice] = useState<string>(
    initialProduct ? String(initialProduct.price) : ''
  );
  const [originalPrice, setOriginalPrice] = useState<string>(
    initialProduct?.originalPrice ? String(initialProduct.originalPrice) : ''
  );
  const [discountOverride, setDiscountOverride] = useState<string>(
    initialProduct?.discountPercentage ? String(initialProduct.discountPercentage) : ''
  );
  const [stockStatus, setStockStatus] = useState<StockStatus>(
    initialProduct?.stockStatus || 'In Stock'
  );
  const [stockCount, setStockCount] = useState<string>(
    initialProduct ? String(initialProduct.stockCount) : '5'
  );
  const [condition, setCondition] = useState<ProductCondition>(
    initialProduct?.condition || 'Brand New'
  );
  const [featured, setFeatured] = useState<boolean>(initialProduct?.featured ?? false);
  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription || ''
  );
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [imageSlots, setImageSlots] = useState<ImageSlotItem[]>(() =>
    buildInitialImageSlots(initialProduct)
  );
  const [savingAction, setSavingAction] = useState<
    'draft' | 'publish' | 'unpublish' | 'archive' | 'restore' | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [specs, setSpecs] = useState<ProductSpec[]>(
    initialProduct?.specs.length ? initialProduct.specs : [{ label: '', value: '' }]
  );
  const [whatsInBoxText, setWhatsInBoxText] = useState(
    initialProduct?.whatsInBox.join('\n') || ''
  );
  const [compatibility, setCompatibility] = useState(initialProduct?.compatibility || '');
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialProduct?.variants || []
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !previewOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, previewOpen]);

  const handleImageStatusChange = useCallback(
    (slotId: string, expectedUrl: string, nextStatus: 'loaded' | 'error') => {
      setImageSlots((prev) =>
        prev.map((slot) => {
          if (slot.id !== slotId) return slot;
          const trimmed = slot.rawUrl.trim();
          const validation = trimmed ? validateProductImageUrl(trimmed) : null;
          if (!validation?.valid || validation.normalized !== expectedUrl) {
            return slot;
          }
          if (slot.loadStatus === nextStatus) return slot;
          return { ...slot, loadStatus: nextStatus };
        })
      );
    },
    []
  );

  const imageSlotMeta = useMemo(() => {
    return imageSlots.map((slot) => {
      const trimmed = slot.rawUrl.trim();
      if (!trimmed) {
        return {
          id: slot.id,
          raw: slot.rawUrl,
          trimmed: '',
          normalized: '',
          retryCount: slot.retryCount,
          status: 'empty' as ImageLoadStatus,
          error: undefined as string | undefined,
        };
      }
      const validation = validateProductImageUrl(trimmed);
      if (!validation.valid || !validation.normalized) {
        return {
          id: slot.id,
          raw: slot.rawUrl,
          trimmed,
          normalized: '',
          retryCount: slot.retryCount,
          status: 'invalid-url' as ImageLoadStatus,
          error: validation.error || 'Invalid image URL.',
        };
      }
      return {
        id: slot.id,
        raw: slot.rawUrl,
        trimmed,
        normalized: validation.normalized,
        retryCount: slot.retryCount,
        status: slot.loadStatus as ImageLoadStatus,
        error:
          slot.loadStatus === 'error'
            ? 'Image preview failed to load. Verify the URL points directly to a reachable image.'
            : undefined,
      };
    });
  }, [imageSlots]);

  const validNormalizedImages = useMemo(() => {
    const unique: string[] = [];
    for (const slot of imageSlotMeta) {
      if (slot.normalized && !unique.includes(slot.normalized)) {
        unique.push(slot.normalized);
      }
    }
    return unique;
  }, [imageSlotMeta]);

  const isLegacyPublishedProduct = Boolean(
    initialProduct &&
      initialProduct.published &&
      !initialProduct.archived &&
      initialProduct.images.filter((img) => isValidImageSource(img)).length >= 1 &&
      initialProduct.images.filter((img) => isValidImageSource(img)).length <
        MIN_PRODUCT_IMAGES
  );

  const numericPrice = Math.max(0, Number(price) || 0);
  const numericOriginal = Number(originalPrice) > 0 ? Number(originalPrice) : undefined;
  const computedDiscount = computeDiscountPercentage(numericPrice, numericOriginal);

  const handleUpdateImageField = (slotId: string, nextValue: string) => {
    setFormError(null);
    setImageSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot;
        const urlChanged = slot.rawUrl.trim() !== nextValue.trim();
        return {
          ...slot,
          rawUrl: nextValue,
          loadStatus: urlChanged ? 'loading' : slot.loadStatus,
        };
      })
    );
  };

  const handleRetryImagePreview = (slotId: string) => {
    setFormError(null);
    setImageSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              loadStatus: 'loading',
              retryCount: slot.retryCount + 1,
            }
          : slot
      )
    );
  };

  const handleAddImageField = () => {
    setImageSlots((prev) => {
      if (prev.length >= MAX_PRODUCT_IMAGES) return prev;
      return [...prev, createImageSlot('')];
    });
  };

  const handleRemoveImageField = (slotId: string) => {
    setFormError(null);
    setImageSlots((prev) => {
      if (prev.length > MIN_PRODUCT_IMAGES) {
        return prev.filter((slot) => slot.id !== slotId);
      }
      return prev.map((slot) =>
        slot.id === slotId
          ? { ...slot, rawUrl: '', loadStatus: 'loading', retryCount: 0 }
          : slot
      );
    });
  };

  const handleMoveImageField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= imageSlots.length) return;
    setImageSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSetPrimaryField = (index: number) => {
    if (index <= 0 || index >= imageSlots.length) return;
    setImageSlots((prev) => {
      const next = [...prev];
      const [selected] = next.splice(index, 1);
      return [selected, ...next];
    });
  };

  const buildDraftProduct = (publishedFlag: boolean, archivedFlag: boolean): Product => {
    const cleanName = name.trim();
    const cleanSku = sku.trim().toUpperCase();
    const finalSlug = slug.trim() || slugify(cleanName);
    const cleanSpecs = specs.filter((s) => s.label.trim() && s.value.trim());
    const cleanBox = whatsInBoxText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const cleanVariants = variants.filter((v) => v.label.trim());

    const explicitDiscount = Number(discountOverride);
    const finalDiscount =
      explicitDiscount > 0 ? explicitDiscount : computedDiscount;

    const cleanSubcategoryId =
      subcategoryId && categories.some((c) => c.id === subcategoryId)
        ? subcategoryId
        : undefined;

    return {
      id: initialProduct?.id || `prod-${Date.now()}`,
      slug: finalSlug,
      name: cleanName,
      brandId,
      categoryId,
      ...(cleanSubcategoryId ? { subcategoryId: cleanSubcategoryId } : {}),
      sku: cleanSku,
      price: numericPrice,
      originalPrice:
        numericOriginal && numericOriginal > numericPrice ? numericOriginal : undefined,
      discountPercentage: finalDiscount,
      stockStatus,
      stockCount: Math.max(0, Number(stockCount) || 0),
      condition,
      featured,
      published: archivedFlag ? false : publishedFlag,
      archived: archivedFlag,
      shortDescription: shortDescription.trim() || cleanName,
      description: description.trim() || shortDescription.trim(),
      primaryImage: validNormalizedImages[0] || '',
      images: validNormalizedImages,
      specs: cleanSpecs,
      whatsInBox: cleanBox,
      compatibility: compatibility.trim() || 'Confirm compatibility via WhatsApp inquiry.',
      variants: cleanVariants,
      createdAt: initialProduct?.createdAt,
      updatedAt: new Date().toISOString(),
    };
  };

  const validateForSave = (targetState: 'draft' | 'publish' | 'unpublish' | 'archive' | 'restore'): string | null => {
    const cleanName = name.trim();
    const cleanSku = sku.trim().toUpperCase();
    const finalSlug = slug.trim() || slugify(cleanName);

    if (!cleanName) {
      return 'Product name is required.';
    }
    if (!cleanSku) {
      return 'SKU is required.';
    }
    if (!finalSlug) {
      return 'URL slug is required.';
    }
    if (!categories.some((c) => c.id === categoryId)) {
      return 'Please select a valid category before saving.';
    }
    if (!brands.some((b) => b.id === brandId)) {
      return 'Please select a valid brand before saving.';
    }
    const normalizedExistingSkus = existingSkus.map((s) => s.trim().toUpperCase());
    const initialSkuNormalized = initialProduct?.sku.trim().toUpperCase();
    if (
      normalizedExistingSkus.includes(cleanSku) &&
      cleanSku !== initialSkuNormalized
    ) {
      return `SKU "${cleanSku}" is already assigned to another product.`;
    }
    const normalizedExistingSlugs = existingSlugs.map((s) => s.trim().toLowerCase());
    const initialSlugNormalized = initialProduct?.slug.trim().toLowerCase();
    if (
      normalizedExistingSlugs.includes(finalSlug.toLowerCase()) &&
      finalSlug.toLowerCase() !== initialSlugNormalized
    ) {
      return `URL slug "${finalSlug}" is already assigned to another product.`;
    }
    if (numericPrice <= 0) {
      return 'Selling price must be greater than 0 PKR.';
    }
    if (numericOriginal !== undefined && numericOriginal <= numericPrice) {
      return 'Original price must be higher than the selling price, or leave it blank.';
    }

    const invalidSlot = imageSlotMeta.find((s) => s.status === 'invalid-url');
    if (invalidSlot) {
      return `Image Slot ${imageSlotMeta.indexOf(invalidSlot) + 1}: ${invalidSlot.error}`;
    }

    const brokenSlot = imageSlotMeta.find((s) => s.status === 'error');
    if (brokenSlot) {
      return `Image Slot ${imageSlotMeta.indexOf(brokenSlot) + 1} could not be loaded. Fix or remove that URL before saving.`;
    }

    const loadingSlot = imageSlotMeta.find((s) => s.status === 'loading');
    if (loadingSlot) {
      return `Image Slot ${imageSlotMeta.indexOf(loadingSlot) + 1} is still verifying. Please wait a moment for the live preview to load.`;
    }

    if (targetState === 'publish') {
      const requiredCount = isLegacyPublishedProduct ? 1 : MIN_PRODUCT_IMAGES;
      if (validNormalizedImages.length < requiredCount) {
        return `Publishing requires at least ${MIN_PRODUCT_IMAGES} unique valid product image URLs (currently ${validNormalizedImages.length}). Add more URLs or save as Draft.`;
      }
    }

    return null;
  };

  const executeSave = async (
    targetState: 'draft' | 'publish' | 'unpublish' | 'archive' | 'restore'
  ) => {
    if (savingAction) return;
    setFormError(null);

    const validationError = validateForSave(targetState);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const nextPublished = targetState === 'publish';
    const nextArchived = targetState === 'archive';
    const productPayload = buildDraftProduct(nextPublished, nextArchived);

    setSavingAction(targetState);
    try {
      await onSave(productPayload);
    } catch (err) {
      setFormError(formatFirestoreUserMessage(err));
    } finally {
      setSavingAction(null);
    }
  };

  const currentStatusBadge = initialProduct?.archived
    ? { label: 'Archived', classes: 'bg-amber-100 text-amber-900 border-amber-200' }
    : initialProduct?.published
      ? { label: 'Published (Live)', classes: 'bg-emerald-100 text-emerald-900 border-emerald-200' }
      : { label: 'Draft / Unpublished', classes: 'bg-slate-100 text-slate-700 border-slate-200' };

  const previewPublishError = validateForSave('publish');

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92dvh] flex flex-col shadow-xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 shrink-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                {initialProduct ? `Edit Product · ${initialProduct.sku}` : 'Add New Product'}
              </h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${currentStatusBadge.classes}`}
              >
                {currentStatusBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 min-h-[40px] text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close editor"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void executeSave(initialProduct?.published ? 'publish' : 'draft');
            }}
            className="overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1"
          >
            {formError && (
              <div
                role="alert"
                className="text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Core Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!initialProduct) {
                      setSlug(slugify(e.target.value));
                    }
                  }}
                  placeholder="e.g. RadioMaster TX16S Mark II ELRS"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="TH-RAD-1602"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="radiomaster-tx16s-mk2"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    const nextCatId = e.target.value;
                    setCategoryId(nextCatId);
                    const validChildren = getChildCategories(nextCatId, categories);
                    if (!validChildren.some((sub) => sub.id === subcategoryId)) {
                      setSubcategoryId('');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {!topLevelCategories.some((cat) => cat.id === categoryId) && (
                    <option value="">Select Category</option>
                  )}
                  {topLevelCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subcategory (Optional)
                </label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="">
                    {getChildCategories(categoryId, categories).length > 0
                      ? 'None (Top-level category only)'
                      : 'No subcategories configured'}
                  </option>
                  {getChildCategories(categoryId, categories).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand *</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {!brands.some((b) => b.id === brandId) && (
                    <option value="">Select Brand</option>
                  )}
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* PKR Pricing & Stock */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="18500"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Original Price (PKR, Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="21000"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount % (Auto: {computedDiscount ? `${computedDiscount}%` : 'None'})
                </label>
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={discountOverride}
                  onChange={(e) => setDiscountOverride(e.target.value)}
                  placeholder={computedDiscount ? String(computedDiscount) : '0'}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stock Availability
                </label>
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Limited Stock">Limited Stock</option>
                  <option value="Pre-Order">Pre-Order</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={stockCount}
                  onChange={(e) => setStockCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ProductCondition)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="Brand New">Brand New</option>
                  <option value="Open Box">Open Box</option>
                  <option value="Refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            {/* Featured Flag */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span>Mark as Featured Product on Homepage Showcase</span>
              </label>
            </div>

            {/* URL-Based Product Image Management (4 to 8 URLs) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">
                    Product Image URLs ({MIN_PRODUCT_IMAGES}–{MAX_PRODUCT_IMAGES} images supported)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Paste direct <code className="font-mono">https://</code> or{' '}
                    <code className="font-mono">/assets/...</code> image URLs. Minimum{' '}
                    <strong>{MIN_PRODUCT_IMAGES}</strong> valid images required to publish (
                    <span className="font-mono">{validNormalizedImages.length}/{MAX_PRODUCT_IMAGES}</span>{' '}
                    added). The Primary image is used as the product card thumbnail.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={imageSlots.length >= MAX_PRODUCT_IMAGES}
                  onClick={handleAddImageField}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Image URL</span>
                </button>
              </div>

              {isLegacyPublishedProduct && validNormalizedImages.length < MIN_PRODUCT_IMAGES && (
                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This existing published product currently has {validNormalizedImages.length} image(s).
                  Adding at least {MIN_PRODUCT_IMAGES} image URLs is recommended for the storefront gallery.
                </div>
              )}

              <div className="space-y-2.5">
                {imageSlotMeta.map((slot, idx) => {
                  const isPrimary = idx === 0;
                  const canSetPrimary = idx > 0 && Boolean(slot.normalized);

                  return (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isPrimary
                          ? 'bg-orange-50/40 border-orange-300'
                          : slot.status === 'invalid-url' || slot.status === 'error'
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        {/* Live Preview Box */}
                        <div className="w-full sm:w-28 aspect-[4/3] rounded-md overflow-hidden border border-slate-200 bg-white shrink-0">
                          <ImageSlotPreview
                            slotId={slot.id}
                            url={slot.normalized}
                            slotIndex={idx}
                            status={slot.status}
                            urlError={slot.error}
                            retryCount={slot.retryCount}
                            onStatusChange={handleImageStatusChange}
                          />
                        </div>

                        {/* URL Input & Actions */}
                        <div className="flex-1 min-w-0 w-full space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700">
                                Image {idx + 1}
                              </span>
                              {isPrimary && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-orange-600 text-white rounded">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  <span>Primary Thumbnail</span>
                                </span>
                              )}
                              {slot.status === 'loaded' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verified</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveImageField(idx, -1)}
                                aria-label={`Move image ${idx + 1} up`}
                                title="Move up"
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:text-slate-300 bg-white border border-slate-200 rounded-md"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === imageSlotMeta.length - 1}
                                onClick={() => handleMoveImageField(idx, 1)}
                                aria-label={`Move image ${idx + 1} down`}
                                title="Move down"
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:text-slate-300 bg-white border border-slate-200 rounded-md"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              {!isPrimary && (
                                <button
                                  type="button"
                                  disabled={!canSetPrimary}
                                  onClick={() => handleSetPrimaryField(idx)}
                                  title="Designate as primary thumbnail"
                                  aria-label={`Set image ${idx + 1} as primary`}
                                  className="inline-flex items-center gap-1 px-2.5 min-h-[36px] text-xs font-semibold text-orange-700 bg-white border border-orange-200 hover:bg-orange-50 disabled:opacity-40 rounded-md"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  <span>Set Primary</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={
                                  imageSlots.length <= MIN_PRODUCT_IMAGES && !slot.trimmed
                                }
                                onClick={() => handleRemoveImageField(slot.id)}
                                aria-label={`Remove image ${idx + 1}`}
                                title={
                                  imageSlots.length > MIN_PRODUCT_IMAGES
                                    ? 'Remove image field'
                                    : 'Clear image URL'
                                }
                                className="inline-flex items-center gap-1 px-2.5 min-h-[36px] text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 disabled:opacity-40 rounded-md"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>
                                  {imageSlots.length > MIN_PRODUCT_IMAGES ? 'Remove' : 'Clear'}
                                </span>
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={slot.raw}
                            onChange={(e) => handleUpdateImageField(slot.id, e.target.value)}
                            placeholder={
                              isPrimary
                                ? 'https://example.com/product-main.jpg (Primary thumbnail)'
                                : `https://example.com/product-angle-${idx + 1}.jpg`
                            }
                            className="w-full px-3 min-h-[42px] text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />

                          {(slot.status === 'invalid-url' || slot.status === 'error') && slot.error && (
                            <div role="alert" className="flex flex-wrap items-center gap-2 text-xs font-medium text-rose-700">
                              <span>{slot.error}</span>
                              {slot.status === 'error' && slot.normalized && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryImagePreview(slot.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Descriptions */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Summary
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One-line highlight shown on product cards"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Product Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description, performance notes, and field capabilities..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Technical Specifications
                </label>
                <button
                  type="button"
                  onClick={() => setSpecs((prev) => [...prev, { label: '', value: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Spec Row</span>
                </button>
              </div>
              <div className="space-y-2">
                {specs.map((spec, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={spec.label}
                      onChange={(e) =>
                        setSpecs((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                        )
                      }
                      placeholder="Spec name (e.g. Motor KV)"
                      className="sm:col-span-5 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={spec.value}
                      onChange={(e) =>
                        setSpecs((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, value: e.target.value } : row))
                        )
                      }
                      placeholder="Value (e.g. 2050KV 4-Pole Brushless)"
                      className="sm:col-span-6 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove spec row"
                      className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Variants */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Product Variants (Optional)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setVariants((prev) => [
                      ...prev,
                      {
                        id: `var-${Date.now()}`,
                        group: 'Option',
                        label: '',
                        priceDelta: 0,
                        skuSuffix: '',
                        inStock: true,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variant</span>
                </button>
              </div>
              {variants.map((variant, idx) => (
                <div
                  key={variant.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 sm:p-0 bg-slate-50/70 sm:bg-transparent border border-slate-200 sm:border-0 rounded-lg"
                >
                  <input
                    type="text"
                    value={variant.group}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((v, i) => (i === idx ? { ...v, group: e.target.value } : v))
                      )
                    }
                    placeholder="Group"
                    className="sm:col-span-2 px-2.5 min-h-[44px] sm:min-h-0 sm:py-1.5 text-base sm:text-xs bg-white sm:bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={variant.label}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((v, i) => (i === idx ? { ...v, label: e.target.value } : v))
                      )
                    }
                    placeholder="Variant Label (e.g. ELRS 2.4GHz)"
                    className="sm:col-span-4 px-2.5 min-h-[44px] sm:min-h-0 sm:py-1.5 text-base sm:text-xs bg-white sm:bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 sm:contents gap-2">
                    <input
                      type="number"
                      value={variant.priceDelta}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((v, i) =>
                            i === idx ? { ...v, priceDelta: Number(e.target.value) || 0 } : v
                          )
                        )
                      }
                      placeholder="+PKR"
                      className="sm:col-span-2 px-2.5 min-h-[44px] sm:min-h-0 sm:py-1.5 text-base sm:text-xs font-mono bg-white sm:bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={variant.skuSuffix}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((v, i) => (i === idx ? { ...v, skuSuffix: e.target.value } : v))
                        )
                      }
                      placeholder="-ELRS"
                      className="sm:col-span-2 px-2.5 min-h-[44px] sm:min-h-0 sm:py-1.5 text-base sm:text-xs font-mono bg-white sm:bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:contents">
                    <label className="sm:col-span-1 inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 text-xs sm:text-[11px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={variant.inStock}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((v, i) => (i === idx ? { ...v, inStock: e.target.checked } : v))
                          )
                        }
                        className="w-5 h-5 sm:w-4 sm:h-4 rounded border-slate-300 text-orange-600"
                      />
                      <span>Stock</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove variant"
                      className="sm:col-span-1 inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Box Contents & Compatibility */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  What&apos;s Included in Box (1 item per line)
                </label>
                <textarea
                  rows={3}
                  value={whatsInBoxText}
                  onChange={(e) => setWhatsInBoxText(e.target.value)}
                  placeholder="Main Unit&#10;Transmitter&#10;Manual"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Compatibility Information
                </label>
                <textarea
                  rows={3}
                  value={compatibility}
                  onChange={(e) => setCompatibility(e.target.value)}
                  placeholder="Supported LiPo cells, connectors, or receivers..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Publishing Workflow Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Before Publishing</span>
                </button>

                {initialProduct && !initialProduct.archived && initialProduct.published && (
                  <button
                    type="button"
                    disabled={Boolean(savingAction)}
                    onClick={() => void executeSave('unpublish')}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span>{savingAction === 'unpublish' ? 'Unpublishing...' : 'Unpublish (Draft)'}</span>
                  </button>
                )}

                {initialProduct && !initialProduct.archived && (
                  <button
                    type="button"
                    disabled={Boolean(savingAction)}
                    onClick={() => void executeSave('archive')}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    <span>{savingAction === 'archive' ? 'Archiving...' : 'Archive'}</span>
                  </button>
                )}

                {initialProduct?.archived && (
                  <button
                    type="button"
                    disabled={Boolean(savingAction)}
                    onClick={() => void executeSave('restore')}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{savingAction === 'restore' ? 'Restoring...' : 'Restore as Draft'}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={onClose}
                  className="px-4 py-2 min-h-[44px] text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                {(!initialProduct || !initialProduct.published || initialProduct.archived) && (
                  <button
                    type="button"
                    disabled={Boolean(savingAction)}
                    onClick={() => void executeSave('draft')}
                    className="px-4 py-2 min-h-[44px] text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-60 rounded-lg"
                  >
                    {savingAction === 'draft' ? 'Saving Draft...' : 'Save as Draft'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={Boolean(savingAction)}
                  onClick={() => void executeSave('publish')}
                  className="px-5 py-2 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60 rounded-lg"
                >
                  {savingAction === 'publish'
                    ? 'Publishing...'
                    : initialProduct?.published && !initialProduct.archived
                      ? 'Save & Keep Published'
                      : 'Publish Immediately'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {previewOpen && (
        <ProductPreviewModal
          product={buildDraftProduct(
            Boolean(initialProduct?.published && !initialProduct?.archived),
            Boolean(initialProduct?.archived)
          )}
          brand={brands.find((b) => b.id === brandId)}
          category={categories.find((c) => c.id === (subcategoryId || categoryId))}
          whatsappConfig={whatsappConfig}
          onClose={() => setPreviewOpen(false)}
          onPublish={async () => {
            setPreviewOpen(false);
            await executeSave('publish');
          }}
          publishDisabledReason={previewPublishError || undefined}
        />
      )}
    </>
  );
}
