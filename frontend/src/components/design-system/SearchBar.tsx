import { forwardRef, InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Callback when clear button is clicked
   */
  onClear?: () => void;

  /**
   * Show clear button when input has value
   */
  showClear?: boolean;
}

/**
 * SearchBar - Underline-style search input
 *
 * Features:
 * - No border, only bottom underline
 * - Search icon on the left
 * - Optional clear button on the right
 * - Minimal aesthetic with refined transitions
 * - Focus state with accent color underline
 *
 * @example
 * ```tsx
 * <SearchBar
 *   placeholder="Search users..."
 *   value={searchQuery}
 *   onChange={(e) => setSearchQuery(e.target.value)}
 *   onClear={() => setSearchQuery('')}
 *   showClear={searchQuery.length > 0}
 * />
 * ```
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, onClear, showClear = false, value, ...props }, ref) => {
    return (
      <div className={cn('relative group', className)}>
        {/* Search Icon */}
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />

        {/* Input */}
        <input
          ref={ref}
          type="text"
          value={value}
          className={cn(
            'w-full bg-transparent pl-7 pr-8 py-2',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'border-0 border-b border-border',
            'focus:outline-none focus:border-primary',
            'transition-all duration-200 ease-out',
          )}
          data-testid="search-bar"
          {...props}
        />

        {/* Clear Button */}
        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2',
              'h-5 w-5 rounded-full',
              'flex items-center justify-center',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-muted',
              'transition-colors duration-150',
            )}
            data-testid="clear-search-button"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
