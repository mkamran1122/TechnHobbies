import { ExternalLink, Mail, MessageCircle } from 'lucide-react';
import {
  buildGeneralInquiryMessage,
  buildWhatsAppClickToChatUrl,
  formatWhatsAppDisplayNumber,
  resolveEffectiveWhatsAppNumber,
} from '../config/whatsapp';
import type { StoreSettings, WhatsAppConfig } from '../types/catalog';
import type { AppRoute } from '../utils/routing';
import { sanitizeExternalUrl } from '../utils/url';

interface FooterProps {
  storeSettings: StoreSettings;
  whatsappConfig: WhatsAppConfig;
  onNavigate: (route: AppRoute) => void;
  onUnconfiguredWhatsApp: (previewMessage: string) => void;
}

export function Footer({
  storeSettings,
  whatsappConfig,
  onNavigate,
  onUnconfiguredWhatsApp,
}: FooterProps) {
  const effectiveWhatsApp = resolveEffectiveWhatsAppNumber(whatsappConfig.businessNumber);
  const generalMsg = buildGeneralInquiryMessage('Product Availability & Return Policy');
  const whatsappUrl = buildWhatsAppClickToChatUrl(effectiveWhatsApp, generalMsg);
  const configuredEmail = storeSettings.contactEmail.trim();

  const instagramUrl = sanitizeExternalUrl(storeSettings.socialLinks.instagram);
  const youtubeUrl = sanitizeExternalUrl(storeSettings.socialLinks.youtube);
  const facebookUrl = sanitizeExternalUrl(storeSettings.socialLinks.facebook);

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        {/* Main Compact Bar: Left (Brand & Contact) · Center (Important Links) · Right (Social) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
          {/* Left: Logo, WhatsApp & Email */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <picture className="shrink-0">
                <source type="image/webp" srcSet="/assets/aistudio/TNH_Logo_PNG_99ea69a1.webp" />
                <img
                  src="/assets/aistudio/TNH_Logo_PNG_99ea69a1.png"
                  alt="TechnHobbies Logo"
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain bg-white rounded p-0.5 shrink-0"
                />
              </picture>
              <span className="font-display text-[15px] font-bold text-white leading-tight">
                {storeSettings.storeName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-snug">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 py-1 lg:py-0 font-medium text-orange-400 hover:text-orange-300 focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <MessageCircle className="w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0" />
                  <span>{formatWhatsAppDisplayNumber(effectiveWhatsApp)}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onUnconfiguredWhatsApp(generalMsg)}
                  className="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 py-1 lg:py-0 font-medium text-orange-400 hover:text-orange-300 text-left focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <MessageCircle className="w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0" />
                  <span>WhatsApp Support</span>
                </button>
              )}

              {configuredEmail && (
                <a
                  href={`mailto:${configuredEmail}`}
                  className="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-white break-all focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <Mail className="w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0" />
                  <span>{configuredEmail}</span>
                </a>
              )}
            </div>
          </div>

          {/* Center: Important Links (2-col grid on mobile, inline row on desktop) */}
          <nav
            aria-label="Footer navigation"
            className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 text-sm leading-snug"
          >
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-white text-left flex items-center focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-white text-left flex items-center focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-white text-left flex items-center focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-white text-left flex items-center focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
            >
              Return Policy
            </button>
          </nav>

          {/* Right: Social Media Links (single horizontal row on mobile & desktop) */}
          {(instagramUrl || youtubeUrl || facebookUrl) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm leading-snug lg:justify-end">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-orange-400 focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <span>Instagram</span>
                  <ExternalLink className="w-3.5 h-3.5 lg:w-3 lg:h-3 shrink-0" />
                </a>
              )}
              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-orange-400 focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <span>YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5 lg:w-3 lg:h-3 shrink-0" />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 py-1 lg:py-0 text-slate-300 hover:text-orange-400 focus-visible:outline-2 focus-visible:outline-orange-400 rounded"
                >
                  <span>Facebook</span>
                  <ExternalLink className="w-3.5 h-3.5 lg:w-3 lg:h-3 shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Slim Bottom Row: Copyright & MK Labs Credit */}
        <div className="border-t border-slate-800 mt-2 pt-2 pb-[env(safe-area-inset-bottom)] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[13px] leading-tight text-slate-400">
          <p>
            © {new Date().getFullYear()} {storeSettings.storeName}. A product by{' '}
            <a
              href="https://www.linkedin.com/company/mk-labs-2026/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white hover:text-orange-400 underline underline-offset-2"
            >
              MK Labs
            </a>
            .
          </p>
          <p>Prices in PKR · 7-Day Return Policy subject to eligibility conditions.</p>
        </div>
      </div>
    </footer>
  );
}
