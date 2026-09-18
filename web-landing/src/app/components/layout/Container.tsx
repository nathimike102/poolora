import type { ElementType, ComponentPropsWithoutRef, ReactNode } from 'react';
import { CONTAINER_CLASS } from '@/theme';

type ContainerProps<T extends ElementType> = {
  /** Element to render as. Defaults to `div`. */
  as?: T;
  /** Extra classes appended after the shared container width/padding. */
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/**
 * Centered, max-width page container with the standard responsive gutters.
 * Replaces the `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` pattern repeated across
 * every section.
 */
export function Container<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...rest
}: ContainerProps<T>) {
  const Component = (as ?? 'div') as ElementType;
  return (
    <Component
      className={className ? `${CONTAINER_CLASS} ${className}` : CONTAINER_CLASS}
      {...rest}
    >
      {children}
    </Component>
  );
}
