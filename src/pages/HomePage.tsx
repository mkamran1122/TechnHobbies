import { ArrowRight, MessageCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { HERO_IMAGE } from '../data/sampleCatalog';
import type { Category, Product, WhatsAppConfig } from '../types/catalog';
import type { AppRoute } from '../utils/routing';

interface HomePageProps {
  products: Product[];
  categories: Category[];
  whatsappConfig: WhatsAppConfig;
  onNavigate: (route: AppRoute) => void;
  onSelectCategory: (categoryId: string) => void;
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

export function HomePage({
  products,
  categories,
  whatsappConfig,
  onNavigate,
  onSelectCategory,
  onSelectProduct,
  onTrackWhatsAppClick,
  onUnconfiguredWhatsApp,
}: HomePageProps) {
  const publishedProducts = products.filter((p) => p.published && !p.archived);
  const featuredProducts = publishedProducts.filter((p) => p.featured);
  const displayedProducts =
    featuredProducts.length >= 6
      ? featuredProducts.slice(0, 8)
      : publishedProducts.slice(0, 8);

  return (
    <div className="bg-white">
      {/* 3. Small, Clean Promotional Banner */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-700">
                TechnHobbies Pakistan
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                RC Cars, Drones &amp; Hobby Hardware
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
                Transparent PKR pricing and direct WhatsApp ordering inquiries across Pakistan.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
                >
                  <span>Browse All Products</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            <div className="hidden sm:block w-52 md:w-64 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              <ResilientImage
                src={HERO_IMAGE}
                alt="RC monster truck and FPV quadcopter hardware"
                fallbackLabel="TechnHobbies RC Gear"
                className="w-full h-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Products Section Immediately Below Banner */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            Featured Products
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-700 hover:text-orange-800 whitespace-nowrap shrink-0 min-h-[44px] px-1"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              whatsappConfig={whatsappConfig}
              onSelectProduct={onSelectProduct}
              onTrackWhatsAppClick={onTrackWhatsAppClick}
              onUnconfiguredWhatsApp={onUnconfiguredWhatsApp}
            />
          ))}
        </div>
      </section>

      {/* 5. Simple Categories Section (ONLY Category Image + Category Title) */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Categories
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-700 hover:text-orange-800 whitespace-nowrap shrink-0 min-h-[44px] px-1"
            >
              <span>All Categories</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden text-left hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-orange-600 flex flex-col min-w-0"
              >
                <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
                  <div className="absolute inset-0">
                    <ResilientImage
                      src={category.image}
                      alt={category.name}
                      fallbackLabel={category.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-2 sm:p-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                    {category.name}
                  </h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Compact Trust & Policy Strip */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-slate-300"
            >
              <RotateCcw className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">7-Day Return Policy</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Eligible items may be returned within 7 days subject to product condition and
                  published return terms.
                </p>
              </div>
            </button>

            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Product Warranty</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Manufacturer or bench coverage applies where specified on individual product
                  pages.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <MessageCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">WhatsApp Support</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Confirm stock, battery compatibility, and shipping quotes directly on WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
