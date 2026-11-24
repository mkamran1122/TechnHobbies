import { ExternalLink, Mail, MessageCircle } from 'lucide-react';
import {
  buildGeneralInquiryMessage,
  buildWhatsAppClickToChatUrl,
  formatWhatsAppDisplayNumber,
  resolveEffectiveWhatsAppNumber,
} from '../config/whatsapp';
import type { Category, StoreSettings, WhatsAppConfig } from '../types/catalog';
import type { AppRoute } from '../utils/routing';
import { sanitizeExternalUrl } from '../utils/url';

interface FooterProps {
  categories: Category[];
  storeSettings: StoreSettings;
  whatsappConfig: WhatsAppConfig;
  onNavigate: (route: AppRoute) => void;
  onSelectCategory: (categoryId: string) => void;
  onUnconfiguredWhatsApp: (previewMessage: string) => void;
}

export function Footer({
  categories,
  storeSettings,
  whatsappConfig,
  onNavigate,
  onSelectCategory,
  onUnconfiguredWhatsApp,
}: FooterProps) {
  const effectiveWhatsApp = resolveEffectiveWhatsAppNumber(whatsappConfig.businessNumber);
  const generalMsg = buildGeneralInquiryMessage('Product Availability & Return Policy');
  const whatsappUrl = buildWhatsAppClickToChatUrl(effectiveWhatsApp, generalMsg);
  const configuredEmail = storeSettings.contactEmail.trim();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand & Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/aistudio/TNH_Logo_PNG_99ea69a1.png"
                alt="TechnHobbies Logo"
                className="w-10 h-10 object-contain bg-white rounded-md p-1 shrink-0"
              />
              <div>
                <p className="font-display text-base font-bold text-white">
                  {storeSettings.storeName}
                </p>
                <p className="text-xs text-slate-400">{storeSettings.cityBase}</p>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-sm">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp: {formatWhatsAppDisplayNumber(effectiveWhatsApp)}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onUnconfiguredWhatsApp(generalMsg)}
                  className="inline-flex items-center gap-2 font-medium text-orange-400 hover:text-orange-300 text-left"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Official WhatsApp Support</span>
                </button>
              )}

              {configuredEmail && (
                <div>
                  <a
                    href={`mailto:${configuredEmail}`}
                    className="inline-flex items-center gap-2 text-slate-300 hover:text-white break-all"
                  >
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>{configuredEmail}</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Categories</h3>
            <ul className="space-y-2 text-sm">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className="text-slate-400 hover:text-white text-left"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Store & Policies */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Store &amp; Policies</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="text-slate-400 hover:text-white"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="text-slate-400 hover:text-white"
                >
                  About TechnHobbies
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="text-slate-400 hover:text-white"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('terms')}
                  className="text-slate-400 hover:text-white text-left"
                >
                  Terms &amp; 7-Day Return Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Follow Us</h3>
            <div className="flex flex-col gap-2 text-sm">
              {sanitizeExternalUrl(storeSettings.socialLinks.instagram) && (
                <a
                  href={sanitizeExternalUrl(storeSettings.socialLinks.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-orange-400"
                >
                  <span>Instagram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {sanitizeExternalUrl(storeSettings.socialLinks.youtube) && (
                <a
                  href={sanitizeExternalUrl(storeSettings.socialLinks.youtube)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-orange-400"
                >
                  <span>YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {sanitizeExternalUrl(storeSettings.socialLinks.facebook) && (
                <a
                  href={sanitizeExternalUrl(storeSettings.socialLinks.facebook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-orange-400"
                >
                  <span>Facebook</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
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
