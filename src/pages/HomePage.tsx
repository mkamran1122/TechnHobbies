import { ArrowRight, MessageCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { HERO_IMAGE } from '../data/sampleCatalog';
import type { Category, Product, WhatsAppConfig } from '../types/catalog';
import { getChildCategories, getTopLevelCategories } from '../utils/categoryTree';
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

const CATEGORY_SLIDER_PX_PER_SEC = 24;

function CategoryTile({
  category,
  subcategoryCount = 0,
  onSelect,
  className = '',
  tabIndex,
}: {
  category: Category;
  subcategoryCount?: number;
  onSelect: () => void;
  className?: string;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={onSelect}
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden text-left hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-orange-600 flex flex-col min-w-0 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
        <div className="absolute inset-0">
          <ResilientImage
            src={category.image}
            alt={category.name}
            fallbackLabel={category.name}
            sizes="(max-width: 639px) 184px, (max-width: 1023px) 33vw, 25vw"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <div className="p-2.5 sm:p-3">
        <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
          {category.name}
        </h3>
        {subcategoryCount > 0 && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'}
          </p>
        )}
      </div>
    </button>
  );
}

function MobileCategorySlider({
  categories,
  allCategories,
  onSelectCategory,
}: {
  categories: Category[];
  allCategories: Category[];
  onSelectCategory: (categoryId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const primarySetRef = useRef<HTMLDivElement | null>(null);
  const secondarySetRef = useRef<HTMLDivElement | null>(null);
  const virtualScrollRef = useRef(0);
  const isPausedRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : true
  );

  useEffect(() => {
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileMq = window.matchMedia('(max-width: 639px)');

    const onMotionChange = () => setPrefersReducedMotion(motionMq.matches);
    const onMobileChange = () => setIsMobileViewport(mobileMq.matches);

    motionMq.addEventListener('change', onMotionChange);
    mobileMq.addEventListener('change', onMobileChange);
    return () => {
      motionMq.removeEventListener('change', onMotionChange);
      mobileMq.removeEventListener('change', onMobileChange);
    };
  }, []);

  const shouldLoop = !prefersReducedMotion && isMobileViewport && categories.length > 1;

  const getLoopWidth = useCallback(() => {
    if (!primarySetRef.current || !secondarySetRef.current) return 0;
    return Math.max(0, secondarySetRef.current.offsetLeft - primarySetRef.current.offsetLeft);
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const pauseAutoScroll = useCallback(() => {
    clearResumeTimer();
    isPausedRef.current = true;
    if (scrollRef.current) {
      virtualScrollRef.current = scrollRef.current.scrollLeft;
    }
  }, [clearResumeTimer]);

  const scheduleResume = useCallback(
    (delayMs = 1800) => {
      clearResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        if (scrollRef.current) {
          virtualScrollRef.current = scrollRef.current.scrollLeft;
        }
        isPausedRef.current = false;
      }, delayMs);
    },
    [clearResumeTimer]
  );

  useEffect(() => {
    return () => clearResumeTimer();
  }, [clearResumeTimer]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !shouldLoop) return;

    virtualScrollRef.current = container.scrollLeft;
    let rafId = 0;
    let lastTimestamp = performance.now();

    const step = (now: number) => {
      const dtMs = Math.min(64, Math.max(0, now - lastTimestamp));
      lastTimestamp = now;

      if (!isPausedRef.current && !document.hidden) {
        const loopWidth = getLoopWidth();
        if (loopWidth > 0) {
          virtualScrollRef.current += (CATEGORY_SLIDER_PX_PER_SEC * dtMs) / 1000;
          if (virtualScrollRef.current >= loopWidth) {
            virtualScrollRef.current -= loopWidth;
          }
          container.scrollLeft = virtualScrollRef.current;
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [shouldLoop, categories.length, getLoopWidth]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container || !shouldLoop) return;

    const loopWidth = getLoopWidth();
    if (loopWidth > 0 && container.scrollLeft >= loopWidth) {
      container.scrollLeft -= loopWidth;
      virtualScrollRef.current = container.scrollLeft;
    } else if (isPausedRef.current) {
      virtualScrollRef.current = container.scrollLeft;
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onTouchStart={pauseAutoScroll}
      onTouchEnd={() => scheduleResume(1800)}
      onTouchCancel={() => scheduleResume(1800)}
      onPointerDown={pauseAutoScroll}
      onPointerUp={() => scheduleResume(1800)}
      onPointerCancel={() => scheduleResume(1800)}
      onMouseEnter={pauseAutoScroll}
      onMouseLeave={() => scheduleResume(600)}
      onFocusCapture={pauseAutoScroll}
      onBlurCapture={() => scheduleResume(600)}
      onWheel={() => {
        pauseAutoScroll();
        scheduleResume(1800);
      }}
      aria-label="Browse categories"
      className="sm:hidden -mx-3 px-3 py-0.5 overflow-x-auto no-scrollbar"
    >
      <div className="flex gap-3 w-max">
        <div ref={primarySetRef} className="flex gap-3 shrink-0">
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              subcategoryCount={getChildCategories(category.id, allCategories).length}
              onSelect={() => onSelectCategory(category.id)}
              className="w-[42vw] min-w-[154px] max-w-[184px] shrink-0"
            />
          ))}
        </div>

        {shouldLoop && (
          <div ref={secondarySetRef} aria-hidden="true" className="flex gap-3 shrink-0">
            {categories.map((category) => (
              <CategoryTile
                key={`${category.id}-loop`}
                category={category}
                subcategoryCount={getChildCategories(category.id, allCategories).length}
                tabIndex={-1}
                onSelect={() => onSelectCategory(category.id)}
                className="w-[42vw] min-w-[154px] max-w-[184px] shrink-0"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const topLevelCategories = getTopLevelCategories(categories);

  return (
    <div className="bg-white">
      {/* 3. Compact Mobile-First Promotional Banner */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-6 flex items-center justify-between gap-3 sm:gap-6">
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange-700">
                TechnHobbies Pakistan
              </p>
              <h1 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug text-balance">
                RC Cars, Drones &amp; Hobby Hardware
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-snug">
                Transparent PKR pricing and direct WhatsApp ordering inquiries across Pakistan.
              </p>
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                >
                  <span>Browse All Products</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            <div className="hidden min-[380px]:block w-24 h-24 sm:w-52 sm:h-auto md:w-64 sm:aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              <ResilientImage
                src={HERO_IMAGE}
                alt="RC monster truck and FPV quadcopter hardware"
                fallbackLabel="TechnHobbies RC Gear"
                sizes="(max-width: 639px) 96px, 256px"
                className="w-full h-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Products Section Immediately Below Banner */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-6">
          <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            Featured Products
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-700 hover:text-orange-800 whitespace-nowrap shrink-0 min-h-[44px] px-1.5 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {displayedProducts.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No published products in the storefront catalog yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sign in as admin to publish products or migrate the initial catalog to Cloud Firestore.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                whatsappConfig={whatsappConfig}
                priority={index < 2}
                onSelectProduct={onSelectProduct}
                onTrackWhatsAppClick={onTrackWhatsAppClick}
                onUnconfiguredWhatsApp={onUnconfiguredWhatsApp}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Simple Categories Section (Mobile Auto-Slider + Unchanged Desktop Grid) */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-10">
          <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-6">
            <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Categories
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-700 hover:text-orange-800 whitespace-nowrap shrink-0 min-h-[44px] px-1.5 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
            >
              <span>All Categories</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {topLevelCategories.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs sm:text-sm text-slate-500">
              No categories configured yet.
            </div>
          ) : (
            <>
              <MobileCategorySlider
                categories={topLevelCategories}
                allCategories={categories}
                onSelectCategory={onSelectCategory}
              />

              <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                {topLevelCategories.map((category) => (
                  <CategoryTile
                    key={category.id}
                    category={category}
                    subcategoryCount={getChildCategories(category.id, categories).length}
                    onSelect={() => onSelectCategory(category.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 6. Compact Trust & Policy Strip */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="flex items-start gap-3 p-3.5 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-orange-600"
            >
              <RotateCcw className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">7-Day Return Policy</p>
                <p className="text-xs sm:text-[13px] text-slate-600 mt-0.5 leading-relaxed">
                  Eligible items may be returned within 7 days subject to product condition and
                  published return terms.
                </p>
              </div>
            </button>

            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Product Warranty</p>
                <p className="text-xs sm:text-[13px] text-slate-600 mt-0.5 leading-relaxed">
                  Manufacturer or bench coverage applies where specified on individual product
                  pages.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
              <MessageCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">WhatsApp Support</p>
                <p className="text-xs sm:text-[13px] text-slate-600 mt-0.5 leading-relaxed">
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
