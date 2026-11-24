import type { Category } from '../types/catalog';

export type AppRoute =
  | 'home'
  | 'shop'
  | 'categories'
  | 'product'
  | 'about'
  | 'privacy'
  | 'terms'
  | 'admin';

export interface ParsedRoute {
  route: AppRoute;
  productSlug: string | null;
  categorySlug: string | null;
  searchQuery: string;
}

export function parseLocation(pathname: string, search: string): ParsedRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);

  const legacyProduct = params.get('product');
  if (legacyProduct) {
    return {
      route: 'product',
      productSlug: legacyProduct,
      categorySlug: null,
      searchQuery: '',
    };
  }

  if (cleanPath === '/' || cleanPath === '') {
    return { route: 'home', productSlug: null, categorySlug: null, searchQuery: '' };
  }
  if (cleanPath === '/shop') {
    return {
      route: 'shop',
      productSlug: null,
      categorySlug: params.get('category'),
      searchQuery: params.get('q') || '',
    };
  }
  if (cleanPath === '/categories') {
    return { route: 'categories', productSlug: null, categorySlug: null, searchQuery: '' };
  }
  if (cleanPath.startsWith('/category/')) {
    const slug = decodeURIComponent(cleanPath.slice('/category/'.length));
    return {
      route: 'shop',
      productSlug: null,
      categorySlug: slug || null,
      searchQuery: params.get('q') || '',
    };
  }
  if (cleanPath.startsWith('/product/')) {
    const slug = decodeURIComponent(cleanPath.slice('/product/'.length));
    return {
      route: 'product',
      productSlug: slug || null,
      categorySlug: null,
      searchQuery: '',
    };
  }
  if (cleanPath === '/about') {
    return { route: 'about', productSlug: null, categorySlug: null, searchQuery: '' };
  }
  if (cleanPath === '/privacy') {
    return { route: 'privacy', productSlug: null, categorySlug: null, searchQuery: '' };
  }
  if (cleanPath === '/terms') {
    return { route: 'terms', productSlug: null, categorySlug: null, searchQuery: '' };
  }
  if (cleanPath === '/admin') {
    return { route: 'admin', productSlug: null, categorySlug: null, searchQuery: '' };
  }

  return { route: 'home', productSlug: null, categorySlug: null, searchQuery: '' };
}

export function buildPathForRoute(
  route: AppRoute,
  options?: {
    productSlug?: string | null;
    categoryId?: string;
    query?: string;
    categories?: Category[];
  }
): string {
  if (route === 'product' && options?.productSlug) {
    return `/product/${encodeURIComponent(options.productSlug)}`;
  }
  if (route === 'shop') {
    const cat =
      options?.categoryId && options.categoryId !== 'all'
        ? options.categories?.find((c) => c.id === options.categoryId)
        : undefined;
    const base = cat ? `/category/${encodeURIComponent(cat.slug)}` : '/shop';
    const q = options?.query?.trim();
    return q ? `${base}?q=${encodeURIComponent(q)}` : base;
  }
  if (route === 'home') return '/';
  return `/${route}`;
}
