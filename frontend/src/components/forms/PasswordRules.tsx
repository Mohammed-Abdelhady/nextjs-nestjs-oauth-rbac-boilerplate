'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Circle } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import {
  evaluatePasswordRules,
  MIN_PASSWORD_LENGTH,
  type PasswordRuleId,
} from '@/lib/validations/passwordRules';

export interface PasswordRulesProps {
  /** Explicit password value if controlled directly */
  value?: string;
  /** Field name in react-hook-form context to watch */
  name?: string;
  /** Minimum length threshold */
  minLength?: number;
  /** Additional CSS class names */
  className?: string;
}

export function PasswordRules({
  value: controlledValue,
  name,
  minLength = MIN_PASSWORD_LENGTH,
  className,
}: PasswordRulesProps): React.JSX.Element {
  const t = useTranslations('auth.passwordRules');

  const watchedValue = useWatch({
    name: name || '',
    defaultValue: '',
    disabled: !name || controlledValue !== undefined,
  });

  const password =
    controlledValue !== undefined
      ? controlledValue
      : typeof watchedValue === 'string'
        ? watchedValue
        : '';

  const results = React.useMemo(
    () => evaluatePasswordRules(password, minLength),
    [password, minLength],
  );

  const getRuleLabel = (id: PasswordRuleId): string => {
    switch (id) {
      case 'minLength':
        return t('minLength');
      case 'uppercase':
        return t('uppercase');
      case 'lowercase':
        return t('lowercase');
      case 'number':
        return t('number');
    }
  };

  return (
    <div
      aria-live="polite"
      data-testid="password-rules"
      className={cn('space-y-1.5 text-xs', className)}
    >
      <p className="font-medium text-muted-foreground">{t('title')}</p>
      <ul className="space-y-1">
        {results.map((rule) => (
          <li
            key={rule.id}
            data-testid={`password-rule-${rule.id}`}
            data-passed={rule.passed}
            className={cn(
              'flex items-center gap-2 transition-colors',
              rule.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {rule.passed ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden="true" />
            )}
            <span>{getRuleLabel(rule.id)}</span>
            <span className="sr-only">
              {rule.passed ? ` (${t('passed')})` : ` (${t('failed')})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
