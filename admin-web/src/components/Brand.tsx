import { SYMBOL_FIGURES, SYMBOL_TRANSFORM, WORDMARK_PATH, WORDMARK_VIEWBOX } from './brand/sihamArt';

const IVORY = '#F5F1E7';
const [, , WORDMARK_W, WORDMARK_H] = WORDMARK_VIEWBOX.split(' ').map(Number);

/**
 * The Siham symbol and wordmark with a label under it ("Admin", a company
 * name). The wordmark and the logo's ivory figure take the text colour, so
 * they read on the navy sidebar and on the sign-in card in either theme.
 */
export function Brand({ label }: { label: string }) {
  return (
    <div className="brand">
      <svg width={32} height={32} viewBox="0 0 1000 1000" aria-hidden="true">
        <g transform={SYMBOL_TRANSFORM}>
          {SYMBOL_FIGURES.map((f) => (
            <g key={f.name} fill={f.fill === IVORY ? 'currentColor' : f.fill}>
              <path d={f.d} />
              <circle cx={f.head.cx} cy={f.head.cy} r={f.head.r} />
            </g>
          ))}
        </g>
      </svg>
      <span className="brand-name">
        <svg width={(13 * WORDMARK_W) / WORDMARK_H} height={13} viewBox={WORDMARK_VIEWBOX} role="img" aria-label="Siham">
          <path d={WORDMARK_PATH} fill="currentColor" fillRule="evenodd" />
        </svg>
        <small>{label}</small>
      </span>
    </div>
  );
}
