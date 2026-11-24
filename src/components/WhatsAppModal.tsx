import { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Settings, X } from 'lucide-react';

interface WhatsAppNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewMessage: string;
  onGoToAdminWhatsApp: () => void;
}

export function WhatsAppNoticeModal({
  isOpen,
  onClose,
  previewMessage,
  onGoToAdminWhatsApp,
}: WhatsAppNoticeModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-config-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-lg overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
            <h2 id="wa-config-modal-title" className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              WhatsApp Business Number Not Configured
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Direct WhatsApp links are paused until an official business phone number is configured.
            TechnHobbies never uses placeholder or invented phone numbers.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">How to enable WhatsApp inquiries:</p>
            <p className="break-words">
              Set <code className="font-mono bg-slate-200/70 px-1 py-0.5 rounded">VITE_WHATSAPP_BUSINESS_NUMBER</code> in your environment, or enter your official number in{' '}
              <span className="font-medium text-slate-900">Admin Dashboard → WhatsApp Settings</span>.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Prefilled Inquiry Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-3 rounded-lg whitespace-pre-wrap break-words leading-relaxed">
              {previewMessage}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToAdminWhatsApp();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span>Configure in Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}
