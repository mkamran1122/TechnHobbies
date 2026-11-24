import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { WhatsAppNoticeModal } from './components/WhatsAppModal';
import { useSEO } from './hooks/useSEO';
import type { AdminTab } from './pages/AdminDashboard';
import { CategoriesPage } from './pages/CategoriesPage';
import { HomePage } from './pages/HomePage';
import { InfoPage } from './pages/InfoPages';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { type ShopFilterState, ShopPage } from './pages/ShopPage';
import { catalogService } from './services/dataService';
import type {
  Brand,
  CatalogStoreState,
  Category,
  Product,
  StoreSettings,
  WhatsAppConfig,
} from './types/catalog';
import { type AppRoute, buildPathForRoute, parseLocation } from './utils/routing';

const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

const DEFAULT_FILTERS: ShopFilterState = {
  query: '',
  categoryId: 'all',
  brandId: 'all',
  condition: 'all',
  stockStatus: 'all',
  sortBy: 'featured',
};

export default function App() {
  const [state, setState] = useState<CatalogStoreState>(() => catalogService.loadState());
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const initialParsed = useMemo(
    () => parseLocation(window.location.pathname, window.location.search),
    []
  );

  const [route, setRoute] = useState<AppRoute>(initialParsed.route);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(
    initialParsed.productSlug
  );
  const [shopFilters, setShopFilters] = useState<ShopFilterState>(() => {
    const loaded = catalogService.loadState();
    const matchedCat = initialParsed.categorySlug
      ? loaded.categories.find((c) => c.slug === initialParsed.categorySlug)
      : undefined;
    return {
      ...DEFAULT_FILTERS,
      categoryId: matchedCat ? matchedCat.id : 'all',
      query: initialParsed.searchQuery,
    };
  });
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [waModalMessage, setWaModalMessage] = useState<string | null>(null);

  // Sync browser Back/Forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseLocation(window.location.pathname, window.location.search);
      setRoute(parsed.route);
      setSelectedProductSlug(parsed.productSlug);
      if (parsed.route === 'shop') {
        const cat = parsed.categorySlug
          ? state.categories.find((c) => c.slug === parsed.categorySlug)
          : undefined;
        setShopFilters((prev) => ({
          ...prev,
          categoryId: cat ? cat.id : 'all',
          query: parsed.searchQuery,
        }));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.categories]);

  const activeProduct = useMemo(
    () =>
      selectedProductSlug
        ? state.products.find(
            (p) => p.slug === selectedProductSlug && p.published && !p.archived
          ) || null
        : null,
    [state.products, selectedProductSlug]
  );

  const activeProductBrand = useMemo(
    () => (activeProduct ? state.brands.find((b) => b.id === activeProduct.brandId) : undefined),
    [activeProduct, state.brands]
  );

  const activeProductCategory = useMemo(
    () =>
      activeProduct
        ? state.categories.find((c) => c.id === activeProduct.categoryId)
        : undefined,
    [activeProduct, state.categories]
  );

  const activeShopCategory = useMemo(
    () =>
      shopFilters.categoryId !== 'all'
        ? state.categories.find((c) => c.id === shopFilters.categoryId)
        : undefined,
    [shopFilters.categoryId, state.categories]
  );

  const canonicalPath = useMemo(() => {
    if (route === 'product' && activeProduct) {
      return `/product/${encodeURIComponent(activeProduct.slug)}`;
    }
    if (route === 'shop') {
      return activeShopCategory
        ? `/category/${encodeURIComponent(activeShopCategory.slug)}`
        : '/shop';
    }
    if (route === 'home') return '/';
    return `/${route}`;
  }, [route, activeProduct, activeShopCategory]);

  const seoMeta = useMemo(() => {
    const brandName = state.storeSettings.storeName;
    if (route === 'product') {
      if (activeProduct) {
        return {
          title: `${activeProduct.name} | ${brandName}`,
          description: activeProduct.shortDescription,
          noIndex: false,
        };
      }
      return {
        title: `Product Unavailable | ${brandName}`,
        description: 'Requested product is unavailable or unpublished.',
        noIndex: true,
      };
    }
    if (route === 'shop') {
      if (activeShopCategory) {
        return {
          title: `${activeShopCategory.name} | ${brandName}`,
          description: activeShopCategory.description,
          noIndex: false,
        };
      }
      return {
        title: `Shop RC & Hobby Hardware | ${brandName}`,
        description:
          'Browse RC cars, FPV drones, airplanes, helicopters, and LiPo batteries in Pakistan with PKR pricing.',
        noIndex: false,
      };
    }
    if (route === 'categories') {
      return {
        title: `Categories | ${brandName}`,
        description:
          'Explore TechnHobbies RC cars, FPV drones, aircraft, radios, and power electronics categories.',
        noIndex: false,
      };
    }
    if (route === 'about') {
      return {
        title: `About TechnHobbies | ${brandName}`,
        description:
          'Learn how TechnHobbies serves Pakistani RC hobbyists with transparent PKR pricing and direct WhatsApp consultation.',
        noIndex: false,
      };
    }
    if (route === 'privacy') {
      return {
        title: `Privacy Policy | ${brandName}`,
        description: 'TechnHobbies privacy policy and WhatsApp inquiry data handling notice.',
        noIndex: false,
      };
    }
    if (route === 'terms') {
      return {
        title: `Terms & 7-Day Return Policy | ${brandName}`,
        description:
          'TechnHobbies catalog pricing, warranty coverage, and 7-day return policy conditions.',
        noIndex: false,
      };
    }
    if (route === 'admin') {
      return {
        title: `Admin Console | ${brandName}`,
        description: state.storeSettings.seoDescription,
        noIndex: true,
      };
    }
    return {
      title: state.storeSettings.seoTitle,
      description: state.storeSettings.seoDescription,
      noIndex: false,
    };
  }, [route, activeProduct, activeShopCategory, state.storeSettings]);

  useSEO({
    title: seoMeta.title,
    description: seoMeta.description,
    canonicalPath,
    noIndex: seoMeta.noIndex,
    product: route === 'product' ? activeProduct : null,
    brand: activeProductBrand,
    category: activeProductCategory,
    storeSettings: state.storeSettings,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [route, selectedProductSlug]);

  const pushPath = (nextPath: string) => {
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  const handleNavigate = useCallback(
    (nextRoute: AppRoute) => {
      setRoute(nextRoute);
      if (nextRoute !== 'product') {
        setSelectedProductSlug(null);
      }
      if (nextRoute === 'shop') {
        setShopFilters(DEFAULT_FILTERS);
        pushPath('/shop');
        return;
      }
      pushPath(
        buildPathForRoute(nextRoute, {
          categories: state.categories,
        })
      );
    },
    [state.categories]
  );

  const handleSelectProduct = useCallback((slug: string) => {
    setSelectedProductSlug(slug);
    setRoute('product');
    pushPath(`/product/${encodeURIComponent(slug)}`);
  }, []);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setShopFilters({ ...DEFAULT_FILTERS, categoryId });
      setSelectedProductSlug(null);
      setRoute('shop');
      pushPath(
        buildPathForRoute('shop', {
          categoryId,
          categories: state.categories,
        })
      );
    },
    [state.categories]
  );

  const handleSelectBrand = useCallback((brandId: string) => {
    setShopFilters({ ...DEFAULT_FILTERS, brandId });
    setSelectedProductSlug(null);
    setRoute('shop');
    pushPath('/shop');
  }, []);

  const handleSearchSubmit = useCallback((query: string) => {
    setShopFilters({ ...DEFAULT_FILTERS, query });
    setSelectedProductSlug(null);
    setRoute('shop');
    pushPath(buildPathForRoute('shop', { query }));
  }, []);

  const handleChangeShopFilters = useCallback(
    (next: ShopFilterState) => {
      setShopFilters(next);
      pushPath(
        buildPathForRoute('shop', {
          categoryId: next.categoryId,
          query: next.query,
          categories: state.categories,
        })
      );
    },
    [state.categories]
  );

  const applyMutation = (updater: (prev: CatalogStoreState) => CatalogStoreState) => {
    setState((prev) => {
      const next = updater(prev);
      setStorageWarning(catalogService.getLastStorageWarning());
      return next;
    });
  };

  const handleTrackWhatsAppClick = useCallback(
    (payload: {
      productId: string;
      productName: string;
      sku: string;
      price: number;
      source: 'pdp' | 'card' | 'general';
    }) => {
      applyMutation((prev) =>
        catalogService.recordWhatsAppClick(prev, {
          id: `wa-${Date.now()}`,
          productId: payload.productId,
          productName: payload.productName,
          sku: payload.sku,
          price: payload.price,
          source: payload.source,
          timestamp: new Date().toISOString(),
        })
      );
    },
    []
  );

  // Admin mutation handlers
  const handleUpsertProduct = (product: Product) =>
    applyMutation((prev) => catalogService.upsertProduct(prev, product));

  const handleDeleteProduct = (productId: string) =>
    applyMutation((prev) => catalogService.deleteProduct(prev, productId));

  const handleUpsertCategory = (category: Category) =>
    applyMutation((prev) => catalogService.upsertCategory(prev, category));

  const handleDeleteCategory = (categoryId: string) =>
    applyMutation((prev) => catalogService.deleteCategory(prev, categoryId));

  const handleUpsertBrand = (brand: Brand) =>
    applyMutation((prev) => catalogService.upsertBrand(prev, brand));

  const handleDeleteBrand = (brandId: string) =>
    applyMutation((prev) => catalogService.deleteBrand(prev, brandId));

  const handleUpdateWhatsAppConfig = (config: WhatsAppConfig) =>
    applyMutation((prev) => catalogService.updateWhatsAppConfig(prev, config));

  const handleUpdateStoreSettings = (settings: StoreSettings) =>
    applyMutation((prev) => catalogService.updateStoreSettings(prev, settings));

  const handleResetSampleData = () => {
    setState(catalogService.resetToSampleData());
    setStorageWarning(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Header
        activeRoute={route}
        searchQuery={shopFilters.query}
        onNavigate={handleNavigate}
        onSearchSubmit={handleSearchSubmit}
      />

      <main className="flex-1">
        {route === 'home' && (
          <HomePage
            products={state.products}
            categories={state.categories}
            whatsappConfig={state.whatsappConfig}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'shop' && (
          <ShopPage
            products={state.products}
            categories={state.categories}
            brands={state.brands}
            filters={shopFilters}
            whatsappConfig={state.whatsappConfig}
            onChangeFilters={handleChangeShopFilters}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'categories' && (
          <CategoriesPage
            categories={state.categories}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {route === 'product' && activeProduct && (
          <ProductDetailPage
            product={activeProduct}
            allProducts={state.products}
            brand={activeProductBrand}
            category={activeProductCategory}
            whatsappConfig={state.whatsappConfig}
            onBackToShop={() => handleNavigate('shop')}
            onSelectCategory={handleSelectCategory}
            onSelectBrand={handleSelectBrand}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'product' && !activeProduct && (
          <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Product Not Found or Unpublished
            </h1>
            <p className="text-sm text-slate-600">
              This item may have been archived or removed from the active catalog.
            </p>
            <button
              type="button"
              onClick={() => handleNavigate('shop')}
              className="px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 rounded-lg"
            >
              Return to Catalog
            </button>
          </div>
        )}

        {(route === 'about' || route === 'privacy' || route === 'terms') && (
          <InfoPage
            mode={route}
            storeSettings={state.storeSettings}
            whatsappConfig={state.whatsappConfig}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'admin' && (
          <Suspense
            fallback={
              <div className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-slate-600">
                Loading Admin Console...
              </div>
            }
          >
            <AdminDashboard
              state={state}
              activeTab={adminTab}
              onChangeTab={setAdminTab}
              onUpsertProduct={handleUpsertProduct}
              onDeleteProduct={handleDeleteProduct}
              onUpsertCategory={handleUpsertCategory}
              onDeleteCategory={handleDeleteCategory}
              onUpsertBrand={handleUpsertBrand}
              onDeleteBrand={handleDeleteBrand}
              onUpdateWhatsAppConfig={handleUpdateWhatsAppConfig}
              onUpdateStoreSettings={handleUpdateStoreSettings}
              onResetSampleData={handleResetSampleData}
              storageWarning={storageWarning}
            />
          </Suspense>
        )}
      </main>

      {route !== 'admin' && (
        <Footer
          categories={state.categories}
          storeSettings={state.storeSettings}
          whatsappConfig={state.whatsappConfig}
          onNavigate={handleNavigate}
          onSelectCategory={handleSelectCategory}
          onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
        />
      )}

      <WhatsAppNoticeModal
        isOpen={waModalMessage !== null}
        onClose={() => setWaModalMessage(null)}
        previewMessage={waModalMessage || ''}
        onGoToAdminWhatsApp={() => {
          setAdminTab('whatsapp');
          handleNavigate('admin');
        }}
      />
    </div>
  );
}
