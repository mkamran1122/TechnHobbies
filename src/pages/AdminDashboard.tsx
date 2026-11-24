import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  Globe,
  LogOut,
  MailCheck,
  MessageCircle,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductEditorModal } from '../components/admin/ProductEditorModal';
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
import type {
  Brand,
  CatalogStoreState,
  Category,
  Product,
  StoreSettings,
  WhatsAppConfig,
} from '../types/catalog';
import { formatPKR } from '../utils/currency';
import { sanitizeExternalUrl } from '../utils/url';

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
  onUpsertProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpsertCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUpsertBrand: (brand: Brand) => void;
  onDeleteBrand: (brandId: string) => void;
  onUpdateWhatsAppConfig: (config: WhatsAppConfig) => void;
  onUpdateStoreSettings: (settings: StoreSettings) => void;
  onResetSampleData: () => void;
  adminEmail: string;
  emailVerified: boolean;
  onLogout: () => Promise<void> | void;
  onSendVerification: () => Promise<void>;
  onRefreshAuthUser: () => Promise<void>;
  storageWarning?: string | null;
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
  onResetSampleData,
  adminEmail,
  emailVerified,
  onLogout,
  onSendVerification,
  onRefreshAuthUser,
  storageWarning,
}: AdminDashboardProps) {
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Taxonomy local forms
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
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

  const envNumber = getEnvWhatsAppNumber();
  const effectiveWaNumber = resolveEffectiveWhatsAppNumber(state.whatsappConfig.businessNumber);
  const waReady = isWhatsAppConfigured(state.whatsappConfig);

  const activeProducts = state.products.filter((p) => !p.archived);
  const publishedCount = activeProducts.filter((p) => p.published).length;
  const featuredCount = activeProducts.filter((p) => p.featured).length;

  const filteredAdminProducts = state.products.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (showArchived && !p.archived) return false;
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  const handleSaveWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateWhatsAppConfig({
      ...waDraft,
      businessNumber: sanitizeWhatsAppDigits(waDraft.businessNumber),
    });
    setWaSavedBanner(true);
    window.setTimeout(() => setWaSavedBanner(false), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreSettings({
      ...settingsDraft,
      socialLinks: {
        instagram: sanitizeExternalUrl(settingsDraft.socialLinks.instagram),
        youtube: sanitizeExternalUrl(settingsDraft.socialLinks.youtube),
        facebook: sanitizeExternalUrl(settingsDraft.socialLinks.facebook),
      },
    });
    setSettingsSavedBanner(true);
    window.setTimeout(() => setSettingsSavedBanner(false), 3000);
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
                onClick={onResetSampleData}
                aria-label="Reset Sample Catalog"
                title="Reset Sample Catalog"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
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
              onClick={onResetSampleData}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Catalog</span>
            </button>

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
          {/* Firebase Auth & Server-Side Rules Status Notice */}
          {emailVerified ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-950">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Authenticated Admin Session ({adminEmail})
                </p>
                <p className="text-emerald-900 leading-relaxed">
                  Firebase Email/Password Authentication is active and Firestore Security Rules
                  (<code className="font-mono">firestore.rules</code>) enforce verified admin
                  authorization on server-side Firestore operations. Current sample catalog edits
                  persist locally in this browser&apos;s <code className="font-mono">localStorage</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-2 min-w-0 flex-1">
                <p className="font-semibold">
                  Email Verification Recommended for Server-Side Firestore Rules
                </p>
                <p className="text-amber-900 leading-relaxed">
                  Signed in as <span className="font-mono">{adminEmail}</span>. Deployed Firestore
                  Security Rules require <code className="font-mono">email_verified == true</code>{' '}
                  for server-side Firestore writes to prevent email spoofing. Current sample catalog
                  edits persist locally in <code className="font-mono">localStorage</code>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setVerificationError(null);
                      try {
                        await onSendVerification();
                        setVerificationSent(true);
                      } catch (err) {
                        setVerificationError(
                          err instanceof Error ? err.message : 'Unable to send verification email.'
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[44px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    <MailCheck className="w-3.5 h-3.5" />
                    <span>Send Verification Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRefreshAuthUser()}
                    className="px-3 min-h-[44px] text-xs font-medium text-slate-700 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg"
                  >
                    Refresh Verification Status
                  </button>
                  {verificationSent && (
                    <span className="text-xs font-medium text-emerald-800">
                      Verification email sent. Check your inbox.
                    </span>
                  )}
                  {verificationError && (
                    <span className="text-xs font-medium text-rose-700">{verificationError}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {storageWarning && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <p className="font-medium">{storageWarning}</p>
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
                      {publishedCount} published
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

              <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Filter by product name or SKU..."
                    className="w-full pl-9 pr-3 min-h-[44px] text-base md:text-sm bg-white border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowArchived(false)}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      !showArchived ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Active ({state.products.filter((p) => !p.archived).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchived(true)}
                    className={`px-3 min-h-[40px] text-xs font-semibold rounded-md ${
                      showArchived ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Archived ({state.products.filter((p) => p.archived).length})
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
                  filteredAdminProducts.map((product) => (
                    <div key={product.id} className="p-3.5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-12 rounded-md bg-slate-100 overflow-hidden shrink-0">
                          <ResilientImage
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {state.brands.find((b) => b.id === product.brandId)?.name || '—'} ·{' '}
                            {product.condition} · <span className="font-mono">{product.sku}</span>
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

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpsertProduct({ ...product, published: !product.published })
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 min-h-[44px] text-xs font-semibold rounded-lg border ${
                              product.published
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                : 'text-slate-600 bg-slate-50 border-slate-200'
                            }`}
                          >
                            {product.published ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                            <span>{product.published ? 'Live' : 'Draft'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpsertProduct({ ...product, featured: !product.featured })
                            }
                            aria-label="Toggle Featured"
                            className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border ${
                              product.featured
                                ? 'text-amber-600 bg-amber-50 border-amber-200'
                                : 'text-slate-400 bg-slate-50 border-slate-200'
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${product.featured ? 'fill-amber-500' : ''}`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
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
                            onClick={() =>
                              onUpsertProduct({ ...product, archived: !product.archived })
                            }
                            aria-label={product.archived ? 'Restore product' : 'Archive product'}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 bg-slate-100 hover:text-amber-700 rounded-lg"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(product.id)}
                            aria-label={`Delete ${product.name}`}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
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
                      filteredAdminProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-9 rounded bg-slate-100 overflow-hidden shrink-0">
                                <ResilientImage
                                  src={product.images[0]}
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
                                  {product.condition}
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
                              <button
                                type="button"
                                onClick={() =>
                                  onUpsertProduct({ ...product, published: !product.published })
                                }
                                title={product.published ? 'Unpublish' : 'Publish'}
                                className={`inline-flex items-center gap-1 min-h-[36px] font-medium ${
                                  product.published ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {product.published ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                                <span>{product.published ? 'Live' : 'Draft'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpsertProduct({ ...product, featured: !product.featured })
                                }
                                title="Toggle Featured"
                                className={`p-1.5 ${
                                  product.featured ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
                                }`}
                              >
                                <Star
                                  className={`w-4 h-4 ${product.featured ? 'fill-amber-500' : ''}`}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(product);
                                  setIsProductModalOpen(true);
                                }}
                                aria-label={`Edit ${product.name}`}
                                className="p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpsertProduct({ ...product, archived: !product.archived })
                                }
                                aria-label={product.archived ? 'Restore product' : 'Archive product'}
                                title={product.archived ? 'Restore from archive' : 'Archive product'}
                                className="p-2 text-slate-600 hover:text-amber-700 rounded hover:bg-slate-200/70"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(product.id)}
                                aria-label={`Delete ${product.name}`}
                                title="Delete permanently"
                                className="p-2 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CATEGORIES & BRANDS TAB */}
          {activeTab === 'taxonomy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Categories */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900">Categories</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCatName.trim()) return;
                    const existing = editingCategoryId
                      ? state.categories.find((c) => c.id === editingCategoryId)
                      : undefined;
                    onUpsertCategory({
                      id: existing?.id || `cat-${Date.now()}`,
                      slug:
                        existing?.slug ||
                        newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                      name: newCatName.trim(),
                      description: newCatDesc.trim() || 'RC & Hobby hardware category',
                      image:
                        existing?.image || '/src/assets/images/prod_rc_crawler_1795456014287.jpg',
                      featured: existing?.featured ?? true,
                    });
                    setEditingCategoryId(null);
                    setNewCatName('');
                    setNewCatDesc('');
                  }}
                  className="space-y-2.5 pb-4 border-b border-slate-200"
                >
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Short category description"
                    className="w-full px-3 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 min-h-[44px] text-xs font-semibold text-white bg-slate-900 rounded-lg"
                    >
                      {editingCategoryId ? 'Update Category' : 'Add Category'}
                    </button>
                    {editingCategoryId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setNewCatName('');
                          setNewCatDesc('');
                        }}
                        className="px-3 min-h-[44px] text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <ul className="divide-y divide-slate-200">
                  {state.categories.map((cat) => {
                    const count = state.products.filter((p) => p.categoryId === cat.id).length;
                    return (
                      <li key={cat.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {cat.name}{' '}
                            <span className="text-xs font-normal text-slate-400 tabular-nums">
                              ({count})
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">{cat.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setNewCatName(cat.name);
                              setNewCatDesc(cat.description);
                            }}
                            aria-label={`Edit ${cat.name}`}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCategory(cat.id)}
                            aria-label={`Delete ${cat.name}`}
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

              {/* Brands */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900">Brands</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newBrandName.trim()) return;
                    const existing = editingBrandId
                      ? state.brands.find((b) => b.id === editingBrandId)
                      : undefined;
                    onUpsertBrand({
                      id: existing?.id || `brand-${Date.now()}`,
                      slug:
                        existing?.slug ||
                        newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                      name: newBrandName.trim(),
                      country: newBrandCountry.trim() || 'Global',
                      specialty: newBrandSpecialty.trim() || 'RC Hardware',
                    });
                    setEditingBrandId(null);
                    setNewBrandName('');
                    setNewBrandCountry('');
                    setNewBrandSpecialty('');
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
                      className="px-4 min-h-[44px] text-xs font-semibold text-white bg-slate-900 rounded-lg"
                    >
                      {editingBrandId ? 'Update Brand' : 'Add Brand'}
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
                            onClick={() => onDeleteBrand(brand.id)}
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
                    {waSavedBanner && (
                      <span className="text-xs font-semibold text-emerald-700">
                        WhatsApp settings saved locally.
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    Save WhatsApp Settings
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
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  {settingsSavedBanner && (
                    <span className="text-xs font-semibold text-emerald-700">
                      Store &amp; SEO settings updated.
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Save Settings
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
          onSave={(prod) => {
            onUpsertProduct(prod);
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
