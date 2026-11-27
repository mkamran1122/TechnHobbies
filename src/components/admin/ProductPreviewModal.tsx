import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  EyeOff,
  MessageCircle,
  PackageCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildProductInquiryMessage } from '../../config/whatsapp';
import type { Brand, Category, Product, WhatsAppConfig } from '../../types/catalog';
import { computeDiscountPercentage, formatPKR } from '../../utils/currency';
import { getEffectiveStockStatus } from '../../utils/stock';
import { isValidImageSource } from '../../utils/url';
import { ResilientImage } from '../ResilientImage';

interface ProductPreviewModalProps {
  product: Product;
  brand?: Brand;
  category?: Category;
  whatsappConfig: WhatsAppConfig;
  onClose: () => void;
  onPublish?: () => Promise<void> | void;
  publishDisabledReason?: string;
}

export function ProductPreviewModal({
  product,
  brand,
  category,
  whatsappConfig,
  onClose,
  onPublish,
  publishDisabledReason,
}: ProductPreviewModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants.find((v) => v.inStock)?.id || product.variants[0]?.id || ''
  );
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const galleryImages = useMemo(() => {
    const validRaw = product.images
      .map((img) => img.trim())
      .filter((img) => isValidImageSource(img));
    const validPrimary =
      product.primaryImage && isValidImageSource(product.primaryImage)
        ? product.primaryImage.trim()
        : '';
    const ordered = validPrimary
      ? [validPrimary, ...validRaw.filter((img) => img !== validPrimary)]
      : validRaw;
    return Array.from(new Set(ordered));
  }, [product.images, product.primaryImage]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedVariantId(
      product.variants.find((v) => v.inStock)?.id || product.variants[0]?.id || ''
    );
  }, [product]);

  const activeVariant = product.variants.find((v) => v.id === selectedVariantId);
  const effectivePrice = product.price + (activeVariant?.priceDelta || 0);
  const effectiveOriginalPrice = product.originalPrice
    ? product.originalPrice + (activeVariant?.priceDelta || 0)
    : undefined;
  const effectiveSku = activeVariant
    ? `${product.sku}${activeVariant.skuSuffix}`
    : product.sku;
  const discount =
    computeDiscountPercentage(effectivePrice, effectiveOriginalPrice) ||
    product.discountPercentage;
  const effectiveStock = getEffectiveStockStatus(product);

  const previewUrl = `${window.location.origin}/product/${encodeURIComponent(
    product.slug || 'preview'
  )}`;
  const whatsappPreviewMessage = buildProductInquiryMessage(
    {
      productName: product.name || 'Untitled Product',
      sku: effectiveSku || 'SKU',
      price: effectivePrice,
      productUrl: previewUrl,
      variantLabel: activeVariant?.label,
    },
    whatsappConfig.defaultMessageTemplate
  );

  const statusMeta = product.archived
    ? {
        label: 'Archived — Hidden from Storefront',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
        Icon: Archive,
      }
    : product.published
      ? {
          label: 'Published — Live on Storefront',
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
          Icon: Eye,
        }
      : {
          label: 'Draft — Unpublished Preview Only',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          Icon: EyeOff,
        };

  const StatusIcon = statusMeta.Icon;

  const stockColor =
    effectiveStock === 'In Stock'
      ? 'text-emerald-700'
      : effectiveStock === 'Out of Stock'
        ? 'text-rose-700'
        : 'text-amber-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Storefront preview for ${product.name}`}
    >
      <div className="bg-slate-50 border border-slate-200 rounded-xl max-w-5xl w-full max-h-[92dvh] flex flex-col shadow-xl overflow-hidden">
        {/* Preview Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${statusMeta.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{statusMeta.label}</span>
            </span>
            <p className="text-xs text-slate-500 truncate">
              {category?.name || 'Uncategorized'} · {brand?.name || 'TechnHobbies'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onPublish && !product.published && (
              <button
                type="button"
                disabled={Boolean(publishDisabledReason) || publishing}
                title={publishDisabledReason || 'Publish product to live storefront'}
                onClick={async () => {
                  if (publishDisabledReason || publishing) return;
                  setPublishing(true);
                  try {
                    await onPublish();
                  } finally {
                    setPublishing(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 disabled:text-slate-600 rounded-lg"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{publishing ? 'Publishing...' : 'Publish to Storefront'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product preview"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {publishDisabledReason && !product.published && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{publishDisabledReason}</span>
            </div>
          )}

          {/* Product Detail Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Gallery Preview */}
            <div className="lg:col-span-7 space-y-2.5 min-w-0">
              <div className="relative aspect-[4/3] w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                <ResilientImage
                  src={galleryImages[selectedImageIndex] || galleryImages[0]}
                  alt={product.name || 'Product preview'}
                  fallbackLabel={product.name || 'No Valid Images Yet'}
                  className="w-full h-full object-cover"
                  priority
                />
                {galleryImages.length > 0 && selectedImageIndex === 0 && (
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-orange-600 text-white rounded">
                    Primary Thumbnail
                  </span>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={`${img}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      aria-label={`Preview gallery image ${idx + 1}`}
                      className={`relative aspect-[4/3] rounded-md overflow-hidden border bg-slate-100 ${
                        selectedImageIndex === idx
                          ? 'border-orange-600 ring-2 ring-orange-600/20'
                          : 'border-slate-200 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <ResilientImage
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing & Variants Preview */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 min-w-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-orange-700">
                    {brand?.name || 'TechnHobbies'}
                  </span>
                  <span className="font-mono text-slate-500">
                    SKU: {effectiveSku || '—'}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 leading-snug">
                  {product.name || 'Untitled Product'}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {product.shortDescription || 'No short summary provided.'}
                </p>
              </div>

              <div className="py-3 border-y border-slate-200 space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {formatPKR(effectivePrice)}
                  </span>
                  {discount && (
                    <span className="text-xs font-semibold text-orange-700">
                      Save {discount}%
                    </span>
                  )}
                </div>
                {effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice && (
                  <p className="text-xs text-slate-500">
                    Original Price:{' '}
                    <span className="line-through font-mono">
                      {formatPKR(effectiveOriginalPrice)}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {effectiveStock === 'In Stock' ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>In Stock ({product.stockCount} available)</span>
                  </span>
                ) : effectiveStock === 'Out of Stock' ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-rose-800">
                    <XCircle className="w-4 h-4 text-rose-700" />
                    <span>Out of Stock — Inquire for Restock</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>
                      {effectiveStock} ({product.stockCount})
                    </span>
                  </span>
                )}
                <span className="font-medium text-slate-600">
                  Condition: <strong className="text-slate-900">{product.condition}</strong>
                </span>
              </div>

              {product.variants.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Select {product.variants[0].group}
                  </p>
                  <div className="space-y-1.5">
                    {product.variants.map((variant) => {
                      const isSelected = variant.id === activeVariant?.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={!variant.inStock}
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs text-left ${
                            !variant.inStock
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : isSelected
                                ? 'border-slate-900 bg-slate-900 text-white font-medium'
                                : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <span>
                            {variant.label}
                            {!variant.inStock ? ' (Out of Stock)' : ''}
                          </span>
                          <span className="font-mono tabular-nums">
                            {variant.priceDelta > 0
                              ? `+${formatPKR(variant.priceDelta)}`
                              : 'Included'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold opacity-95">
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {effectiveStock === 'Out of Stock'
                      ? 'INQUIRE RESTOCK ON WHATSAPP'
                      : whatsappConfig.primaryButtonLabel || 'Contact on WhatsApp'}
                  </span>
                </div>
                <pre className="bg-slate-900 text-slate-100 font-mono text-[11px] p-2.5 rounded-lg whitespace-pre-wrap break-words leading-relaxed">
                  {whatsappPreviewMessage}
                </pre>
              </div>
            </div>
          </div>

          {/* Description, Specs & Storefront Card Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Product Description
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {product.description || product.shortDescription || 'No full description added yet.'}
                </p>
              </div>

              {product.specs.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Technical Specifications
                  </h3>
                  <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
                    {product.specs.map((spec, idx) => (
                      <div key={idx} className="py-2 grid grid-cols-1 sm:grid-cols-12 gap-1">
                        <dt className="sm:col-span-5 text-slate-500 font-medium">{spec.label}</dt>
                        <dd className="sm:col-span-7 text-slate-900 font-medium">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-orange-600" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      What&apos;s Included in the Box
                    </h3>
                  </div>
                  {product.whatsInBox.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
                      {product.whatsInBox.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No box items listed.</p>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-orange-600" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Compatibility
                    </h3>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {product.compatibility || 'Confirm compatibility via WhatsApp inquiry.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Storefront Grid Card Preview */}
            <div className="lg:col-span-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Shop Card Preview
              </p>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col max-w-[260px]">
                <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                  <ResilientImage
                    src={galleryImages[0]}
                    alt={product.name || 'Card thumbnail'}
                    fallbackLabel={product.name || 'Product'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.4em]">
                    {product.name || 'Untitled Product'}
                  </h4>
                  <p className="text-base font-bold text-slate-900 font-mono tabular-nums">
                    {formatPKR(product.price)}
                  </p>
                  <p className={`text-xs font-medium ${stockColor}`}>{effectiveStock}</p>
                  {whatsappConfig.showCardInquiryButton && (
                    <div className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-emerald-600 text-white text-xs font-semibold">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
