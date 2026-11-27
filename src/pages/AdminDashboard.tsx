import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Cloud,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  Globe,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductEditorModal } from '../components/admin/ProductEditorModal';
import { ProductPreviewModal } from '../components/admin/ProductPreviewModal';
import { ResilientImage } from '../components/ResilientImage';
import {
  buildProductInquiryMessage,
  DEFAULT_WHATSAPP_TEMPLATE,
  formatWhatsAppDisplayNumber,
  getEnvWhatsAppNumber,
  isWhatsAppConfigured,
  resolveEffectiveWhatsAppNumber,
  sanitizeWhatsAppDigits,
  toInternationalWhatsAppNumber,
} from '../config/whatsapp';
import { formatFirestoreUserMessage } from '../firebase';
import type { MigrationReport } from '../services/firestoreCatalogService';
import type {
  Brand,
  CatalogStoreState,
  Category,
  Product,
  StoreSettings,
  WhatsAppConfig,
} from '../types/catalog';
import { formatPKR } from '../utils/currency';
import {
  getChildCategories,
  getTopLevelCategories,
  productMatchesCategoryFilter,
  wouldCreateCategoryCycle,
} from '../utils/categoryTree';
import { isValidImageSource, MIN_PRODUCT_IMAGES, sanitizeExternalUrl } from '../utils/url';

export type AdminTab =
  | 'overview'
  | 'products'
  | 'taxonomy'
  | 'whatsapp'
  | 'settings';

interface AdminDashboardProps {
  state: CatalogStoreState;
  activeTab: AdminTab;
  onChangeTab: (tab: AdminTab) => void;
  onUpsertProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onUpsertCategory: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onUpsertBrand: (brand: Brand) => Promise<void>;
  onDeleteBrand: (brandId: string) => Promise<void>;
  onUpdateWhatsAppConfig: (config: WhatsAppConfig) => Promise<void>;
  onUpdateStoreSettings: (settings: StoreSettings) => Promise<void>;
  onMigrateToFirestore: (
    mode: 'localStorage' | 'sampleCatalog' | 'restoreCombined'
  ) => Promise<MigrationReport>;
  hasLocalBackup: boolean;
  migratedAt?: string;
  catalogLoading?: boolean;
  catalogError?: string | null;
  onRetryCatalogSync?: () => void;
  adminEmail: string;
  emailVerified: boolean;
  onLogout: () => Promise<void> | void;
}

export function AdminDashboard({
  state,
  activeTab,
  onChangeTab,
  onUpsertProduct,
  onDeleteProduct,
  onUpsertCategory,
  onDeleteCategory,
  onUpsertBrand,
  onDeleteBrand,
  onUpdateWhatsAppConfig,
  onUpdateStoreSettings,
  onMigrateToFirestore,
  hasLocalBackup,
  migratedAt,
  catalogLoading = false,
  catalogError = null,
  onRetryCatalogSync,
  adminEmail,
  emailVerified,
  onLogout,
}: AdminDashboardProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'published' | 'draft' | 'archived'>('active');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [previewingProduct, setPreviewingProduct] = useState<Product | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  // Confirmation modal & inline feedback
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [savingWa, setSavingWa] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Firestore migration & restore state
  const [migratingMode, setMigratingMode] = useState<
    'localStorage' | 'sampleCatalog' | 'restoreCombined' | null
  >(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // Taxonomy local forms
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [catSlugTouched, setCatSlugTouched] = useState(false);
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatOrder, setNewCatOrder] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [newCatFeatured, setNewCatFeatured] = useState(true);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCountry, setNewBrandCountry] = useState('');
  const [newBrandSpecialty, setNewBrandSpecialty] = useState('');

  // WhatsApp config local state
  const [waDraft, setWaDraft] = useState<WhatsAppConfig>(state.whatsappConfig);
  const [waSavedBanner, setWaSavedBanner] = useState(false);

  // Store settings local state
  const [settingsDraft, setSettingsDraft] = useState<StoreSettings>(state.storeSettings);
  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);

  useEffect(() => {
    setWaDraft(state.whatsappConfig);
  }, [state.whatsappConfig]);

  useEffect(() => {
    setSettingsDraft(state.storeSettings);
  }, [state.storeSettings]);

  useEffect(() => {
    if (!confirmAction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmBusy) setConfirmAction(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmAction, confirmBusy]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setAdminFeedback({ type, message });
    window.setTimeout(() => {
      setAdminFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const envNumber = getEnvWhatsAppNumber();
  const effectiveWaNumber = resolveEffectiveWhatsAppNumber(state.whatsappConfig.businessNumber);
  const waReady = isWhatsAppConfigured(state.whatsappConfig);

  const activeProducts = state.products.filter((p) => !p.archived);
  const publishedCount = activeProducts.filter((p) => p.published).length;
  const draftCount = activeProducts.filter((p) => !p.published).length;
  const archivedCount = state.products.filter((p) => p.archived).length;
  const featuredCount = activeProducts.filter((p) => p.featured).length;

  const filteredAdminProducts = state.products.filter((p) => {
    if (statusFilter === 'active' && p.archived) return false;
    if (statusFilter === 'published' && (!p.published || p.archived)) return false;
    if (statusFilter === 'draft' && (p.published || p.archived)) return false;
    if (statusFilter === 'archived' && !p.archived) return false;
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  const getQuickPublishError = (product: Product): string | null => {
    const validCount = (product.images || []).filter((img) => isValidImageSource(img)).length;
    if (validCount < MIN_PRODUCT_IMAGES) {
      return `"${product.name}" needs at least ${MIN_PRODUCT_IMAGES} valid product image URLs before publishing (currently ${validCount}). Click Edit to add image URLs.`;
    }
    return null;
  };

  const handleQuickProductUpdate = async (product: Product, successMsg: string) => {
    if (busyProductId) return;
    setBusyProductId(product.id);
    try {
      await onUpsertProduct(product);
      showFeedback('success', successMsg);
    } catch (err) {
      showFeedback('error', formatFirestoreUserMessage(err));
    } finally {
      setBusyProductId(null);
    }
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingWa) return;
    setWaError(null);
    const cleaned = sanitizeWhatsAppDigits(waDraft.businessNumber);
    if (waDraft.businessNumber.trim() && cleaned.length < 10) {
      setWaError('Enter a valid WhatsApp number with at least 10 digits (e.g. 923313713705), or leave blank.');
      return;
    }
    setSavingWa(true);
    try {
      await onUpdateWhatsAppConfig({
        ...waDraft,
        businessNumber: cleaned,
      });
      setWaSavedBanner(true);
      window.setTimeout(() => setWaSavedBanner(false), 3000);
    } catch (err) {
      setWaError(formatFirestoreUserMessage(err));
    } finally {
      setSavingWa(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;
    setSettingsError(null);

    const trimmedEmail = settingsDraft.contactEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSettingsError('Enter a valid contact email address or leave it blank.');
      return;
    }

    const socialEntries: [string, string][] = [
      ['Instagram', settingsDraft.socialLinks.instagram],
      ['YouTube', settingsDraft.socialLinks.youtube],
      ['Facebook', settingsDraft.socialLinks.facebook],
    ];
    for (const [label, rawUrl] of socialEntries) {
      if (rawUrl.trim() && !sanitizeExternalUrl(rawUrl)) {
        setSettingsError(`Enter a valid https:// or http:// URL for ${label}, or leave blank.`);
        return;
      }
    }

    setSavingSettings(true);
    try {
      await onUpdateStoreSettings({
        ...settingsDraft,
        storeName: settingsDraft.storeName.trim() || 'TechnHobbies',
        tagline: settingsDraft.tagline.trim() || 'Explore. Build. Control.',
        cityBase: settingsDraft.cityBase.trim(),
        contactEmail: trimmedEmail,
        socialLinks: {
          instagram: sanitizeExternalUrl(settingsDraft.socialLinks.instagram),
          youtube: sanitizeExternalUrl(settingsDraft.socialLinks.youtube),
          facebook: sanitizeExternalUrl(settingsDraft.socialLinks.facebook),
        },
      });
      setSettingsSavedBanner(true);
      window.setTimeout(() => setSettingsSavedBanner(false), 3000);
    } catch (err) {
      setSettingsError(formatFirestoreUserMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunMigration = async (
    mode: 'localStorage' | 'sampleCatalog' | 'restoreCombined'
  ) => {
    if (migratingMode) return;
    setMigratingMode(mode);
    setMigrationError(null);
    setMigrationReport(null);
    try {
      const report = await onMigrateToFirestore(mode);
      setMigrationReport(report);
      showFeedback(
        'success',
        `Cloud Firestore sync complete: added ${report.addedCategories} category(ies), ${report.addedBrands} brand(s), ${report.addedProducts} product(s).`
      );
    } catch (err) {
      setMigrationError(formatFirestoreUserMessage(err));
    } finally {
      setMigratingMode(null);
    }
  };

  const sampleProductForPreview = state.products[0];
  const waPreviewText = sampleProductForPreview
    ? buildProductInquiryMessage(
        {
          productName: sampleProductForPreview.name,
          sku: sampleProductForPreview.sku,
          price: sampleProductForPreview.price,
          productUrl: `${window.location.origin}/product/${encodeURIComponent(sampleProductForPreview.slug)}`,
        },
        waDraft.defaultMessageTemplate
      )
    : '';

  const navItems: { id: AdminTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'products', label: 'Products & Pricing', icon: Package },
    { id: 'taxonomy', label: 'Categories & Brands', icon: FolderTree },
    { id: 'whatsapp', label: 'WhatsApp Settings', icon: MessageCircle },
    { id: 'settings', label: 'Store & SEO', icon: Globe },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
        {/* Sidebar Navigation (compact horizontal rail on mobile, 240px–260px sidebar on desktop) */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 lg:space-y-4 min-w-0">
          <div className="flex items-start justify-between gap-2 lg:block px-1 lg:px-2 pb-2.5 lg:pb-3 border-b border-slate-200">
            <div className="min-w-0 space-y-0.5 sm:space-y-1">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange-700">
                Admin Console
              </p>
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                TechnHobbies Manager
              </h1>
              <p className="text-xs text-slate-600 truncate sm:break-all">{adminEmail}</p>
            </div>
            <div className="flex lg:hidden items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  try {
                    await onLogout();
                  } finally {
                    setLoggingOut(false);
                  }
                }}
                aria-label={loggingOut ? 'Signing Out' : 'Logout'}
                className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{loggingOut ? 'Exiting...' : 'Logout'}</span>
              </button>
            </div>
          </div>

          <nav
            className="flex overflow-x-auto no-scrollbar gap-1.5 pb-0.5 lg:block lg:space-y-1 lg:overflow-visible"
            aria-label="Admin sections"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 bg-slate-50 lg:bg-transparent hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:block pt-3 border-t border-slate-200 space-y-2">
            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await onLogout();
                } finally {
                  setLoggingOut(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{loggingOut ? 'Signing Out...' : 'Logout'}</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* Firebase Auth & Cloud Firestore Status Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-950">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                Verified Admin Session ({adminEmail} · {emailVerified ? 'Verified' : 'Unverified'})
              </p>
              <p className="text-emerald-900 leading-relaxed">
                Connected to Cloud Firestore with real-time storefront synchronization. All product,
                category, brand, WhatsApp, and store setting edits persist in Firestore and enforce
                server-side <code className="font-mono">firestore.rules</code>.
              </p>
            </div>
          </div>

          {catalogError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{catalogError}</p>
              </div>
              {onRetryCatalogSync && (
                <button
                  type="button"
                  onClick={onRetryCatalogSync}
                  className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-semibold text-rose-800 bg-white border border-rose-300 hover:bg-rose-100 rounded-lg shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Sync</span>
                </button>
              )}
            </div>
          )}

          {adminFeedback && (
            <div
              role="status"
              className={`rounded-xl p-3.5 flex items-center gap-2.5 text-xs font-semibold border ${
                adminFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {adminFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{adminFeedback.message}</span>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                  Catalog &amp; Inquiry Overview
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Manage PKR product pricing, specifications, categories, and direct WhatsApp
                  inquiry routing. Cart, checkout, payment, and order modules are disabled by
                  design.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
                  <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-medium text-slate-500">Active Products</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                      {activeProducts.length}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      {publishedCount} published · {draftCount} drafts
                    </p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-medium text-slate-500">Featured Models</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                      {featuredCount}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Homepage showcase</p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-medium text-slate-500">Categories / Brands</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                      {state.categories.length} / {state.brands.length}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Active taxonomy</p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-medium text-slate-500">WhatsApp Inquiries</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                      {state.inquiryAnalytics.length}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Local session clicks</p>
                  </div>
                </div>
              </div>

              {/* Cloud Firestore Sync & One-Time Migration Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-orange-600 shrink-0" />
                      <h3 className="text-base font-bold text-slate-900">
                        Cloud Firestore Sync &amp; One-Time Migration
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      Safely import missing categories, brands, products, and settings into Cloud
                      Firestore without overwriting existing Firestore records or duplicating SKUs.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                    <Database className="w-3.5 h-3.5" />
                    <span>
                      {catalogLoading
                        ? 'Syncing...'
                        : `${state.products.length} total product(s) in Firestore`}
                    </span>
                  </span>
                </div>

                {migratedAt && (
                  <p className="text-xs text-slate-500">
                    Last migration recorded: <span className="font-mono">{migratedAt}</span>
                  </p>
                )}

                {migrationError && (
                  <div
                    role="alert"
                    className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900"
                  >
                    {migrationError}
                  </div>
                )}

                {migrationReport && (
                  <div
                    role="status"
                    className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-950 space-y-1.5"
                  >
                    <p className="font-semibold">
                      Migration Report ({migrationReport.source})
                    </p>
                    <p>
                      Added: <strong>{migrationReport.addedCategories}</strong> categories,{' '}
                      <strong>{migrationReport.addedBrands}</strong> brands,{' '}
                      <strong>{migrationReport.addedProducts}</strong> products
                      {migrationReport.settingsInitialized ? ', initialized public store settings' : ''}.
                      Skipped existing: {migrationReport.skippedCategories} categories,{' '}
                      {migrationReport.skippedBrands} brands, {migrationReport.skippedProducts} products.
                    </p>
                    {migrationReport.idbImageWarnings.length > 0 && (
                      <p className="text-amber-900 font-medium">
                        Note: {migrationReport.idbImageWarnings.length} product(s) had browser-only{' '}
                        <code className="font-mono">idb://</code> images excluded from Firestore (
                        {migrationReport.idbImageWarnings.join(', ')}). Update them with{' '}
                        <code className="font-mono">https://</code> URLs until Firebase Storage is enabled.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={migratingMode !== null}
                    onClick={() => void handleRunMigration('restoreCombined')}
                    className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg"
                  >
                    {migratingMode === 'restoreCombined' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>
                      {migratingMode === 'restoreCombined'
                        ? 'Restoring Missing Categories & Catalog...'
                        : 'Restore Missing Categories & Catalog Items'}
                    </span>
                  </button>

                  {hasLocalBackup && (
                    <button
                      type="button"
                      disabled={migratingMode !== null}
                      onClick={() => void handleRunMigration('localStorage')}
                      className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 border border-slate-200 rounded-lg"
                    >
                      {migratingMode === 'localStorage' && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>
                        {migratingMode === 'localStorage'
                          ? 'Migrating Browser Catalog...'
                          : 'Migrate Browser localStorage Catalog'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={migratingMode !== null}
                    onClick={() => void handleRunMigration('sampleCatalog')}
                    className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 border border-slate-200 rounded-lg"
                  >
                    {migratingMode === 'sampleCatalog' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>
                      {migratingMode === 'sampleCatalog'
                        ? 'Importing Missing Sample Items...'
                        : 'Seed Default Sample Catalog (Missing Items Only)'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    WhatsApp Business Channel Status
                  </h3>
                  {waReady ? (
                    <p className="text-sm text-emerald-800 font-medium">
                      Configured: {formatWhatsAppDisplayNumber(effectiveWaNumber)} (wa.me/
                      {toInternationalWhatsAppNumber(effectiveWaNumber)}) — Official click-to-chat
                      links active across storefront.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-800 font-medium">
                      Not Configured: Set your official business WhatsApp number before publishing
                      live links.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTab('whatsapp')}
                  className="w-full sm:w-auto px-4 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
                >
                  Configure WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* PRODUCTS MANAGEMENT TAB */}
          {activeTab === 'products' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                    Product Catalog &amp; PKR Pricing
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Add, edit, price, feature, publish, or archive RC hardware.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 md:max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Filter by product name or SKU..."
                    className="w-full pl-9 pr-3 min-h-[44px] text-base md:text-sm bg-white border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('active')}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      statusFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    All Active ({activeProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('published')}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      statusFilter === 'published' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Published ({publishedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('draft')}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      statusFilter === 'draft' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Drafts ({draftCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('archived')}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      statusFilter === 'archived' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Archived ({archivedCount})
                  </button>
                </div>
              </div>

              {/* Mobile Product Cards */}
              <div className="md:hidden divide-y divide-slate-200">
                {filteredAdminProducts.length === 0 ? (
                  <p className="py-10 px-4 text-center text-sm text-slate-500">
                    No products in this view.
                  </p>
                ) : (
                  filteredAdminProducts.map((product) => {
                    const thumbSrc = product.primaryImage || product.images[0];
                    const imageCount = (product.images || []).filter((img) =>
                      isValidImageSource(img)
                    ).length;

                    return (
                      <div key={product.id} className="p-3.5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-12 rounded-md bg-slate-100 overflow-hidden shrink-0">
                            <ResilientImage
                              src={thumbSrc}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                                {product.name}
                              </p>
                              <span
                                className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                                  product.archived
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : product.published
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {product.archived
                                  ? 'Archived'
                                  : product.published
                                    ? 'Published'
                                    : 'Draft'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {state.brands.find((b) => b.id === product.brandId)?.name || '—'} ·{' '}
                              <span className="font-mono">{product.sku}</span> · {imageCount} img
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="font-mono tabular-nums">
                            <span className="text-sm font-bold text-slate-900">
                              {formatPKR(product.price)}
                            </span>
                            {product.originalPrice && (
                              <span className="ml-1.5 text-[11px] text-slate-400 line-through">
                                {formatPKR(product.originalPrice)}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-700 whitespace-nowrap">
                            <span className="font-medium">{product.stockStatus}</span>
                            <span className="text-slate-400 ml-1 tabular-nums">
                              ({product.stockCount})
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            {!product.archived && (
                              <button
                                type="button"
                                disabled={busyProductId === product.id}
                                onClick={() => {
                                  if (!product.published) {
                                    const err = getQuickPublishError(product);
                                    if (err) {
                                      showFeedback('error', err);
                                      return;
                                    }
                                  }
                                  void handleQuickProductUpdate(
                                    {
                                      ...product,
                                      published: !product.published,
                                      archived: false,
                                    },
                                    `${product.name} ${product.published ? 'moved to Draft' : 'published live'}.`
                                  );
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 min-h-[44px] text-xs font-semibold rounded-lg border disabled:opacity-50 ${
                                  product.published
                                    ? 'text-slate-700 bg-slate-50 border-slate-200'
                                    : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                }`}
                              >
                                {product.published ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Unpublish</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Publish</span>
                                  </>
                                )}
                              </button>
                            )}

                            {!product.archived && (
                              <button
                                type="button"
                                disabled={busyProductId === product.id}
                                onClick={() =>
                                  void handleQuickProductUpdate(
                                    { ...product, featured: !product.featured },
                                    `${product.name} ${product.featured ? 'removed from' : 'added to'} Featured.`
                                  )
                                }
                                aria-label="Toggle Featured"
                                className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border disabled:opacity-50 ${
                                  product.featured
                                    ? 'text-amber-600 bg-amber-50 border-amber-200'
                                    : 'text-slate-400 bg-slate-50 border-slate-200'
                                }`}
                              >
                                <Star
                                  className={`w-4 h-4 ${product.featured ? 'fill-amber-500' : ''}`}
                                />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewingProduct(product)}
                              aria-label={`Preview ${product.name}`}
                              title="Preview product"
                              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(product);
                                setIsProductModalOpen(true);
                              }}
                              aria-label={`Edit ${product.name}`}
                              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busyProductId === product.id}
                              onClick={() =>
                                void handleQuickProductUpdate(
                                  {
                                    ...product,
                                    archived: !product.archived,
                                    published: false,
                                  },
                                  `${product.name} ${product.archived ? 'restored to Draft' : 'archived'}.`
                                )
                              }
                              aria-label={product.archived ? 'Restore product to draft' : 'Archive product'}
                              title={product.archived ? 'Restore to Draft' : 'Archive product'}
                              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 bg-slate-100 hover:text-amber-700 disabled:opacity-50 rounded-lg"
                            >
                              {product.archived ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busyProductId === product.id}
                              onClick={() =>
                                setConfirmAction({
                                  title: 'Delete Product?',
                                  message: `Permanently delete "${product.name}" (${product.sku}) from Cloud Firestore? This action cannot be undone.`,
                                  confirmLabel: 'Delete Product',
                                  onConfirm: async () => {
                                    await onDeleteProduct(product.id);
                                    setConfirmAction(null);
                                    showFeedback('success', `Deleted "${product.name}".`);
                                  },
                                })
                              }
                              aria-label={`Delete ${product.name}`}
                              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop & Tablet Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-3">SKU</th>
                      <th className="py-3 px-3 text-right">PKR Price</th>
                      <th className="py-3 px-3">Stock</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredAdminProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                          No products in this view.
                        </td>
                      </tr>
                    ) : (
                      filteredAdminProducts.map((product) => {
                        const thumbSrc = product.primaryImage || product.images[0];
                        const imageCount = (product.images || []).filter((img) =>
                          isValidImageSource(img)
                        ).length;

                        return (
                          <tr key={product.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-9 rounded bg-slate-100 overflow-hidden shrink-0">
                                  <ResilientImage
                                    src={thumbSrc}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0 max-w-xs">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {state.brands.find((b) => b.id === product.brandId)?.name || '—'} ·{' '}
                                    {product.condition} · {imageCount} image{imageCount === 1 ? '' : 's'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                              {product.sku}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                              <p className="font-semibold text-slate-900">
                                {formatPKR(product.price)}
                              </p>
                              {product.originalPrice && (
                                <p className="text-[11px] text-slate-400 line-through">
                                  {formatPKR(product.originalPrice)}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 text-xs whitespace-nowrap">
                              <span className="font-medium text-slate-800">
                                {product.stockStatus}
                              </span>
                              <span className="text-slate-400 ml-1 tabular-nums">
                                ({product.stockCount})
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border ${
                                    product.archived
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : product.published
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {product.archived
                                    ? 'Archived'
                                    : product.published
                                      ? 'Published'
                                      : 'Draft'}
                                </span>

                                {!product.archived && (
                                  <button
                                    type="button"
                                    disabled={busyProductId === product.id}
                                    onClick={() => {
                                      if (!product.published) {
                                        const err = getQuickPublishError(product);
                                        if (err) {
                                          showFeedback('error', err);
                                          return;
                                        }
                                      }
                                      void handleQuickProductUpdate(
                                        {
                                          ...product,
                                          published: !product.published,
                                          archived: false,
                                        },
                                        `${product.name} ${product.published ? 'moved to Draft' : 'published live'}.`
                                      );
                                    }}
                                    title={product.published ? 'Unpublish to Draft' : 'Publish live'}
                                    className="text-xs font-semibold text-orange-700 hover:underline disabled:opacity-50"
                                  >
                                    {product.published ? 'Unpublish' : 'Publish'}
                                  </button>
                                )}

                                {!product.archived && (
                                  <button
                                    type="button"
                                    disabled={busyProductId === product.id}
                                    onClick={() =>
                                      void handleQuickProductUpdate(
                                        { ...product, featured: !product.featured },
                                        `${product.name} ${product.featured ? 'removed from' : 'added to'} Featured.`
                                      )
                                    }
                                    title="Toggle Featured"
                                    className={`p-1 disabled:opacity-50 ${
                                      product.featured
                                        ? 'text-amber-500'
                                        : 'text-slate-300 hover:text-slate-500'
                                    }`}
                                  >
                                    <Star
                                      className={`w-4 h-4 ${product.featured ? 'fill-amber-500' : ''}`}
                                    />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewingProduct(product)}
                                  aria-label={`Preview ${product.name}`}
                                  title="Preview storefront appearance"
                                  className="p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsProductModalOpen(true);
                                  }}
                                  aria-label={`Edit ${product.name}`}
                                  title="Edit product"
                                  className="p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={busyProductId === product.id}
                                  onClick={() =>
                                    void handleQuickProductUpdate(
                                      {
                                        ...product,
                                        archived: !product.archived,
                                        published: false,
                                      },
                                      `${product.name} ${product.archived ? 'restored to Draft' : 'archived'}.`
                                    )
                                  }
                                  aria-label={product.archived ? 'Restore product to draft' : 'Archive product'}
                                  title={product.archived ? 'Restore to Draft' : 'Archive product'}
                                  className="p-2 text-slate-600 hover:text-amber-700 disabled:opacity-50 rounded hover:bg-slate-200/70"
                                >
                                  {product.archived ? (
                                    <RotateCcw className="w-4 h-4" />
                                  ) : (
                                    <Archive className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={busyProductId === product.id}
                                  onClick={() =>
                                    setConfirmAction({
                                      title: 'Delete Product?',
                                      message: `Permanently delete "${product.name}" (${product.sku}) from Cloud Firestore? This action cannot be undone.`,
                                      confirmLabel: 'Delete Product',
                                      onConfirm: async () => {
                                        await onDeleteProduct(product.id);
                                        setConfirmAction(null);
                                        showFeedback('success', `Deleted "${product.name}".`);
                                      },
                                    })
                                  }
                                  aria-label={`Delete ${product.name}`}
                                  title="Delete permanently"
                                  className="p-2 text-slate-400 hover:text-rose-700 disabled:opacity-50 rounded hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CATEGORIES & BRANDS TAB */}
          {activeTab === 'taxonomy' && (
            <div className="space-y-4">
              {taxonomyError && (
                <div
                  role="alert"
                  className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs font-medium text-rose-800"
                >
                  {taxonomyError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Categories & Subcategories */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Categories &amp; Subcategories
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create top-level categories or assign a parent category to create nested subcategories.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={migratingMode !== null}
                    onClick={() => void handleRunMigration('restoreCombined')}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[38px] text-xs font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 disabled:opacity-60 rounded-lg shrink-0"
                  >
                    {migratingMode === 'restoreCombined' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Restore Missing Categories</span>
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (savingCategory) return;
                    setTaxonomyError(null);
                    const trimmedName = newCatName.trim();
                    if (!trimmedName) return;
                    const resolvedSlug = (
                      newCatSlug.trim() ||
                      trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    ).slice(0, 128);
                    if (!resolvedSlug) {
                      setTaxonomyError('Enter a valid category URL slug.');
                      return;
                    }
                    const duplicateName = state.categories.some(
                      (c) =>
                        c.id !== editingCategoryId &&
                        (c.parentId || '') === newCatParentId &&
                        c.name.trim().toLowerCase() === trimmedName.toLowerCase()
                    );
                    if (duplicateName) {
                      setTaxonomyError(`"${trimmedName}" already exists under this parent level.`);
                      return;
                    }
                    const duplicateSlug = state.categories.some(
                      (c) =>
                        c.id !== editingCategoryId &&
                        c.slug.trim().toLowerCase() === resolvedSlug.toLowerCase()
                    );
                    if (duplicateSlug) {
                      setTaxonomyError(`URL slug "${resolvedSlug}" is already assigned to another category.`);
                      return;
                    }
                    if (
                      editingCategoryId &&
                      newCatParentId &&
                      wouldCreateCategoryCycle(editingCategoryId, newCatParentId, state.categories)
                    ) {
                      setTaxonomyError('Cannot assign a category as its own parent or descendant.');
                      return;
                    }
                    const existing = editingCategoryId
                      ? state.categories.find((c) => c.id === editingCategoryId)
                      : undefined;
                    const parsedOrder = Number(newCatOrder);
                    const displayOrder =
                      newCatOrder.trim() !== '' && Number.isFinite(parsedOrder)
                        ? Math.max(0, Math.min(10000, Math.floor(parsedOrder)))
                        : existing?.displayOrder ?? state.categories.length + 1;

                    setSavingCategory(true);
                    try {
                      await onUpsertCategory({
                        id: existing?.id || `cat-${Date.now()}`,
                        slug: resolvedSlug,
                        name: trimmedName,
                        description: newCatDesc.trim() || 'RC & Hobby hardware category',
                        image:
                          newCatImage.trim() ||
                          existing?.image ||
                          '/src/assets/images/prod_rc_crawler_1795456014287.jpg',
                        featured: newCatFeatured,
                        displayOrder,
                        ...(newCatParentId ? { parentId: newCatParentId } : {}),
                      });
                      showFeedback(
                        'success',
                        editingCategoryId
                          ? `Updated "${trimmedName}".`
                          : `Added ${newCatParentId ? 'subcategory' : 'category'} "${trimmedName}".`
                      );
                      setEditingCategoryId(null);
                      setNewCatName('');
                      setNewCatSlug('');
                      setCatSlugTouched(false);
                      setNewCatParentId('');
                      setNewCatDesc('');
                      setNewCatOrder('');
                      setNewCatImage('');
                      setNewCatFeatured(true);
                    } catch (err) {
                      setTaxonomyError(formatFirestoreUserMessage(err));
                    } finally {
                      setSavingCategory(false);
                    }
                  }}
                  className="space-y-2.5 pb-4 border-b border-slate-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewCatName(val);
                        if (!editingCategoryId && !catSlugTouched) {
                          setNewCatSlug(
                            val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          );
                        }
                      }}
                      placeholder={newCatParentId ? 'Subcategory name' : 'Category name'}
                      className="sm:col-span-2 px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={newCatOrder}
                      onChange={(e) => setNewCatOrder(e.target.value)}
                      placeholder="Order (e.g. 1)"
                      aria-label="Category display order"
                      className="px-3 min-h-[44px] text-base md:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={newCatParentId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewCatParentId(val);
                        if (!editingCategoryId) {
                          setNewCatFeatured(!val);
                        }
                      }}
                      aria-label="Parent category"
                      className="px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="">Top-Level Category (No Parent)</option>
                      {state.categories
                        .filter(
                          (c) =>
                            c.id !== editingCategoryId &&
                            (!editingCategoryId ||
                              !wouldCreateCategoryCycle(editingCategoryId, c.id, state.categories))
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            Parent: {c.parentId ? '↳ ' : ''}
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={newCatSlug}
                      onChange={(e) => {
                        setCatSlugTouched(true);
                        setNewCatSlug(e.target.value);
                      }}
                      placeholder="URL slug (e.g. rc-trucks)"
                      aria-label="Category URL slug"
                      className="px-3 min-h-[44px] text-base md:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-md bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      <ResilientImage
                        src={
                          newCatImage.trim() ||
                          '/src/assets/images/prod_rc_crawler_1795456014287.jpg'
                        }
                        alt="Category preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      value={newCatImage}
                      onChange={(e) => setNewCatImage(e.target.value)}
                      placeholder="Category image URL (https://... or /assets/...)"
                      aria-label="Category image URL"
                      className="flex-1 min-w-0 px-3 min-h-[44px] text-base md:text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Short category description"
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />

                  <label className="inline-flex items-center gap-2 min-h-[36px] text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCatFeatured}
                      onChange={(e) => setNewCatFeatured(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Featured on Homepage Category Section</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="px-4 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg"
                    >
                      {savingCategory
                        ? 'Saving...'
                        : editingCategoryId
                          ? 'Update Category'
                          : newCatParentId
                            ? 'Add Subcategory'
                            : 'Add Category'}
                    </button>
                    {(editingCategoryId || newCatParentId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setNewCatName('');
                          setNewCatSlug('');
                          setCatSlugTouched(false);
                          setNewCatParentId('');
                          setNewCatDesc('');
                          setNewCatOrder('');
                          setNewCatImage('');
                          setNewCatFeatured(true);
                        }}
                        className="px-3 min-h-[44px] text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {state.categories.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No categories in Cloud Firestore yet. Click &ldquo;Restore Missing Categories&rdquo; above or create a category.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {getTopLevelCategories(state.categories).map((cat) => {
                      const renderCategoryRow = (node: Category, depth: number) => {
                        const childNodes = getChildCategories(node.id, state.categories);
                        const directCount = state.products.filter(
                          (p) => p.categoryId === node.id || p.subcategoryId === node.id
                        ).length;
                        const totalCount = state.products.filter((p) =>
                          productMatchesCategoryFilter(p, node.id, state.categories)
                        ).length;

                        return (
                          <li key={node.id} className={depth === 0 ? 'py-2.5' : 'py-2 border-t border-slate-100'}>
                            <div
                              className={`flex items-center justify-between gap-2 ${
                                depth > 0 ? 'pl-5 sm:pl-7 border-l-2 border-orange-200 ml-2' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                  <ResilientImage
                                    src={node.image}
                                    alt={node.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {depth > 0 && (
                                      <span className="text-orange-600 font-normal mr-1">↳</span>
                                    )}
                                    <span className="text-xs font-mono text-slate-400 mr-1.5">
                                      #{node.displayOrder ?? 100}
                                    </span>
                                    {node.name}{' '}
                                    <span className="text-xs font-normal text-slate-500 tabular-nums">
                                      ({totalCount})
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    <span className="font-mono">/category/{node.slug}</span>
                                    {childNodes.length > 0 && (
                                      <span> · {childNodes.length} sub</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTaxonomyError(null);
                                    setEditingCategoryId(null);
                                    setNewCatParentId(node.id);
                                    setNewCatName('');
                                    setNewCatSlug('');
                                    setCatSlugTouched(false);
                                    setNewCatDesc('');
                                    setNewCatOrder(String(childNodes.length + 1));
                                    setNewCatImage(node.image || '');
                                    setNewCatFeatured(false);
                                  }}
                                  title={`Add subcategory under ${node.name}`}
                                  aria-label={`Add subcategory under ${node.name}`}
                                  className="inline-flex items-center gap-1 px-2 min-h-[38px] text-[11px] font-semibold text-orange-700 hover:bg-orange-50 rounded-lg"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Sub</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTaxonomyError(null);
                                    setEditingCategoryId(node.id);
                                    setNewCatName(node.name);
                                    setNewCatSlug(node.slug);
                                    setCatSlugTouched(true);
                                    setNewCatParentId(node.parentId || '');
                                    setNewCatDesc(node.description);
                                    setNewCatOrder(
                                      typeof node.displayOrder === 'number'
                                        ? String(node.displayOrder)
                                        : ''
                                    );
                                    setNewCatImage(node.image || '');
                                    setNewCatFeatured(Boolean(node.featured));
                                  }}
                                  aria-label={`Edit ${node.name}`}
                                  className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (childNodes.length > 0) {
                                      setTaxonomyError(
                                        `Cannot delete "${node.name}" while it has ${childNodes.length} subcategory(ies). Delete or reassign those subcategories first.`
                                      );
                                      return;
                                    }
                                    if (directCount > 0) {
                                      setTaxonomyError(
                                        `Cannot delete "${node.name}" while ${directCount} product(s) still reference it. Reassign those products to another category first.`
                                      );
                                      return;
                                    }
                                    setConfirmAction({
                                      title: 'Delete Category?',
                                      message: `Delete "${node.name}" from Cloud Firestore?`,
                                      confirmLabel: 'Delete Category',
                                      onConfirm: async () => {
                                        await onDeleteCategory(node.id);
                                        setConfirmAction(null);
                                        showFeedback('success', `Deleted category "${node.name}".`);
                                      },
                                    });
                                  }}
                                  aria-label={`Delete ${node.name}`}
                                  className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {childNodes.length > 0 && (
                              <ul className="mt-1.5">
                                {childNodes.map((child) => renderCategoryRow(child, depth + 1))}
                              </ul>
                            )}
                          </li>
                        );
                      };

                      return renderCategoryRow(cat, 0);
                    })}
                  </ul>
                )}
              </div>

              {/* Brands */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900">Brands</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (savingBrand) return;
                    setTaxonomyError(null);
                    const trimmedBrand = newBrandName.trim();
                    if (!trimmedBrand) return;
                    const duplicate = state.brands.some(
                      (b) =>
                        b.id !== editingBrandId &&
                        b.name.trim().toLowerCase() === trimmedBrand.toLowerCase()
                    );
                    if (duplicate) {
                      setTaxonomyError(`Brand "${trimmedBrand}" already exists.`);
                      return;
                    }
                    const existing = editingBrandId
                      ? state.brands.find((b) => b.id === editingBrandId)
                      : undefined;
                    setSavingBrand(true);
                    try {
                      await onUpsertBrand({
                        id: existing?.id || `brand-${Date.now()}`,
                        slug:
                          existing?.slug ||
                          trimmedBrand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                        name: trimmedBrand,
                        country: newBrandCountry.trim() || 'Global',
                        specialty: newBrandSpecialty.trim() || 'RC Hardware',
                      });
                      showFeedback(
                        'success',
                        editingBrandId ? `Updated brand "${trimmedBrand}".` : `Added brand "${trimmedBrand}".`
                      );
                      setEditingBrandId(null);
                      setNewBrandName('');
                      setNewBrandCountry('');
                      setNewBrandSpecialty('');
                    } catch (err) {
                      setTaxonomyError(formatFirestoreUserMessage(err));
                    } finally {
                      setSavingBrand(false);
                    }
                  }}
                  className="space-y-2.5 pb-4 border-b border-slate-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder="Brand name"
                      className="px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newBrandCountry}
                      onChange={(e) => setNewBrandCountry(e.target.value)}
                      placeholder="Origin (e.g. USA)"
                      className="px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <input
                    type="text"
                    value={newBrandSpecialty}
                    onChange={(e) => setNewBrandSpecialty(e.target.value)}
                    placeholder="Specialty (e.g. FPV Motors & Frames)"
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingBrand}
                      className="px-4 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg"
                    >
                      {savingBrand
                        ? 'Saving...'
                        : editingBrandId
                          ? 'Update Brand'
                          : 'Add Brand'}
                    </button>
                    {editingBrandId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBrandId(null);
                          setNewBrandName('');
                          setNewBrandCountry('');
                          setNewBrandSpecialty('');
                        }}
                        className="px-3 min-h-[44px] text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <ul className="divide-y divide-slate-200">
                  {state.brands.map((brand) => {
                    const count = state.products.filter((p) => p.brandId === brand.id).length;
                    return (
                      <li key={brand.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {brand.name}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              · {brand.country} ({count})
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">{brand.specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBrandId(brand.id);
                              setNewBrandName(brand.name);
                              setNewBrandCountry(brand.country);
                              setNewBrandSpecialty(brand.specialty);
                            }}
                            aria-label={`Edit ${brand.name}`}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (count > 0) {
                                setTaxonomyError(
                                  `Cannot delete "${brand.name}" while ${count} product(s) still reference it. Reassign those products to another brand first.`
                                );
                                return;
                              }
                              setConfirmAction({
                                title: 'Delete Brand?',
                                message: `Delete brand "${brand.name}" from Cloud Firestore?`,
                                confirmLabel: 'Delete Brand',
                                onConfirm: async () => {
                                  await onDeleteBrand(brand.id);
                                  setConfirmAction(null);
                                  showFeedback('success', `Deleted brand "${brand.name}".`);
                                },
                              });
                            }}
                            aria-label={`Delete ${brand.name}`}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              </div>
            </div>
          )}

          {/* WHATSAPP CONFIGURATION & ANALYTICS TAB */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4 sm:space-y-6">
              <form
                onSubmit={handleSaveWhatsApp}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                      WhatsApp Inquiry Configuration
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Centralized WhatsApp Business phone number, prefilled inquiry template, and
                      button labels.
                    </p>
                  </div>
                  {waReady ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Active: {formatWhatsAppDisplayNumber(effectiveWaNumber)}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-800">
                      Unconfigured — Links Paused
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Business WhatsApp Number (International digits only, e.g. 923001234567)
                    </label>
                    <input
                      type="text"
                      value={waDraft.businessNumber}
                      onChange={(e) =>
                        setWaDraft({ ...waDraft, businessNumber: e.target.value })
                      }
                      placeholder={
                        envNumber
                          ? `Using env VITE_WHATSAPP_BUSINESS_NUMBER (+${envNumber})`
                          : 'Leave blank if unconfigured, or enter country code + digits'
                      }
                      className="w-full px-3 min-h-[44px] text-base md:text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Uses official <code className="font-mono">https://wa.me/&lt;number&gt;?text=...</code>{' '}
                      format. When empty and no env var is set, storefront buttons display a clear
                      configuration notice instead of generating an invalid link.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Page Button Label
                    </label>
                    <input
                      type="text"
                      value={waDraft.primaryButtonLabel}
                      onChange={(e) =>
                        setWaDraft({ ...waDraft, primaryButtonLabel: e.target.value })
                      }
                      className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Card Button Label
                    </label>
                    <input
                      type="text"
                      value={waDraft.cardButtonLabel}
                      onChange={(e) =>
                        setWaDraft({ ...waDraft, cardButtonLabel: e.target.value })
                      }
                      className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6">
                  <label className="inline-flex items-center gap-2.5 min-h-[44px] text-sm text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waDraft.showCardInquiryButton}
                      onChange={(e) =>
                        setWaDraft({ ...waDraft, showCardInquiryButton: e.target.checked })
                      }
                      className="w-5 h-5 sm:w-4 sm:h-4 rounded border-slate-300 text-orange-600"
                    />
                    <span>Show WhatsApp inquiry button on product cards</span>
                  </label>
                  <label className="inline-flex items-center gap-2.5 min-h-[44px] text-sm text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waDraft.trackLocalClicks}
                      onChange={(e) =>
                        setWaDraft({ ...waDraft, trackLocalClicks: e.target.checked })
                      }
                      className="w-5 h-5 sm:w-4 sm:h-4 rounded border-slate-300 text-orange-600"
                    />
                    <span>Record local WhatsApp click events (browser log)</span>
                  </label>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Default Inquiry Message Template
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setWaDraft({ ...waDraft, defaultMessageTemplate: DEFAULT_WHATSAPP_TEMPLATE })
                      }
                      className="min-h-[36px] text-xs font-medium text-orange-700 hover:underline"
                    >
                      Restore Default Template
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    value={waDraft.defaultMessageTemplate}
                    onChange={(e) =>
                      setWaDraft({ ...waDraft, defaultMessageTemplate: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-base md:text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Available tokens: <code className="font-mono">{'{productName}'}</code>,{' '}
                    <code className="font-mono">{'{sku}'}</code>,{' '}
                    <code className="font-mono">{'{price}'}</code>,{' '}
                    <code className="font-mono">{'{url}'}</code>
                  </p>
                </div>

                {waPreviewText && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-1">
                      Live Message Preview (Sample Product)
                    </p>
                    <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-lg whitespace-pre-wrap break-words overflow-x-auto max-w-full">
                      {waPreviewText}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div>
                    {waError && (
                      <span role="alert" className="text-xs font-semibold text-rose-700">
                        {waError}
                      </span>
                    )}
                    {waSavedBanner && (
                      <span className="text-xs font-semibold text-emerald-700">
                        WhatsApp settings saved to Cloud Firestore.
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={savingWa}
                    className="w-full sm:w-auto px-5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg"
                  >
                    {savingWa ? 'Saving...' : 'Save WhatsApp Settings'}
                  </button>
                </div>
              </form>

              {/* WhatsApp Contact Analytics Readiness Panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      WhatsApp Contact Analytics
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Local browser click telemetry. Connect a future Firebase or analytics backend
                      to aggregate cross-visitor inquiry conversions.
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {state.inquiryAnalytics.length} recorded clicks
                  </span>
                </div>

                {state.inquiryAnalytics.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 border-t border-slate-100">
                    No WhatsApp inquiry clicks recorded in this browser yet.
                  </p>
                ) : (
                  <>
                    {/* Mobile Analytics Cards */}
                    <div className="sm:hidden divide-y divide-slate-100 border-t border-slate-200">
                      {state.inquiryAnalytics.slice(0, 12).map((ev) => (
                        <div key={ev.id} className="py-3 space-y-1 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900 line-clamp-1">
                              {ev.productName}
                            </p>
                            <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                              {formatPKR(ev.price)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-500 font-mono">
                            <span>
                              {ev.sku} · <span className="uppercase font-sans">{ev.source}</span>
                            </span>
                            <span className="tabular-nums">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tablet & Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto border-t border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3">Product</th>
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3 text-right">Price</th>
                            <th className="py-2 px-3">Source</th>
                            <th className="py-2 pl-3 text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {state.inquiryAnalytics.slice(0, 12).map((ev) => (
                            <tr key={ev.id}>
                              <td className="py-2 pr-3 font-medium text-slate-900 truncate max-w-[200px]">
                                {ev.productName}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600">{ev.sku}</td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                {formatPKR(ev.price)}
                              </td>
                              <td className="py-2 px-3 uppercase text-slate-500">{ev.source}</td>
                              <td className="py-2 pl-3 text-right font-mono text-slate-500 tabular-nums">
                                {new Date(ev.timestamp).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STORE & SEO SETTINGS TAB */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5"
            >
              <div className="border-b border-slate-200 pb-4">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                  Store Identity, Footer Contact &amp; SEO
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Email contact is displayed in the footer only when configured here or via{' '}
                  <code className="font-mono">VITE_CONTACT_EMAIL</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.storeName}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, storeName: e.target.value })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Email (Optional — shown only when set)
                  </label>
                  <input
                    type="email"
                    value={settingsDraft.contactEmail}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, contactEmail: e.target.value })
                    }
                    placeholder="Leave empty to hide email in footer"
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.tagline}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, tagline: e.target.value })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch / City Base
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.cityBase}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, cityBase: e.target.value })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SEO Page Title
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.seoTitle}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, seoTitle: e.target.value })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SEO Meta Description
                  </label>
                  <textarea
                    rows={2}
                    value={settingsDraft.seoDescription}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, seoDescription: e.target.value })
                    }
                    className="w-full px-3 py-2 text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instagram URL
                  </label>
                  <input
                    type="url"
                    value={settingsDraft.socialLinks.instagram}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        socialLinks: { ...settingsDraft.socialLinks, instagram: e.target.value },
                      })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    YouTube URL
                  </label>
                  <input
                    type="url"
                    value={settingsDraft.socialLinks.youtube}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        socialLinks: { ...settingsDraft.socialLinks, youtube: e.target.value },
                      })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    value={settingsDraft.socialLinks.facebook}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        socialLinks: { ...settingsDraft.socialLinks, facebook: e.target.value },
                      })
                    }
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  {settingsError && (
                    <span role="alert" className="text-xs font-semibold text-rose-700">
                      {settingsError}
                    </span>
                  )}
                  {settingsSavedBanner && (
                    <span className="text-xs font-semibold text-emerald-700">
                      Store &amp; SEO settings saved to Cloud Firestore.
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto px-5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {isProductModalOpen && (
        <ProductEditorModal
          initialProduct={editingProduct}
          categories={state.categories}
          brands={state.brands}
          whatsappConfig={state.whatsappConfig}
          existingSkus={state.products.map((p) => p.sku)}
          existingSlugs={state.products.map((p) => p.slug)}
          onSave={async (prod) => {
            await onUpsertProduct(prod);
            setIsProductModalOpen(false);
            setEditingProduct(null);
            const actionLabel = prod.archived
              ? 'archived'
              : prod.published
                ? 'published to the live storefront'
                : 'saved as a Draft';
            showFeedback('success', `"${prod.name}" ${actionLabel}.`);
          }}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

      {previewingProduct && (
        <ProductPreviewModal
          product={previewingProduct}
          brand={state.brands.find((b) => b.id === previewingProduct.brandId)}
          category={state.categories.find(
            (c) => c.id === (previewingProduct.subcategoryId || previewingProduct.categoryId)
          )}
          whatsappConfig={state.whatsappConfig}
          onClose={() => setPreviewingProduct(null)}
          onPublish={async () => {
            const err = getQuickPublishError(previewingProduct);
            if (err) {
              showFeedback('error', err);
              return;
            }
            await handleQuickProductUpdate(
              { ...previewingProduct, published: true, archived: false },
              `"${previewingProduct.name}" published live to the storefront.`
            );
            setPreviewingProduct(null);
          }}
          publishDisabledReason={getQuickPublishError(previewingProduct) || undefined}
        />
      )}

      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={confirmAction.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {confirmAction.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{confirmAction.message}</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmAction(null)}
                className="px-4 min-h-[44px] text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={async () => {
                  if (confirmBusy) return;
                  setConfirmBusy(true);
                  try {
                    await confirmAction.onConfirm();
                  } catch (err) {
                    setConfirmAction(null);
                    showFeedback('error', formatFirestoreUserMessage(err));
                  } finally {
                    setConfirmBusy(false);
                  }
                }}
                className="px-4 min-h-[44px] text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-lg"
              >
                {confirmBusy ? 'Deleting...' : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
