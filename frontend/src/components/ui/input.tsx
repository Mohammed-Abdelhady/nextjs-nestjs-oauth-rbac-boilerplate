import * as React from 'react';

import { cn } from '@/lib/utils';
import { TEXT_CONTROL_FONT_SIZE } from '@/lib/config/form-styles';

export const INPUT_BASE_CLASSES = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  TEXT_CONTROL_FONT_SIZE,
);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(INPUT_BASE_CLASSES, className)} ref={ref} {...props} />;
  },
);
Input.displayName = 'Input';

export { Input };
