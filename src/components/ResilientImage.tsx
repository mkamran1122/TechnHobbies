import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isValidImageSource } from '../utils/url';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
}

function getLocalWebpSources(src: string): { thumbWebp: string; fullWebp: string } | null {
  if (/^\/src\/assets\/images\/[^/]+\.jpg$/i.test(src)) {
    const base = src.slice(0, -4);
    return {
      thumbWebp: `${base}-thumb.webp`,
      fullWebp: `${base}.webp`,
    };
  }
  return null;
}

export function ResilientImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
  priority = false,
  sizes = '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw',
  width = 1000,
  height = 747,
}: ResilientImageProps) {
  const [noReferrerRetrySrc, setNoReferrerRetrySrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const normalizedSrc = src && isValidImageSource(src) ? src.trim() : undefined;
  const isExternalUrl = Boolean(normalizedSrc && /^https?:\/\//i.test(normalizedSrc));
  const useNoReferrer = Boolean(normalizedSrc && noReferrerRetrySrc === normalizedSrc);
  const hasError = Boolean(normalizedSrc && failedSrc === normalizedSrc);

  useEffect(() => {
    setNoReferrerRetrySrc(null);
    setFailedSrc(null);
  }, [normalizedSrc]);

  const handleImageError = () => {
    if (!normalizedSrc) return;
    if (isExternalUrl && !useNoReferrer) {
      setNoReferrerRetrySrc(normalizedSrc);
      return;
    }
    setFailedSrc(normalizedSrc);
  };

  if (!normalizedSrc || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 p-4 text-center"
      >
        <Package className="w-8 h-8 text-slate-400 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[180px]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  const webpSources = getLocalWebpSources(normalizedSrc);

  if (webpSources) {
    const maxW = normalizedSrc.includes('hero_rc_workshop') ? '1376w' : '1000w';
    return (
      <picture key={normalizedSrc} className="block w-full h-full">
        <source
          type="image/webp"
          srcSet={`${webpSources.thumbWebp} 480w, ${webpSources.fullWebp} ${maxW}`}
          sizes={sizes}
        />
        <img
          src={normalizedSrc}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={handleImageError}
          className={className}
        />
      </picture>
    );
  }

  return (
    <img
      key={`${normalizedSrc}-${useNoReferrer ? 'noref' : 'std'}`}
      src={normalizedSrc}
      alt={alt}
      width={width}
      height={height}
      referrerPolicy={useNoReferrer ? 'no-referrer' : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={handleImageError}
      className={className}
    />
  );
}
