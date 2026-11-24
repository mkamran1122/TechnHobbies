import { RotateCcw, Search } from 'lucide-react';
import { useMemo } from 'react';
import { ProductCard } from '../components/ProductCard';
import type {
  Brand,
  Category,
  Product,
  ProductCondition,
  StockStatus,
  WhatsAppConfig,
} from '../types/catalog';
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
  const publishedProducts = useMemo(
    () => products.filter((p) => p.published && !p.archived),
    [products]
  );

  const activeCategory = categories.find((c) => c.id === filters.categoryId);

  const filteredProducts = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    const matched = publishedProducts.filter((product) => {
      if (filters.categoryId !== 'all' && product.categoryId !== filters.categoryId) {
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
        const haystack = [
          product.name,
          product.sku,
          product.shortDescription,
          brandName,
          catName,
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

  const hasActiveFilters =
    filters.query !== '' ||
    filters.categoryId !== 'all' ||
    filters.brandId !== 'all' ||
    filters.condition !== 'all' ||
    filters.stockStatus !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5">
      {/* Compact Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {activeCategory ? activeCategory.name : 'Shop RC Hardware'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            All prices in PKR. Direct WhatsApp inquiry on every item.
          </p>
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-600 tabular-nums shrink-0">
          {filteredProducts.length} of {publishedProducts.length} products
        </p>
      </div>

      {/* Category Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onChangeFilters({ ...filters, categoryId: 'all' })}
          className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            filters.categoryId === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChangeFilters({ ...filters, categoryId: cat.id })}
            className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              filters.categoryId === cat.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search & Attribute Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="sm:col-span-2 lg:col-span-4 relative min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChangeFilters({ ...filters, query: e.target.value })}
            placeholder="Search model, SKU, brand..."
            aria-label="Search products"
            className="w-full pl-9 pr-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="lg:col-span-2 min-w-0">
          <select
            value={filters.brandId}
            onChange={(e) => onChangeFilters({ ...filters, brandId: e.target.value })}
            aria-label="Filter by brand"
            className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <select
            value={filters.stockStatus}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                stockStatus: e.target.value as ShopFilterState['stockStatus'],
              })
            }
            aria-label="Filter by stock status"
            className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Any Stock</option>
            <option value="In Stock">In Stock</option>
            <option value="Limited Stock">Limited Stock</option>
            <option value="Pre-Order">Pre-Order</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <select
            value={filters.condition}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                condition: e.target.value as ShopFilterState['condition'],
              })
            }
            aria-label="Filter by condition"
            className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Any Condition</option>
            <option value="Brand New">Brand New</option>
            <option value="Open Box">Open Box</option>
            <option value="Refurbished">Refurbished</option>
          </select>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onChangeFilters({ ...filters, sortBy: e.target.value as ShopFilterState['sortBy'] })
            }
            aria-label="Sort products"
            className="w-full px-3 py-2 min-h-[40px] text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Recently Updated</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>Filters active</span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 font-semibold text-orange-700 hover:text-orange-800 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Results Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
          {filteredProducts.map((product) => (
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
      )}
    </div>
  );
}
