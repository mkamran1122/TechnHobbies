import { useEffect } from 'react';
import type { Brand, Category, Product, StoreSettings } from '../types/catalog';
import { getEffectiveStockStatus } from '../utils/stock';

import { isValidImageSource } from '../utils/url';

export const CANONICAL_ORIGIN = 'https://technhobbies.com';
const DEFAULT_SOCIAL_IMAGE = `${CANONICAL_ORIGIN}/src/assets/images/hero_rc_workshop_1795456013906.jpg`;

interface SEOOptions {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  product?: Product | null;
  brand?: Brand | null;
  category?: Category | null;
  storeSettings: StoreSettings;
}

function toAbsolutePublicImage(src: string): string | null {
  const trimmed = src.trim();
  if (!isValidImageSource(trimmed)) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${CANONICAL_ORIGIN}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function useSEO({
  title,
  description,
  canonicalPath,
  noIndex = false,
  product,
  brand,
  category,
  storeSettings,
}: SEOOptions) {
  useEffect(() => {
    document.title = title;

    const normalizedPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalUrl = `${CANONICAL_ORIGIN}${normalizedPath}`;

    const rawOrderedImages =
      product && product.published && !product.archived
        ? product.primaryImage
          ? [product.primaryImage, ...product.images.filter((img) => img !== product.primaryImage)]
          : product.images
        : [];
    const productImages = Array.from(
      new Set(
        rawOrderedImages
          .map(toAbsolutePublicImage)
          .filter((img): img is string => img !== null)
      )
    );
    const socialImage = productImages[0] || DEFAULT_SOCIAL_IMAGE;

    const setMeta = (selector: string, content: string, attrName = 'name', attrVal = '') => {
      let el = document.querySelector(selector);
      if (!el && attrVal) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      if (el) {
        el.setAttribute('content', content);
      }
    };

    setMeta('meta[name="description"]', description, 'name', 'description');
    setMeta('meta[property="og:title"]', title, 'property', 'og:title');
    setMeta('meta[property="og:description"]', description, 'property', 'og:description');
    setMeta('meta[property="og:url"]', canonicalUrl, 'property', 'og:url');
    setMeta('meta[property="og:image"]', socialImage, 'property', 'og:image');
    setMeta('meta[name="twitter:title"]', title, 'name', 'twitter:title');
    setMeta('meta[name="twitter:description"]', description, 'name', 'twitter:description');
    setMeta('meta[name="twitter:image"]', socialImage, 'name', 'twitter:image');
    setMeta(
      'meta[name="robots"]',
      noIndex ? 'noindex, nofollow' : 'index, follow',
      'name',
      'robots'
    );

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    const existingScript = document.getElementById('dynamic-seo-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    if (noIndex) {
      return;
    }

    const graphNodes: Record<string, unknown>[] = [];

    if (product && product.published && !product.archived) {
      const effectiveStock = getEffectiveStockStatus(product);
      const availabilityMap: Record<Product['stockStatus'], string> = {
        'In Stock': 'https://schema.org/InStock',
        'Limited Stock': 'https://schema.org/LimitedAvailability',
        'Pre-Order': 'https://schema.org/PreOrder',
        'Out of Stock': 'https://schema.org/OutOfStock',
      };

      graphNodes.push({
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        description: product.shortDescription,
        image: productImages.length > 0 ? productImages : [DEFAULT_SOCIAL_IMAGE],
        url: canonicalUrl,
        category: category?.name || 'RC & Hobby Hardware',
        brand: brand
          ? {
              '@type': 'Brand',
              name: brand.name,
            }
          : undefined,
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'PKR',
          price: String(product.price),
          availability: availabilityMap[effectiveStock],
          itemCondition:
            product.condition === 'Brand New'
              ? 'https://schema.org/NewCondition'
              : product.condition === 'Refurbished'
                ? 'https://schema.org/RefurbishedCondition'
                : 'https://schema.org/UsedCondition',
          seller: {
            '@type': 'Organization',
            name: storeSettings.storeName,
          },
        },
      });

      const breadcrumbItems: Record<string, unknown>[] = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${CANONICAL_ORIGIN}/shop` },
      ];
      if (category) {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position: 3,
          name: category.name,
          item: `${CANONICAL_ORIGIN}/category/${encodeURIComponent(category.slug)}`,
        });
      }
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: product.name,
        item: canonicalUrl,
      });

      graphNodes.push({
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      });
    } else if (normalizedPath !== '/') {
      const breadcrumbItems: Record<string, unknown>[] = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
      ];
      if (category && normalizedPath.startsWith('/category/')) {
        breadcrumbItems.push(
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${CANONICAL_ORIGIN}/shop` },
          { '@type': 'ListItem', position: 3, name: category.name, item: canonicalUrl }
        );
      } else {
        breadcrumbItems.push({
          '@type': 'ListItem',
          position: 2,
          name: title.split('|')[0].trim(),
          item: canonicalUrl,
        });
      }
      graphNodes.push({
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      });
    }

    if (graphNodes.length > 0) {
      const script = document.createElement('script');
      script.id = 'dynamic-seo-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': graphNodes,
      });
      document.head.appendChild(script);
    }
  }, [title, description, canonicalPath, noIndex, product, brand, category, storeSettings]);
}
