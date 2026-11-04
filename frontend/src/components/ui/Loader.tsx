import { Infinity as InfinityLoader } from 'ldrs/react';
import 'ldrs/react/Infinity.css';

/**
 * The Edunex loading mark: an infinity loop (ldrs) in brand indigo. `size` is its width in px;
 * the stroke scales with it so small loaders inside buttons stay legible.
 */
export function Loader({ size = 55, color = 'var(--brand)', label = 'Loading' }: { size?: number; color?: string; label?: string }) {
  return (
    <span className="loader" role="status" aria-label={label}>
      <InfinityLoader size={size} stroke={Math.max(2, Math.round(size / 14))} strokeLength="0.15" bgOpacity="0.1" speed="1.3" color={color} />
    </span>
  );
}

/** A page-sized loading state: the loader centred, with an optional line under it. */
export function PageLoader({ text }: { text?: string }) {
  return (
    <div className="pageloader" aria-busy="true">
      <Loader size={64} />
      {text && <span className="t-sm t-muted">{text}</span>}
    </div>
  );
}
