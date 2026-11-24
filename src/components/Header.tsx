import { Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppRoute } from '../utils/routing';

interface HeaderProps {
  activeRoute: AppRoute;
  searchQuery: string;
  onNavigate: (route: AppRoute) => void;
  onSearchSubmit: (query: string) => void;
}

const NAV_ITEMS: { id: AppRoute; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'categories', label: 'Categories' },
  { id: 'about', label: 'About' },
];

export function Header({
  activeRoute,
  searchQuery,
  onNavigate,
  onSearchSubmit,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState(searchQuery);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!mobileMenuOpen && !mobileSearchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, mobileSearchOpen]);

  const handleNav = (route: AppRoute) => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    onNavigate(route);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    onSearchSubmit(draftSearch.trim());
  };

  return (
    <>
      {/* 1. Compact Sticky Mobile-First Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <header className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Brand Logo & Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="flex items-center gap-2 min-w-0 shrink-0 text-left min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 rounded"
          >
            <img
              src="/assets/aistudio/TNH_Logo_PNG_99ea69a1.png"
              alt="TechnHobbies Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
            />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              TechnHobbies
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive =
                activeRoute === item.id || (item.id === 'shop' && activeRoute === 'product');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-sm font-medium whitespace-nowrap py-1 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 ${
                    isActive
                      ? 'text-slate-900 border-orange-600'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Desktop Search + Admin */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <form onSubmit={submitSearch} className="relative w-52 lg:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search RC gear..."
                aria-label="Search products"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </form>

            <button
              type="button"
              onClick={() => handleNav(activeRoute === 'admin' ? 'home' : 'admin')}
              className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
            >
              {activeRoute === 'admin' ? 'Storefront' : 'Admin'}
            </button>
          </div>

          {/* Mobile Controls: Search Icon + Hamburger Menu (44x44px hitboxes) */}
          <div className="flex md:hidden items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              aria-expanded={mobileSearchOpen}
              aria-label={mobileSearchOpen ? 'Close product search' : 'Open product search'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-orange-600 ${
                mobileSearchOpen
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {mobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev);
                setMobileSearchOpen(false);
              }}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-orange-600 ${
                mobileMenuOpen
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Expandable Search Bar */}
        {mobileSearchOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50 px-3 py-2.5">
            <form onSubmit={submitSearch} className="flex gap-2">
              <input
                type="search"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search RC cars, drones, SKU..."
                aria-label="Search RC catalog"
                autoFocus
                className="flex-1 min-w-0 px-3 min-h-[44px] text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="px-4 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                Search
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile Slide-Down Navigation Overlay Drawer (closes on link click or backdrop tap) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[1px]"
          />
          <nav
            aria-label="Mobile Navigation"
            className="relative z-10 bg-white border-b border-slate-200 shadow-lg w-full max-h-[85dvh] overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/aistudio/TNH_Logo_PNG_99ea69a1.png"
                  alt="TechnHobbies Logo"
                  className="w-7 h-7 object-contain shrink-0"
                />
                <span className="font-display text-base font-bold text-slate-900">
                  TechnHobbies Menu
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  activeRoute === item.id || (item.id === 'shop' && activeRoute === 'product');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center justify-between px-3.5 min-h-[44px] rounded-lg text-[15px] font-medium text-left focus-visible:outline-2 focus-visible:outline-orange-600 ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 font-semibold'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-slate-200 text-sm">
              <button
                type="button"
                onClick={() => handleNav('terms')}
                className="px-3 min-h-[44px] text-left font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg"
              >
                Return Policy
              </button>
              <button
                type="button"
                onClick={() => handleNav('privacy')}
                className="px-3 min-h-[44px] text-left font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg"
              >
                Privacy Policy
              </button>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleNav(activeRoute === 'admin' ? 'home' : 'admin')}
                className="w-full px-4 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                {activeRoute === 'admin' ? 'Back to Storefront' : 'Admin Dashboard'}
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
