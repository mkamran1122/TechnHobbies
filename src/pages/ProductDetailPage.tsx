import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  Maximize2,
  PackageCheck,
  Share2,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { WhatsAppInquiryButton } from '../components/WhatsAppInquiryButton';
import { buildProductInquiryMessage } from '../config/whatsapp';
import type { Brand, Category, Product, WhatsAppConfig } from '../types/catalog';
import { getCategoryAncestors } from '../utils/categoryTree';
import { computeDiscountPercentage, formatPKR } from '../utils/currency';
import { getEffectiveStockStatus } from '../utils/stock';
import { isValidImageSource } from '../utils/url';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  categories?: Category[];
  brand?: Brand;
  category?: Category;
  whatsappConfig: WhatsAppConfig;
  onBackToShop: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectBrand: (brandId: string) => void;
  onSelectProduct: (slug: string) => void;
  onTrackWhatsAppClick: (payload: {
    productId: string;
    productName: string;
    sku: string;
    price: number;
    source: 'pdp' | 'card' | 'general';
  }) => void;
  onUnconfiguredWhatsApp: (previewMessage: string) => void;
}

export function ProductDetailPage({
  product,
  allProducts,
  categories = [],
  brand,
  category,
  whatsappConfig,
  onBackToShop,
  onSelectCategory,
  onSelectBrand,
  onSelectProduct,
  onTrackWhatsAppClick,
  onUnconfiguredWhatsApp,
}: ProductDetailPageProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants.find((v) => v.inStock)?.id || product.variants[0]?.id || ''
  );
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const galleryImages = (() => {
    const validRaw = product.images.map((img) => img.trim()).filter((img) => isValidImageSource(img));
    const validPrimary =
      product.primaryImage && isValidImageSource(product.primaryImage)
        ? product.primaryImage.trim()
        : '';
    const ordered = validPrimary
      ? [validPrimary, ...validRaw.filter((img) => img !== validPrimary)]
      : validRaw;
    return Array.from(new Set(ordered));
  })();

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedVariantId(
      product.variants.find((v) => v.inStock)?.id || product.variants[0]?.id || ''
    );
    setShowMessagePreview(false);
    setLightboxOpen(false);
    setIsZoomed(false);
    setLinkCopied(false);
  }, [product.id, product.variants]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft' && galleryImages.length > 1) {
        setSelectedImageIndex((prev) =>
          prev === 0 ? galleryImages.length - 1 : prev - 1
        );
        setIsZoomed(false);
      } else if (e.key === 'ArrowRight' && galleryImages.length > 1) {
        setSelectedImageIndex((prev) =>
          prev === galleryImages.length - 1 ? 0 : prev + 1
        );
        setIsZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, galleryImages.length]);

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

  const productUrl = `${window.location.origin}/product/${encodeURIComponent(product.slug)}`;
  const previewMessage = buildProductInquiryMessage(
    {
      productName: product.name,
      sku: effectiveSku,
      price: effectivePrice,
      productUrl,
      variantLabel: activeVariant?.label,
    },
    whatsappConfig.defaultMessageTemplate
  );

  const breadcrumbCategories = (() => {
    const subCategory = product.subcategoryId
      ? categories.find((c) => c.id === product.subcategoryId)
      : undefined;
    const leafCategory = subCategory || category;
    if (!leafCategory) return [];
    const chain = getCategoryAncestors(leafCategory.id, categories);
    if (chain.length > 0) {
      if (category && !chain.some((c) => c.id === category.id)) {
        return [category, ...chain];
      }
      return chain;
    }
    return category ? [category] : [];
  })();

  const relatedProducts = allProducts
    .filter((p) => p.published && !p.archived && p.id !== product.id)
    .sort((a, b) => {
      const aSameSub =
        product.subcategoryId && a.subcategoryId === product.subcategoryId ? 0 : 1;
      const bSameSub =
        product.subcategoryId && b.subcategoryId === product.subcategoryId ? 0 : 1;
      if (aSameSub !== bSameSub) return aSameSub - bSameSub;
      const aSameCat = a.categoryId === product.categoryId ? 0 : 1;
      const bSameCat = b.categoryId === product.categoryId ? 0 : 1;
      return aSameCat - bSameCat;
    })
    .slice(0, 4);

  const renderStockStatus = () => {
    if (effectiveStock === 'In Stock') {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            In Stock ({product.stockCount > 0 ? `${product.stockCount} available` : 'Ready'})
          </span>
        </span>
      );
    }
    if (effectiveStock === 'Out of Stock') {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-800">
          <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>Out of Stock — Inquire for Restock</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          {effectiveStock}
          {product.stockCount > 0 ? ` (${product.stockCount} remaining)` : ''}
        </span>
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-12">
      {/* Breadcrumb Navigation */}
      <nav
        className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto no-scrollbar whitespace-nowrap"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          onClick={onBackToShop}
          className="inline-flex items-center gap-1 min-h-[44px] pr-1.5 font-medium text-slate-700 hover:text-slate-900 shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Shop</span>
        </button>
        {breadcrumbCategories.map((crumbCat) => (
          <div key={crumbCat.id} className="inline-flex items-center gap-1.5 shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => onSelectCategory(crumbCat.id)}
              className="min-h-[44px] px-1 hover:text-slate-900 shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
            >
              {crumbCat.name}
            </button>
          </div>
        ))}
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-900 font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-10 items-start">
        {/* Product Image Gallery */}
        <div className="lg:col-span-7 space-y-2.5 sm:space-y-3 lg:sticky lg:top-24 min-w-0">
          <div className="relative aspect-[4/3] w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden group">
            {galleryImages.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setLightboxOpen(true);
                  }}
                  aria-label={`Zoom ${product.name} image ${selectedImageIndex + 1}`}
                  className="block w-full h-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-orange-600"
                >
                  <ResilientImage
                    src={galleryImages[selectedImageIndex] || galleryImages[0]}
                    alt={`${product.name} view ${selectedImageIndex + 1}`}
                    fallbackLabel={product.name}
                    sizes="(max-width: 1023px) 100vw, 58vw"
                    className="w-full h-full object-cover"
                    priority
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setLightboxOpen(true);
                  }}
                  aria-label="Open full-screen image zoom"
                  className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-white bg-slate-950/75 hover:bg-slate-950 rounded-md shadow-xs"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Zoom</span>
                </button>
              </>
            ) : (
              <ResilientImage
                src={undefined}
                alt={product.name}
                fallbackLabel={product.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`aspect-[4/3] min-h-[44px] rounded-md overflow-hidden border bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600 ${
                    selectedImageIndex === idx
                      ? 'border-orange-600 ring-2 ring-orange-600/20'
                      : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <ResilientImage
                    src={img}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    sizes="120px"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Pricing, Variants, Availability & WhatsApp CTA */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-3.5 sm:p-6 space-y-4 sm:space-y-5 min-w-0">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {brand ? (
                <button
                  type="button"
                  onClick={() => onSelectBrand(brand.id)}
                  className="font-semibold uppercase tracking-wider text-orange-700 hover:underline py-1 min-h-[32px]"
                >
                  {brand.name}
                </button>
              ) : (
                <span className="font-semibold uppercase tracking-wider text-orange-700">
                  TechnHobbies
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 break-all">SKU: {effectiveSku}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const shareUrl = window.location.href;
                    try {
                      if (navigator.share) {
                        await navigator.share({
                          title: product.name,
                          text: `${product.name} – ${formatPKR(effectivePrice)}`,
                          url: shareUrl,
                        });
                        return;
                      }
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(shareUrl);
                        setLinkCopied(true);
                        window.setTimeout(() => setLinkCopied(false), 2500);
                      }
                    } catch {
                      // Ignore user-cancelled share sheet
                    }
                  }}
                  aria-label="Share product link"
                  className="inline-flex items-center gap-1 px-2 py-1 min-h-[32px] text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {product.name}
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">{product.shortDescription}</p>
          </div>

          {/* PKR Price */}
          <div className="py-3 sm:py-3.5 border-y border-slate-200 space-y-1">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums">
                {formatPKR(effectivePrice)}
              </span>
              {discount && (
                <span className="text-xs sm:text-sm font-semibold text-orange-700 tabular-nums">
                  Save {discount}%
                </span>
              )}
            </div>
            {effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice && (
              <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
                Original Price:{' '}
                <span className="line-through font-mono">
                  {formatPKR(effectiveOriginalPrice)}
                </span>
              </p>
            )}
          </div>

          {/* Stock Availability & Condition */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {renderStockStatus()}
            <span className="text-xs font-medium text-slate-600">
              Condition: <strong className="text-slate-900">{product.condition}</strong>
            </span>
          </div>

          {/* Product Variants */}
          {product.variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Select {product.variants[0].group}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {product.variants.map((variant) => {
                  const isSelected = variant.id === activeVariant?.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={!variant.inStock}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] rounded-lg border text-sm text-left focus-visible:outline-2 focus-visible:outline-orange-600 ${
                        !variant.inStock
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : isSelected
                            ? 'border-slate-900 bg-slate-900 text-white font-medium'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span className="min-w-0 break-words">
                        {variant.label}
                        {!variant.inStock ? ' (Out of Stock)' : ''}
                      </span>
                      <span className="font-mono text-xs tabular-nums shrink-0">
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

          {/* Prominent CONTACT ON WHATSAPP Button */}
          <div className="space-y-2 pt-1">
            <WhatsAppInquiryButton
              config={whatsappConfig}
              product={{
                id: product.id,
                name: product.name,
                sku: effectiveSku,
                price: effectivePrice,
                slug: product.slug,
                variantLabel: activeVariant?.label,
              }}
              label={
                effectiveStock === 'Out of Stock'
                  ? 'INQUIRE RESTOCK ON WHATSAPP'
                  : undefined
              }
              source="pdp"
              variant="primary"
              className="w-full py-3.5 text-sm sm:text-base"
              onTrackClick={onTrackWhatsAppClick}
              onUnconfiguredClick={onUnconfiguredWhatsApp}
            />

            <button
              type="button"
              onClick={() => setShowMessagePreview((prev) => !prev)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-2 min-h-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline-orange-600"
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>
                {showMessagePreview
                  ? 'Hide WhatsApp Message Preview'
                  : 'Preview Prefilled WhatsApp Message'}
              </span>
            </button>

            {showMessagePreview && (
              <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-lg whitespace-pre-wrap break-words leading-relaxed overflow-x-auto max-w-full">
                {previewMessage}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Technical Documentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        <div className="lg:col-span-7 space-y-4 sm:space-y-6 min-w-0">
          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-2.5 sm:space-y-3">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Product Description
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-2.5 sm:space-y-3">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Technical Specifications
            </h2>
            <dl className="divide-y divide-slate-200 border-t border-b border-slate-200">
              {product.specs.map((spec, idx) => (
                <div
                  key={`${spec.label}-${idx}`}
                  className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-0.5 sm:gap-2 text-sm"
                >
                  <dt className="sm:col-span-5 text-xs sm:text-sm font-medium text-slate-500 sm:text-slate-600">
                    {spec.label}
                  </dt>
                  <dd className="sm:col-span-7 font-medium text-slate-900 break-words">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-4 sm:space-y-5 min-w-0">
          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-orange-600 shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                What&apos;s Included in the Box
              </h2>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
              {product.whatsInBox.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-orange-600 shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                Compatibility
              </h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{product.compatibility}</p>
          </section>

          {/* Mobile Quick Bottom Inquiry Card after Specifications */}
          <div className="lg:hidden bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">Ready to order or ask?</span>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {formatPKR(effectivePrice)}
              </span>
            </div>
            <WhatsAppInquiryButton
              config={whatsappConfig}
              product={{
                id: product.id,
                name: product.name,
                sku: effectiveSku,
                price: effectivePrice,
                slug: product.slug,
                variantLabel: activeVariant?.label,
              }}
              label={
                effectiveStock === 'Out of Stock'
                  ? 'INQUIRE RESTOCK ON WHATSAPP'
                  : undefined
              }
              source="pdp"
              variant="primary"
              className="w-full"
              onTrackClick={onTrackWhatsAppClick}
              onUnconfiguredClick={onUnconfiguredWhatsApp}
            />
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="space-y-3.5 sm:space-y-4 pt-5 sm:pt-6 border-t border-slate-200">
          <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            Related Products
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {relatedProducts.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                whatsappConfig={whatsappConfig}
                onSelectProduct={onSelectProduct}
                onTrackWhatsAppClick={onTrackWhatsAppClick}
                onUnconfiguredWhatsApp={onUnconfiguredWhatsApp}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen Image Gallery Lightbox */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} image gallery`}
          className="fixed inset-0 z-50 bg-slate-950/92 flex flex-col justify-between p-3 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3 text-white">
            <p className="text-xs sm:text-sm font-medium truncate">
              {product.name} ({selectedImageIndex + 1} / {Math.max(1, galleryImages.length)})
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsZoomed((prev) => !prev)}
                aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
                className="inline-flex items-center gap-1.5 px-3 min-h-[44px] text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg"
              >
                {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                <span>{isZoomed ? '1x' : '2x'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLightboxOpen(false);
                  setIsZoomed(false);
                }}
                aria-label="Close image zoom"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-auto my-3">
            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedImageIndex((prev) =>
                    prev === 0 ? galleryImages.length - 1 : prev - 1
                  );
                  setIsZoomed(false);
                }}
                aria-label="Previous image"
                className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div
              onClick={() => setIsZoomed((prev) => !prev)}
              className={`max-h-[75vh] max-w-5xl w-full flex items-center justify-center cursor-pointer transition-transform duration-200 ${
                isZoomed ? 'scale-150 sm:scale-175 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
            >
              <ResilientImage
                src={galleryImages[selectedImageIndex] || galleryImages[0]}
                alt={`${product.name} full view ${selectedImageIndex + 1}`}
                fallbackLabel={product.name}
                sizes="100vw"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
                priority
              />
            </div>

            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedImageIndex((prev) =>
                    prev === galleryImages.length - 1 ? 0 : prev + 1
                  );
                  setIsZoomed(false);
                }}
                aria-label="Next image"
                className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={`lb-${img}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setIsZoomed(false);
                  }}
                  aria-label={`Select image ${idx + 1}`}
                  className={`w-16 aspect-[4/3] rounded overflow-hidden border shrink-0 ${
                    selectedImageIndex === idx
                      ? 'border-orange-500 ring-2 ring-orange-500/40'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <ResilientImage
                    src={img}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    sizes="80px"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
