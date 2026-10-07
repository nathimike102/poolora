import { SYMBOL_FIGURES, SYMBOL_TRANSFORM, WORDMARK_PATH, WORDMARK_VIEWBOX } from './sihamArt';
import { colors } from '../../../theme/colors';

const [, , WORDMARK_W, WORDMARK_H] = WORDMARK_VIEWBOX.split(' ').map(Number);

type Tone = 'onLight' | 'onDark';

/** The three-people symbol. On light backgrounds the ivory figure turns navy. */
export function SihamSymbol({ size, tone = 'onLight' }: { size: number; tone?: Tone }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
      <g transform={SYMBOL_TRANSFORM}>
        {SYMBOL_FIGURES.map((f) => (
          <g key={f.name} fill={tone === 'onLight' && f.fill === colors.ivory ? colors.navy : f.fill}>
            <path d={f.d} />
            <circle cx={f.head.cx} cy={f.head.cy} r={f.head.r} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Horizontal lockup: symbol beside the SIHAM wordmark. */
export function SihamLogo({ size = 36, tone = 'onLight' }: { size?: number; tone?: Tone }) {
  const wordHeight = size * 0.42;
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.28 }} role="img" aria-label="Siham">
      <SihamSymbol size={size} tone={tone} />
      <svg
        width={(wordHeight * WORDMARK_W) / WORDMARK_H}
        height={wordHeight}
        viewBox={WORDMARK_VIEWBOX}
        aria-hidden="true"
        focusable="false"
      >
        <path d={WORDMARK_PATH} fill={tone === 'onLight' ? colors.navy : colors.ivory} fillRule="evenodd" />
      </svg>
    </span>
  );
}
