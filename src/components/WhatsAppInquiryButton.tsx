import { MessageCircle } from 'lucide-react';
import {
  buildGeneralInquiryMessage,
  buildProductInquiryMessage,
  buildWhatsAppClickToChatUrl,
  resolveEffectiveWhatsAppNumber,
} from '../config/whatsapp';
import type { WhatsAppConfig } from '../types/catalog';

interface WhatsAppInquiryButtonProps {
  config: WhatsAppConfig;
  product?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    slug: string;
    variantLabel?: string;
  };
  generalTopic?: string;
  label?: string;
  source: 'pdp' | 'card' | 'general';
  variant?: 'primary' | 'secondary' | 'compact';
  className?: string;
  onTrackClick?: (payload: {
    productId: string;
    productName: string;
    sku: string;
    price: number;
    source: 'pdp' | 'card' | 'general';
  }) => void;
  onUnconfiguredClick: (previewMessage: string) => void;
}

export function WhatsAppInquiryButton({
  config,
  product,
  generalTopic,
  label,
  source,
  variant = 'primary',
  className = '',
  onTrackClick,
  onUnconfiguredClick,
}: WhatsAppInquiryButtonProps) {
  const effectiveNumber = resolveEffectiveWhatsAppNumber(config.businessNumber);

  const productUrl = product
    ? `${window.location.origin}/product/${encodeURIComponent(product.slug)}`
    : window.location.origin;

  const message = product
    ? buildProductInquiryMessage(
        {
          productName: product.name,
          sku: product.sku,
          price: product.price,
          productUrl,
          variantLabel: product.variantLabel,
        },
        config.defaultMessageTemplate
      )
    : buildGeneralInquiryMessage(generalTopic);

  const clickToChatUrl = buildWhatsAppClickToChatUrl(effectiveNumber, message);

  const buttonText =
    label || (source === 'card' ? config.cardButtonLabel || 'WhatsApp' : config.primaryButtonLabel);

  const baseStyles =
    variant === 'primary'
      ? 'inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'
      : variant === 'compact'
        ? 'inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-2 min-h-[44px] max-w-full min-w-0 text-[11px] min-[360px]:text-xs sm:text-[13px] font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'
        : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600';

  const handleTracking = () => {
    if (onTrackClick) {
      onTrackClick({
        productId: product?.id || 'general',
        productName: product?.name || generalTopic || 'General Inquiry',
        sku: product?.sku || 'N/A',
        price: product?.price || 0,
        source,
      });
    }
  };

  if (!clickToChatUrl) {
    return (
      <button
        type="button"
        onClick={() => onUnconfiguredClick(message)}
        className={`${baseStyles} ${className}`}
      >
        <MessageCircle className={variant === 'compact' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
        <span className="truncate">{buttonText}</span>
      </button>
    );
  }

  return (
    <a
      href={clickToChatUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleTracking}
      className={`${baseStyles} ${className}`}
    >
      <MessageCircle className={variant === 'compact' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
      <span className="truncate">{buttonText}</span>
    </a>
  );
}
