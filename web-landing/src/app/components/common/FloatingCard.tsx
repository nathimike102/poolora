import type { ReactNode } from 'react';

interface FloatingCardProps {
  /** Positioning + width classes, relative to the anchoring phone container. */
  className?: string;
  /** Icon element rendered inside the coloured badge. */
  icon: ReactNode;
  /** Background utility for the icon badge (e.g. `bg-emerald-100`). */
  iconBgClassName: string;
  title: string;
  subtitle: string;
}

/**
 * Small information card that floats beside the Hero phone mockup. It is
 * positioned absolutely against the phone's anchor container (see Hero), so the
 * cards stay attached to the device at every breakpoint where they are shown.
 */
export function FloatingCard({
  className,
  icon,
  iconBgClassName,
  title,
  subtitle,
}: FloatingCardProps) {
  return (
    <div
      className={`absolute z-20 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xl shadow-black/10 ${className ?? ''}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBgClassName}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-gray-900">{title}</p>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}
