import { forwardRef, type HTMLAttributes } from 'react';
import { HEADING_ROLE_CLASSES, type HeadingVariant } from '@/constants/typography';
import { type UnsafeMarkupProp, withoutUnsafeMarkup } from '@/lib/unsafeMarkup';
import { cn } from '@/lib/utils';

const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;

export type HeadingLevel = keyof typeof HEADING_TAGS;

export interface HeadingProps extends Omit<HTMLAttributes<HTMLHeadingElement>, UnsafeMarkupProp> {
  /** Semantic level in the document outline. */
  level: HeadingLevel;

  /** Visual role, chosen independently of the level. */
  variant: HeadingVariant;
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, variant, className, ...props }, ref) => {
    const Tag = HEADING_TAGS[level];

    return (
      <Tag
        ref={ref}
        className={cn(HEADING_ROLE_CLASSES[variant], className)}
        {...withoutUnsafeMarkup(props)}
      />
    );
  },
);

Heading.displayName = 'Heading';
