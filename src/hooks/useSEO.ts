import { useEffect } from 'react';
import type { Brand, Category, Product, StoreSettings } from '../types/catalog';
import { getEffectiveStockStatus } from '../utils/stock';

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

    const canonicalUrl = `${window.location.origin}${canonicalPath}`;

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
    setMeta('meta[name="twitter:title"]', title, 'name', 'twitter:title');
    setMeta('meta[name="twitter:description"]', description, 'name', 'twitter:description');
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

    if (product && product.published && !product.archived) {
      const effectiveStock = getEffectiveStockStatus(product);
      const availabilityMap: Record<Product['stockStatus'], string> = {
        'In Stock': 'https://schema.org/InStock',
        'Limited Stock': 'https://schema.org/LimitedAvailability',
        'Pre-Order': 'https://schema.org/PreOrder',
        'Out of Stock': 'https://schema.org/OutOfStock',
      };

      const productImages = product.images
        .filter(Boolean)
        .map((img) => (img.startsWith('http') ? img : `${window.location.origin}${img}`));

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        description: product.shortDescription,
        image: productImages.length > 0 ? productImages : undefined,
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
      };

      const script = document.createElement('script');
      script.id = 'dynamic-seo-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [title, description, canonicalPath, noIndex, product, brand, category, storeSettings]);
}
