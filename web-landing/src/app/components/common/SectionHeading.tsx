import type { ReactNode } from 'react';

interface SectionHeadingProps {
  /** Small uppercase label above the title. */
  eyebrow: ReactNode;
  /** Main heading; accepts rich content (line breaks, highlighted spans). */
  title: ReactNode;
  /** Optional supporting paragraph below the title. */
  subtitle?: ReactNode;
  /** Wrapper classes that control width, alignment and bottom spacing. */
  className?: string;
  /** Overrides the title line-height when a section needs a tighter value. */
  titleClassName?: string;
}

/**
 * The eyebrow + heading + subtitle block shared by the landing-page sections,
 * including the scroll-into-view reveal. Layout (width, alignment, spacing) is
 * supplied by the caller via `className` so each section keeps its exact look.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
  titleClassName = 'leading-[1.08]',
}: SectionHeadingProps) {
  return (
    <div className={className}>
      <p
        className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4"
      >
        {eyebrow}
      </p>
      <h2
        className={`text-4xl sm:text-5xl font-black text-gray-900 tracking-tight ${titleClassName} mb-5`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="text-lg text-gray-600 leading-relaxed"
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
