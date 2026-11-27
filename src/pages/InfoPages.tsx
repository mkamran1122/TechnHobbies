import { WhatsAppInquiryButton } from '../components/WhatsAppInquiryButton';
import type { StoreSettings, WhatsAppConfig } from '../types/catalog';

interface InfoPageProps {
  mode: 'about' | 'privacy' | 'terms';
  storeSettings: StoreSettings;
  whatsappConfig: WhatsAppConfig;
  onTrackWhatsAppClick: (payload: {
    productId: string;
    productName: string;
    sku: string;
    price: number;
    source: 'pdp' | 'card' | 'general';
  }) => void;
  onUnconfiguredWhatsApp: (previewMessage: string) => void;
}

export function InfoPage({
  mode,
  storeSettings,
  whatsappConfig,
  onTrackWhatsAppClick,
  onUnconfiguredWhatsApp,
}: InfoPageProps) {
  if (mode === 'about') {
    const email = storeSettings.contactEmail.trim();
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10">
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-8 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-slate-200 pb-4 sm:pb-5">
            <picture className="shrink-0">
              <source type="image/webp" srcSet="/assets/aistudio/TNH_Logo_PNG_99ea69a1.webp" />
              <img
                src="/assets/aistudio/TNH_Logo_PNG_99ea69a1.png"
                alt="TechnHobbies Logo"
                width={56}
                height={56}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
              />
            </picture>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                About {storeSettings.storeName}
              </p>
              <h1 className="font-display text-xl sm:text-3xl font-bold text-slate-900 leading-snug">
                RC Cars, Drones &amp; Hobby Hardware in Pakistan
              </h1>
            </div>
          </div>

          <div className="space-y-4 text-sm sm:text-base text-slate-700 leading-relaxed">
            <p>
              TechnHobbies operates as a focused Pakistani RC and hobby hardware discovery catalog.
              Every vehicle, FPV airframe, radio transmitter, and LiPo battery lists verified
              technical specifications, box contents, compatibility guidance, and clear pricing in
              Pakistani Rupees (PKR).
            </p>
            <p>
              Instead of forcing automated checkouts on specialized electronics, we pair our online
              catalog with direct WhatsApp consultation so you can confirm stock availability,
              battery connectors, and shipping details directly with our team before ordering.
            </p>
            <p>
              Eligible items carry a 7-day return window subject to unused original condition,
              intact packaging, and our published return policy conditions.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{storeSettings.cityBase}</p>
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center min-h-[36px] text-sm font-medium text-orange-700 hover:underline break-all"
                >
                  {email}
                </a>
              )}
            </div>
            <WhatsAppInquiryButton
              config={whatsappConfig}
              generalTopic="Hardware Consultation & Availability"
              label="Contact on WhatsApp"
              source="general"
              variant="secondary"
              className="w-full sm:w-auto"
              onTrackClick={onTrackWhatsAppClick}
              onUnconfiguredClick={onUnconfiguredWhatsApp}
            />
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'privacy') {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10">
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-8 space-y-4 sm:space-y-5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Privacy Policy
          </h1>
          <div className="space-y-4 text-sm sm:text-base text-slate-700 leading-relaxed">
            <p>
              TechnHobbies operates as a product discovery catalog. We do not collect payment card
              details, bank credentials, or automated checkout billing profiles on this website.
            </p>
            <p>
              When you tap a WhatsApp inquiry button, your browser opens WhatsApp with a prefilled
              message containing the selected product name, SKU, PKR price, and product link. Any
              conversation you initiate takes place directly within WhatsApp under your own consent.
            </p>
            <p>
              Catalog adjustments made inside the local preview console are saved only in your
              current browser&apos;s local storage until a backend service is connected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10">
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-8 space-y-5 sm:space-y-6">
        <h1 className="font-display text-xl sm:text-3xl font-bold text-slate-900 leading-snug">
          Terms, Warranty &amp; 7-Day Return Policy
        </h1>

        <div className="space-y-5 text-sm sm:text-base text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Catalog Pricing &amp; Inquiries</h2>
            <p>
              All prices on TechnHobbies are listed in Pakistani Rupees (PKR) for product discovery.
              Final stock availability, variant options, and nationwide courier charges are confirmed
              directly via our official WhatsApp inquiry channel.
            </p>
          </section>

          <section className="space-y-2 pt-3 border-t border-slate-200">
            <h2 className="text-base font-bold text-slate-900">7-Day Return Policy</h2>
            <p>
              Eligible products may be requested for return within <strong>7 days</strong> of
              delivery, subject to all of the following conditions:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                The item must be in unused, unmodified condition with original packaging, manuals,
                seals, and all included accessories intact.
              </li>
              <li>
                Opened or soldered electronics, discharged or puffed LiPo batteries, and items with
                crash, water, or reverse-polarity damage are not eligible for return.
              </li>
              <li>
                Return eligibility is verified through WhatsApp support with order/dispatch proof
                and unboxing photos or video prior to shipping the item back.
              </li>
            </ul>
          </section>

          <section className="space-y-2 pt-3 border-t border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Product Warranty &amp; Safe Use</h2>
            <p>
              Warranty coverage applies only where explicitly stated on an individual product page
              (for example, dead-on-arrival bench inspection coverage prior to field use or crash
              impact). High-discharge LiPo batteries, brushless motors, and RC aircraft require safe
              handling and operation in accordance with local regulations.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
