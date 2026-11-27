import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import type {
  Brand,
  Category,
  Product,
  ProductCondition,
  StockStatus,
  WhatsAppConfig,
} from '../types/catalog';
import {
  getCategoryAncestors,
  getChildCategories,
  getTopLevelCategories,
  productMatchesCategoryFilter,
} from '../utils/categoryTree';
import { getEffectiveStockStatus } from '../utils/stock';

export interface ShopFilterState {
  query: string;
  categoryId: string;
  brandId: string;
  condition: 'all' | ProductCondition;
  stockStatus: 'all' | StockStatus;
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'newest';
}

interface ShopPageProps {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  filters: ShopFilterState;
  whatsappConfig: WhatsAppConfig;
  onChangeFilters: (next: ShopFilterState) => void;
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

const PAGE_SIZE = 12;

export function ShopPage({
  products,
  categories,
  brands,
  filters,
  whatsappConfig,
  onChangeFilters,
  onSelectProduct,
  onTrackWhatsAppClick,
  onUnconfiguredWhatsApp,
}: ShopPageProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    filters.query,
    filters.categoryId,
    filters.brandId,
    filters.condition,
    filters.stockStatus,
    filters.sortBy,
  ]);

  const publishedProducts = useMemo(
    () => products.filter((p) => p.published && !p.archived),
    [products]
  );

  const topLevelCategories = useMemo(
    () => getTopLevelCategories(categories),
    [categories]
  );

  const activeCategory = categories.find((c) => c.id === filters.categoryId);
  const categoryAncestors = useMemo(
    () =>
      activeCategory
        ? getCategoryAncestors(activeCategory.id, categories)
        : [],
    [activeCategory, categories]
  );
  const activeRootCategory = categoryAncestors[0] || activeCategory;
  const activeSubcategories = useMemo(
    () =>
      activeRootCategory
        ? getChildCategories(activeRootCategory.id, categories)
        : [],
    [activeRootCategory, categories]
  );

  const filteredProducts = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    const matched = publishedProducts.filter((product) => {
      if (!productMatchesCategoryFilter(product, filters.categoryId, categories)) {
        return false;
      }
      if (filters.brandId !== 'all' && product.brandId !== filters.brandId) {
        return false;
      }
      if (filters.condition !== 'all' && product.condition !== filters.condition) {
        return false;
      }
      if (filters.stockStatus !== 'all' && getEffectiveStockStatus(product) !== filters.stockStatus) {
        return false;
      }
      if (q) {
        const brandName = brands.find((b) => b.id === product.brandId)?.name.toLowerCase() || '';
        const catName = categories.find((c) => c.id === product.categoryId)?.name.toLowerCase() || '';
        const subName = product.subcategoryId
          ? categories.find((c) => c.id === product.subcategoryId)?.name.toLowerCase() || ''
          : '';
        const haystack = [
          product.name,
          product.sku,
          product.shortDescription,
          brandName,
          catName,
          subName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });

    return [...matched].sort((a, b) => {
      if (filters.sortBy === 'price-asc') return a.price - b.price;
      if (filters.sortBy === 'price-desc') return b.price - a.price;
      if (filters.sortBy === 'newest') return b.updatedAt.localeCompare(a.updatedAt);
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [publishedProducts, filters, brands, categories]);

  const resetFilters = () => {
    onChangeFilters({
      query: '',
      categoryId: 'all',
      brandId: 'all',
      condition: 'all',
      stockStatus: 'all',
      sortBy: 'featured',
    });
  };

  const secondaryFilterCount =
    (filters.brandId !== 'all' ? 1 : 0) +
    (filters.stockStatus !== 'all' ? 1 : 0) +
    (filters.condition !== 'all' ? 1 : 0);

  const hasActiveFilters =
    filters.query !== '' ||
    filters.categoryId !== 'all' ||
    secondaryFilterCount > 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-5">
      {/* Compact Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 sm:gap-2 border-b border-slate-200 pb-3 sm:pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            {activeCategory ? activeCategory.name : 'Shop RC Hardware'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 sm:mt-1">
            All prices in PKR. Direct WhatsApp inquiry on every item.
          </p>
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-600 tabular-nums shrink-0">
          {filteredProducts.length} of {publishedProducts.length} products
        </p>
      </div>

      {/* Category Filter Row (edge-to-edge smooth touch scroll on mobile) */}
      <div className="space-y-2">
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => onChangeFilters({ ...filters, categoryId: 'all' })}
            className={`px-3.5 py-2 min-h-[44px] text-xs sm:text-[13px] font-semibold rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 ${
              filters.categoryId === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {topLevelCategories.map((cat) => {
            const isActiveTop =
              filters.categoryId === cat.id || activeRootCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onChangeFilters({ ...filters, categoryId: cat.id })}
                className={`px-3.5 py-2 min-h-[44px] text-xs sm:text-[13px] font-semibold rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 ${
                  isActiveTop
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Subcategory Filter Row (shown when active parent category has subcategories) */}
        {activeRootCategory && activeSubcategories.length > 0 && (
          <div
            aria-label={`${activeRootCategory.name} subcategories`}
            className="-mx-3 px-3 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            <button
              type="button"
              onClick={() =>
                onChangeFilters({ ...filters, categoryId: activeRootCategory.id })
              }
              className={`px-3 py-1.5 min-h-[44px] sm:min-h-[38px] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 ${
                filters.categoryId === activeRootCategory.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All {activeRootCategory.name}
            </button>
            {activeSubcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onChangeFilters({ ...filters, categoryId: sub.id })}
                className={`px-3 py-1.5 min-h-[44px] sm:min-h-[38px] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 ${
                  filters.categoryId === sub.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search & Attribute Filter Bar (compact collapsible on mobile, full grid on desktop) */}
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:p-3 space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-2.5">
        <div className="lg:col-span-4 relative min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChangeFilters({ ...filters, query: e.target.value })}
            placeholder="Search model, SKU, brand..."
            aria-label="Search products"
            className="w-full pl-9 pr-3 py-2 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Mobile Filter Toggle + Sort Side-by-Side (keeps product grid immediately visible) */}
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
            className={`inline-flex items-center justify-center gap-2 px-3 min-h-[44px] text-sm font-semibold rounded-lg border focus-visible:outline-2 focus-visible:outline-orange-600 ${
              mobileFiltersOpen || secondaryFilterCount > 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>
              Filters{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}
            </span>
          </button>

          <select
            value={filters.sortBy}
            onChange={(e) =>
              onChangeFilters({ ...filters, sortBy: e.target.value as ShopFilterState['sortBy'] })
            }
            aria-label="Sort products"
            className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Recently Updated</option>
          </select>
        </div>

        {/* Secondary Filters (collapsible on mobile, always inline on lg desktop) */}
        <div
          className={`${
            mobileFiltersOpen ? 'grid' : 'hidden'
          } lg:grid grid-cols-1 sm:grid-cols-3 lg:col-span-6 gap-2.5`}
        >
          <div className="min-w-0">
            <select
              value={filters.brandId}
              onChange={(e) => onChangeFilters({ ...filters, brandId: e.target.value })}
              aria-label="Filter by brand"
              className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <select
              value={filters.stockStatus}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  stockStatus: e.target.value as ShopFilterState['stockStatus'],
                })
              }
              aria-label="Filter by stock status"
              className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Any Stock</option>
              <option value="In Stock">In Stock</option>
              <option value="Limited Stock">Limited Stock</option>
              <option value="Pre-Order">Pre-Order</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          <div className="min-w-0">
            <select
              value={filters.condition}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  condition: e.target.value as ShopFilterState['condition'],
                })
              }
              aria-label="Filter by condition"
              className="w-full px-3 py-2 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Any Condition</option>
              <option value="Brand New">Brand New</option>
              <option value="Open Box">Open Box</option>
              <option value="Refurbished">Refurbished</option>
            </select>
          </div>
        </div>

        {/* Desktop Sort */}
        <div className="hidden lg:block lg:col-span-2 min-w-0">
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onChangeFilters({ ...filters, sortBy: e.target.value as ShopFilterState['sortBy'] })
            }
            aria-label="Sort products"
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Recently Updated</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-600">
          <span>Filters active</span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 font-semibold text-orange-700 hover:text-orange-800 min-h-[44px] px-2 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Results Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            No products match your filters
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Try clearing your search term or switching category and stock availability filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Filters</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredProducts.slice(0, visibleCount).map((product, index) => (
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

          {filteredProducts.length > visibleCount && (
            <div className="pt-2 flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500 tabular-nums">
                Showing {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="px-6 py-2.5 min-h-[44px] text-sm font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg focus-visible:outline-2 focus-visible:outline-orange-600"
              >
                Load More Products ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
