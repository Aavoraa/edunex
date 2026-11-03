/**
 * The Edunex mark as vector artwork: an open book with a teal spark above it,
 * optionally on the indigo app tile. Used for the logo and for the decorations
 * across the application (decorations are always hidden from screen readers).
 */
import { useId } from 'react';

export function BrandArt({ className, title, tile = false }: { className?: string; title?: string; tile?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`bt${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5155EC" />
          <stop offset="1" stopColor="#2B2E9E" />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill={`url(#bt${id})`} />}
      <path d="M12 27.5c6.6-3.2 13-3 19 .9v21.1c-6-3.9-12.4-4.1-19-.9z" fill={tile ? '#FFFFFF' : `url(#bt${id})`} />
      <path d="M52 27.5c-6.6-3.2-13-3-19 .9v21.1c6-3.9 12.4-4.1 19-.9z" fill={tile ? '#FFFFFF' : `url(#bt${id})`} fillOpacity=".82" />
      <path d="M32 8.5l2.1 5.4 5.4 2.1-5.4 2.1L32 23.5l-2.1-5.4-5.4-2.1 5.4-2.1z" fill="#2DD4BF" />
    </svg>
  );
}

/** Decorative mark placed by its class name (position and opacity come from the stylesheet). */
export function BrandDecor({ className }: { className?: string }) {
  return <span className={className} aria-hidden="true"><BrandArt /></span>;
}

/** Brand rule: a line, the small mark, a line. */
export function BrandRule({ className }: { className?: string }) {
  return (
    <span className={`brandrule${className ? ` ${className}` : ''}`} aria-hidden="true">
      <i /><BrandArt /><i />
    </span>
  );
}
