import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { WhatsAppNoticeModal } from './components/WhatsAppModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { INITIAL_CATALOG_STATE } from './data/sampleCatalog';
import { formatFirestoreUserMessage } from './firebase';
import { useSEO } from './hooks/useSEO';
import type { AdminTab } from './pages/AdminDashboard';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { HomePage } from './pages/HomePage';
import { InfoPage } from './pages/InfoPages';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { type ShopFilterState, ShopPage } from './pages/ShopPage';
import { buildNonDestructiveRecoveryState } from './services/dataService';
import {
  deleteBrandFromFirestore,
  deleteCategoryFromFirestore,
  deleteProductFromFirestore,
  hasLocalCatalogBackup,
  migrateCatalogToFirestore,
  type MigrationReport,
  restoreMissingCatalogToFirestore,
  saveBrandToFirestore,
  saveCategoryToFirestore,
  savePrivateAdminSettingsToFirestore,
  saveProductToFirestore,
  savePublicStoreSettingsToFirestore,
  subscribeBrands,
  subscribeCategories,
  subscribePrivateAdminSettings,
  subscribeProducts,
  subscribePublicStoreSettings,
} from './services/firestoreCatalogService';
import type {
  Brand,
  CatalogStoreState,
  Category,
  Product,
  StoreSettings,
  WhatsAppClickEvent,
  WhatsAppConfig,
} from './types/catalog';
import { sortCategoriesByOrder } from './utils/categoryTree';
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

function AppContent() {
  const {
    user,
    isAdmin,
    authLoading,
    authNotice,
    clearAuthNotice,
    logoutAdmin,
  } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(
    INITIAL_CATALOG_STATE.storeSettings
  );
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>(
    INITIAL_CATALOG_STATE.whatsappConfig
  );
  const [inquiryAnalytics, setInquiryAnalytics] = useState<WhatsAppClickEvent[]>([]);
  const [migratedAt, setMigratedAt] = useState<string | undefined>(undefined);
  const [hasLocalBackup] = useState<boolean>(() => hasLocalCatalogBackup());

  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [publicSettingsLoaded, setPublicSettingsLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncRetryCount, setSyncRetryCount] = useState(0);

  const recoveryCatalog = useMemo(() => buildNonDestructiveRecoveryState().state, []);
  const autoRestoreAttemptedRef = useRef(false);

  const initialParsed = useMemo(
    () => parseLocation(window.location.pathname, window.location.search),
    []
  );
  const initialSlugHydratedRef = useRef(false);

  const [route, setRoute] = useState<AppRoute>(initialParsed.route);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(
    initialParsed.productSlug
  );
  const [shopFilters, setShopFilters] = useState<ShopFilterState>({
    ...DEFAULT_FILTERS,
    query: initialParsed.searchQuery,
  });
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [waModalMessage, setWaModalMessage] = useState<string | null>(null);

  const catalogLoading = !(
    categoriesLoaded &&
    brandsLoaded &&
    productsLoaded &&
    publicSettingsLoaded
  );

  // Real-time Cloud Firestore listeners for storefront & admin catalog
  useEffect(() => {
    if (authLoading) return;

    setCatalogError(null);
    setCategoriesLoaded(false);
    setBrandsLoaded(false);
    setProductsLoaded(false);
    setPublicSettingsLoaded(false);

    const handleSnapshotError = (err: unknown) => {
      setCatalogError(formatFirestoreUserMessage(err));
      setCategoriesLoaded(true);
      setBrandsLoaded(true);
      setProductsLoaded(true);
      setPublicSettingsLoaded(true);
    };

    const unsubCats = subscribeCategories((list) => {
      setCategories(list);
      setCategoriesLoaded(true);
      setCatalogError(null);
    }, handleSnapshotError);

    const unsubBrands = subscribeBrands((list) => {
      setBrands(list);
      setBrandsLoaded(true);
    }, handleSnapshotError);

    const unsubProducts = subscribeProducts(
      isAdmin,
      (list) => {
        setProducts(list);
        setProductsLoaded(true);
      },
      handleSnapshotError
    );

    const unsubPublicSettings = subscribePublicStoreSettings((payload) => {
      setStoreSettings(payload.storeSettings);
      setWhatsappConfig((prev) => ({
        ...payload.whatsappConfig,
        trackLocalClicks: prev.trackLocalClicks,
      }));
      setPublicSettingsLoaded(true);
    }, handleSnapshotError);

    let unsubPrivateSettings: (() => void) | undefined;
    if (user && isAdmin) {
      unsubPrivateSettings = subscribePrivateAdminSettings(
        (payload) => {
          setWhatsappConfig((prev) => ({
            ...prev,
            trackLocalClicks: payload.trackLocalClicks,
          }));
          setMigratedAt(payload.migratedAt);
        },
        () => {
          // Non-blocking: private admin metadata defaults safely if doc not yet created
        }
      );
    }

    return () => {
      unsubCats();
      unsubBrands();
      unsubProducts();
      unsubPublicSettings();
      if (unsubPrivateSettings) {
        unsubPrivateSettings();
      }
    };
  }, [authLoading, isAdmin, user, syncRetryCount]);

  // When Firestore collections are empty (fresh or wiped DB), serve non-destructive
  // browser backup + baseline categories/catalog on storefront until Firestore is populated.
  const usingFallbackCatalog =
    categoriesLoaded && categories.length === 0 && !catalogError;

  const effectiveCategories = useMemo(
    () =>
      usingFallbackCatalog
        ? sortCategoriesByOrder(recoveryCatalog.categories)
        : sortCategoriesByOrder(categories),
    [usingFallbackCatalog, recoveryCatalog.categories, categories]
  );

  const effectiveBrands = useMemo(
    () =>
      brandsLoaded && brands.length === 0 && usingFallbackCatalog
        ? recoveryCatalog.brands
        : brands,
    [brandsLoaded, brands, usingFallbackCatalog, recoveryCatalog.brands]
  );

  const effectiveProducts = useMemo(
    () =>
      productsLoaded && products.length === 0 && usingFallbackCatalog
        ? recoveryCatalog.products
        : products,
    [productsLoaded, products, usingFallbackCatalog, recoveryCatalog.products]
  );

  // Automatic non-destructive restore when verified admin connects to an empty categories collection
  useEffect(() => {
    if (
      authLoading ||
      !user ||
      !isAdmin ||
      !categoriesLoaded ||
      !brandsLoaded ||
      !productsLoaded ||
      catalogError ||
      categories.length > 0 ||
      autoRestoreAttemptedRef.current
    ) {
      return;
    }

    autoRestoreAttemptedRef.current = true;
    void restoreMissingCatalogToFirestore(user.uid).catch(() => {
      // Admin can also re-run manual sync from Overview or Categories tab if needed
    });
  }, [
    authLoading,
    user,
    isAdmin,
    categoriesLoaded,
    brandsLoaded,
    productsLoaded,
    catalogError,
    categories.length,
  ]);

  // Hydrate initial URL category slug (/category/:slug or ?category=) once catalog resolves
  useEffect(() => {
    if (!categoriesLoaded || initialSlugHydratedRef.current) return;
    initialSlugHydratedRef.current = true;
    if (initialParsed.categorySlug) {
      const matched = effectiveCategories.find((c) => c.slug === initialParsed.categorySlug);
      if (matched) {
        setShopFilters((prev) => ({ ...prev, categoryId: matched.id }));
      }
    }
  }, [categoriesLoaded, effectiveCategories, initialParsed.categorySlug]);

  // Redirect unauthorized non-admin sessions away from /admin
  useEffect(() => {
    if (!authLoading && route === 'admin' && authNotice && (!user || !isAdmin)) {
      setRoute('home');
      setSelectedProductSlug(null);
      if (window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [authLoading, route, authNotice, user, isAdmin]);

  // Sync browser Back/Forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseLocation(window.location.pathname, window.location.search);
      setRoute(parsed.route);
      setSelectedProductSlug(parsed.productSlug);
      if (parsed.route === 'shop') {
        const cat = parsed.categorySlug
          ? effectiveCategories.find((c) => c.slug === parsed.categorySlug)
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
  }, [effectiveCategories]);

  const storefrontState: CatalogStoreState = useMemo(
    () => ({
      categories: effectiveCategories,
      brands: effectiveBrands,
      products: effectiveProducts,
      whatsappConfig,
      storeSettings,
      inquiryAnalytics,
    }),
    [
      effectiveCategories,
      effectiveBrands,
      effectiveProducts,
      whatsappConfig,
      storeSettings,
      inquiryAnalytics,
    ]
  );

  // Admin Console displays exact live Firestore documents (without masking missing docs as synced)
  const adminFirestoreState: CatalogStoreState = useMemo(
    () => ({
      categories: sortCategoriesByOrder(categories),
      brands,
      products,
      whatsappConfig,
      storeSettings,
      inquiryAnalytics,
    }),
    [categories, brands, products, whatsappConfig, storeSettings, inquiryAnalytics]
  );

  const activeProduct = useMemo(
    () =>
      selectedProductSlug
        ? storefrontState.products.find(
            (p) => p.slug === selectedProductSlug && p.published && !p.archived
          ) || null
        : null,
    [storefrontState.products, selectedProductSlug]
  );

  const activeProductBrand = useMemo(
    () =>
      activeProduct
        ? storefrontState.brands.find((b) => b.id === activeProduct.brandId)
        : undefined,
    [activeProduct, storefrontState.brands]
  );

  const activeProductCategory = useMemo(
    () =>
      activeProduct
        ? storefrontState.categories.find((c) => c.id === activeProduct.categoryId)
        : undefined,
    [activeProduct, storefrontState.categories]
  );

  const activeShopCategory = useMemo(
    () =>
      shopFilters.categoryId !== 'all'
        ? storefrontState.categories.find((c) => c.id === shopFilters.categoryId)
        : undefined,
    [shopFilters.categoryId, storefrontState.categories]
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
    const brandName = storeSettings.storeName;
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
        title: isAdmin ? `Admin Console | ${brandName}` : `Admin Sign In | ${brandName}`,
        description: storeSettings.seoDescription,
        noIndex: true,
      };
    }
    return {
      title: storeSettings.seoTitle,
      description: storeSettings.seoDescription,
      noIndex: false,
    };
  }, [route, activeProduct, activeShopCategory, storeSettings, isAdmin]);

  useSEO({
    title: seoMeta.title,
    description: seoMeta.description,
    canonicalPath,
    noIndex: seoMeta.noIndex,
    product: route === 'product' ? activeProduct : null,
    brand: activeProductBrand,
    category: route === 'product' ? activeProductCategory : activeShopCategory,
    storeSettings,
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
      if (nextRoute !== 'home') {
        clearAuthNotice();
      }
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
          categories: storefrontState.categories,
        })
      );
    },
    [storefrontState.categories, clearAuthNotice]
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
          categories: storefrontState.categories,
        })
      );
    },
    [storefrontState.categories]
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
          categories: storefrontState.categories,
        })
      );
    },
    [storefrontState.categories]
  );

  const handleTrackWhatsAppClick = useCallback(
    (payload: {
      productId: string;
      productName: string;
      sku: string;
      price: number;
      source: 'pdp' | 'card' | 'general';
    }) => {
      if (!whatsappConfig.trackLocalClicks) return;
      setInquiryAnalytics((prev) =>
        [
          {
            id: `wa-${Date.now()}`,
            productId: payload.productId,
            productName: payload.productName,
            sku: payload.sku,
            price: payload.price,
            source: payload.source,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 50)
      );
    },
    [whatsappConfig.trackLocalClicks]
  );

  const handleAdminLogout = useCallback(async () => {
    await logoutAdmin();
    setRoute('home');
    pushPath('/');
  }, [logoutAdmin]);

  // Admin Cloud Firestore mutation handlers (strictly guarded to verified admin)
  const requireVerifiedAdminUid = (): string => {
    if (!user || !isAdmin) {
      throw new Error('Verified administrator authentication is required for Firestore writes.');
    }
    return user.uid;
  };

  const handleUpsertProduct = async (product: Product): Promise<void> => {
    const uid = requireVerifiedAdminUid();
    await saveProductToFirestore(product, uid);
  };

  const handleDeleteProduct = async (productId: string): Promise<void> => {
    requireVerifiedAdminUid();
    await deleteProductFromFirestore(productId);
  };

  const handleUpsertCategory = async (category: Category): Promise<void> => {
    const uid = requireVerifiedAdminUid();
    await saveCategoryToFirestore(category, uid);
  };

  const handleDeleteCategory = async (categoryId: string): Promise<void> => {
    requireVerifiedAdminUid();
    await deleteCategoryFromFirestore(categoryId);
  };

  const handleUpsertBrand = async (brand: Brand): Promise<void> => {
    const uid = requireVerifiedAdminUid();
    await saveBrandToFirestore(brand, uid);
  };

  const handleDeleteBrand = async (brandId: string): Promise<void> => {
    requireVerifiedAdminUid();
    await deleteBrandFromFirestore(brandId);
  };

  const handleUpdateWhatsAppConfig = async (config: WhatsAppConfig): Promise<void> => {
    const uid = requireVerifiedAdminUid();
    const { trackLocalClicks, ...publicWa } = config;
    await Promise.all([
      savePublicStoreSettingsToFirestore(storeSettings, publicWa, uid),
      savePrivateAdminSettingsToFirestore(trackLocalClicks, uid),
    ]);
  };

  const handleUpdateStoreSettings = async (nextSettings: StoreSettings): Promise<void> => {
    const uid = requireVerifiedAdminUid();
    const { trackLocalClicks: _ignored, ...publicWa } = whatsappConfig;
    await savePublicStoreSettingsToFirestore(nextSettings, publicWa, uid);
  };

  const handleMigrateToFirestore = async (
    mode: 'localStorage' | 'sampleCatalog' | 'restoreCombined'
  ): Promise<MigrationReport> => {
    const uid = requireVerifiedAdminUid();
    return migrateCatalogToFirestore(uid, mode);
  };

  const isCatalogView =
    route === 'home' || route === 'shop' || route === 'categories' || route === 'product';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Header
        activeRoute={route}
        searchQuery={shopFilters.query}
        onNavigate={handleNavigate}
        onSearchSubmit={handleSearchSubmit}
      />

      {authNotice && route !== 'admin' && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-3 sm:px-6 py-2.5 text-xs text-rose-900"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <p className="font-medium">{authNotice}</p>
            <button
              type="button"
              onClick={clearAuthNotice}
              className="font-semibold text-rose-800 hover:text-rose-950 shrink-0 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {catalogError && route !== 'admin' && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-3 sm:px-6 py-2.5 text-xs text-amber-950"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">{catalogError}</p>
            <button
              type="button"
              onClick={() => setSyncRetryCount((c) => c + 1)}
              className="font-semibold text-amber-900 hover:text-slate-900 underline shrink-0"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {isCatalogView && catalogLoading && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-14 text-center space-y-2">
            <div className="w-7 h-7 border-2 border-slate-300 border-t-orange-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600">Loading TechnHobbies catalog...</p>
          </div>
        )}

        {route === 'home' && !catalogLoading && (
          <HomePage
            products={storefrontState.products}
            categories={storefrontState.categories}
            whatsappConfig={whatsappConfig}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'shop' && !catalogLoading && (
          <ShopPage
            products={storefrontState.products}
            categories={storefrontState.categories}
            brands={storefrontState.brands}
            filters={shopFilters}
            whatsappConfig={whatsappConfig}
            onChangeFilters={handleChangeShopFilters}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'categories' && !catalogLoading && (
          <CategoriesPage
            categories={storefrontState.categories}
            products={storefrontState.products}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {route === 'product' && !catalogLoading && activeProduct && (
          <ProductDetailPage
            product={activeProduct}
            allProducts={storefrontState.products}
            categories={storefrontState.categories}
            brand={activeProductBrand}
            category={activeProductCategory}
            whatsappConfig={whatsappConfig}
            onBackToShop={() => handleNavigate('shop')}
            onSelectCategory={handleSelectCategory}
            onSelectBrand={handleSelectBrand}
            onSelectProduct={handleSelectProduct}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'product' && !catalogLoading && !activeProduct && (
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
            storeSettings={storeSettings}
            whatsappConfig={whatsappConfig}
            onTrackWhatsAppClick={handleTrackWhatsAppClick}
            onUnconfiguredWhatsApp={(msg) => setWaModalMessage(msg)}
          />
        )}

        {route === 'admin' && authLoading && (
          <div className="max-w-md mx-auto px-4 py-16 text-center text-sm text-slate-600">
            Verifying administrator session...
          </div>
        )}

        {route === 'admin' && !authLoading && (!user || !isAdmin) && (
          <AdminLoginPage
            notice={authNotice}
            onBackToStorefront={() => handleNavigate('home')}
          />
        )}

        {route === 'admin' && !authLoading && user && isAdmin && (
          <Suspense
            fallback={
              <div className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-slate-600">
                Loading Admin Console...
              </div>
            }
          >
            <AdminDashboard
              state={adminFirestoreState}
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
              onMigrateToFirestore={handleMigrateToFirestore}
              hasLocalBackup={hasLocalBackup}
              migratedAt={migratedAt}
              catalogLoading={catalogLoading}
              catalogError={catalogError}
              onRetryCatalogSync={() => setSyncRetryCount((c) => c + 1)}
              adminEmail={user.email || 'technhobbies268@gmail.com'}
              emailVerified={user.emailVerified}
              onLogout={handleAdminLogout}
            />
          </Suspense>
        )}
      </main>

      {route !== 'admin' && (
        <Footer
          storeSettings={storeSettings}
          whatsappConfig={whatsappConfig}
          onNavigate={handleNavigate}
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
