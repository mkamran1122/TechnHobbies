import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  PackageCheck,
  RotateCcw,
  Shield,
  Truck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { WhatsAppInquiryButton } from '../components/WhatsAppInquiryButton';
import { buildProductInquiryMessage } from '../config/whatsapp';
import type { Brand, Category, Product, WhatsAppConfig } from '../types/catalog';
import { computeDiscountPercentage, formatPKR } from '../utils/currency';
import { getEffectiveStockStatus } from '../utils/stock';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
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

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedVariantId(
      product.variants.find((v) => v.inStock)?.id || product.variants[0]?.id || ''
    );
    setShowMessagePreview(false);
  }, [product.id, product.variants]);

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

  const relatedProducts = allProducts
    .filter((p) => p.published && !p.archived && p.id !== product.id)
    .sort((a, b) => {
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 sm:space-y-12">
      {/* Breadcrumb Navigation */}
      <nav
        className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap py-1"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          onClick={onBackToShop}
          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Shop</span>
        </button>
        {category && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className="hover:text-slate-900 shrink-0"
            >
              {category.name}
            </button>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-900 font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Product Image Gallery */}
        <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-24 min-w-0">
          <div className="aspect-[4/3] w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            <ResilientImage
              src={product.images[selectedImageIndex] || product.images[0]}
              alt={`${product.name} view ${selectedImageIndex + 1}`}
              fallbackLabel={product.name}
              className="w-full h-full object-cover"
              priority
            />
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`aspect-[4/3] rounded-md overflow-hidden border bg-slate-100 ${
                    selectedImageIndex === idx
                      ? 'border-orange-600 ring-2 ring-orange-600/20'
                      : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <ResilientImage
                    src={img}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Pricing, Variants, Availability & WhatsApp CTA */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-5 min-w-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {brand ? (
                <button
                  type="button"
                  onClick={() => onSelectBrand(brand.id)}
                  className="font-semibold uppercase tracking-wider text-orange-700 hover:underline"
                >
                  {brand.name}
                </button>
              ) : (
                <span className="font-semibold uppercase tracking-wider text-orange-700">
                  TechnHobbies
                </span>
              )}
              <span className="font-mono text-slate-500 break-all">SKU: {effectiveSku}</span>
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {product.name}
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">{product.shortDescription}</p>
          </div>

          {/* PKR Price */}
          <div className="py-3.5 border-y border-slate-200 space-y-1">
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
                      className={`flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] rounded-lg border text-sm text-left ${
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
          <div className="space-y-2.5 pt-1">
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
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-2 min-h-[40px]"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>
                {showMessagePreview
                  ? 'Hide WhatsApp Message Preview'
                  : 'Preview Prefilled WhatsApp Message'}
              </span>
            </button>

            {showMessagePreview && (
              <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-lg whitespace-pre-wrap break-words leading-relaxed">
                {previewMessage}
              </pre>
            )}
          </div>

          {/* Warranty, Dispatch & 7-Day Return Policy */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                <strong className="text-slate-900">Warranty:</strong> {product.warrantyInfo}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                <strong className="text-slate-900">Dispatch:</strong> {product.shippingInfo}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                <strong className="text-slate-900">7-Day Return Policy:</strong> Subject to unused
                original condition, intact packaging, and published return eligibility conditions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Documentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-7 space-y-6 min-w-0">
          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Product Description
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Technical Specifications
            </h2>
            <dl className="divide-y divide-slate-200 border-t border-b border-slate-200">
              {product.specs.map((spec, idx) => (
                <div
                  key={`${spec.label}-${idx}`}
                  className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 text-sm"
                >
                  <dt className="sm:col-span-5 font-medium text-slate-600">{spec.label}</dt>
                  <dd className="sm:col-span-7 font-medium text-slate-900 break-words">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-5 min-w-0">
          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-3">
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

          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Warranty &amp; Returns</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{product.warrantyInfo}</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Returns within 7 days of delivery require unused original condition, complete box
                contents, and prior WhatsApp inspection approval.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Shipping across Pakistan
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{product.shippingInfo}</p>
            </div>
          </section>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            Related Products
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
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
    </div>
  );
}
