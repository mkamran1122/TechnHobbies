import { Menu, Search, X } from 'lucide-react';
import { useState } from 'react';
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

  const handleNav = (route: AppRoute) => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    onNavigate(route);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onSearchSubmit(draftSearch.trim());
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* 1. Simple Announcement Bar */}
      <div className="bg-slate-900 text-slate-100 text-[11px] sm:text-xs text-center px-3 py-1.5 leading-snug">
        Direct WhatsApp Inquiries · 7-Day Return Policy (Terms Apply)
      </div>

      {/* 2. Compact Mobile-First Header */}
      <header className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6">
        {/* Brand Logo & Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2 min-w-0 shrink-0 text-left focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
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
                className={`text-sm font-medium whitespace-nowrap py-1 border-b-2 ${
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
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
          >
            {activeRoute === 'admin' ? 'Storefront' : 'Admin'}
          </button>
        </div>

        {/* Mobile Controls: Search Icon + Hamburger Menu */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen((prev) => !prev);
              setMobileMenuOpen(false);
            }}
            aria-label="Toggle product search"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 rounded-lg"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setMobileSearchOpen(false);
            }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 rounded-lg"
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
              className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shrink-0"
            >
              Go
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          className="md:hidden border-t border-slate-200 bg-white px-3 py-3 space-y-1"
          aria-label="Mobile Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`block w-full text-left px-3 py-3 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleNav(activeRoute === 'admin' ? 'home' : 'admin')}
              className="w-full px-3 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg"
            >
              {activeRoute === 'admin' ? 'Back to Storefront' : 'Admin Dashboard'}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
