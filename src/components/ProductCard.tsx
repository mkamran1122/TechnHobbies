import type { Product, WhatsAppConfig } from '../types/catalog';
import { formatPKR } from '../utils/currency';
import { getEffectiveStockStatus } from '../utils/stock';
import { ResilientImage } from './ResilientImage';
import { WhatsAppInquiryButton } from './WhatsAppInquiryButton';

interface ProductCardProps {
  product: Product;
  whatsappConfig: WhatsAppConfig;
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

export function ProductCard({
  product,
  whatsappConfig,
  onSelectProduct,
  onTrackWhatsAppClick,
  onUnconfiguredWhatsApp,
}: ProductCardProps) {
  const effectiveStock = getEffectiveStockStatus(product);

  const stockColor =
    effectiveStock === 'In Stock'
      ? 'text-emerald-700'
      : effectiveStock === 'Out of Stock'
        ? 'text-rose-700'
        : 'text-amber-700';

  return (
    <article className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-w-0">
      <button
        type="button"
        onClick={() => onSelectProduct(product.slug)}
        className="relative block aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0 text-left focus-visible:outline-2 focus-visible:outline-orange-600"
      >
        <div className="absolute inset-0">
          <ResilientImage
            src={product.images[0]}
            alt={product.name}
            fallbackLabel={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      </button>

      <div className="p-2 sm:p-3.5 flex-1 flex flex-col justify-between gap-2 min-w-0">
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <button
            type="button"
            onClick={() => onSelectProduct(product.slug)}
            className="text-left block w-full focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
          >
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
              {product.name}
            </h3>
          </button>

          <p className="text-[13px] sm:text-base font-bold text-slate-900 font-mono tabular-nums truncate">
            {formatPKR(product.price)}
          </p>

          <p className={`text-[11px] sm:text-xs font-medium leading-tight ${stockColor}`}>
            {effectiveStock}
          </p>
        </div>

        {whatsappConfig.showCardInquiryButton && (
          <WhatsAppInquiryButton
            config={whatsappConfig}
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              price: product.price,
              slug: product.slug,
            }}
            label="WhatsApp"
            source="card"
            variant="compact"
            className="w-full"
            onTrackClick={onTrackWhatsAppClick}
            onUnconfiguredClick={onUnconfiguredWhatsApp}
          />
        )}
      </div>
    </article>
  );
}
