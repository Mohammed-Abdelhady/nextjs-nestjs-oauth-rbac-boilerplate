'use client';

import { useCallback, type ChangeEvent } from 'react';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { FormInput } from '@/components/forms';
import { filterDigits } from '@/modules/auth/utils/digitFilter';
import { TOTP_CODE_LENGTH } from '../constants';

interface CodeFieldProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  testId: string;
}

/**
 * The six digit box. Everything but digits is dropped as it is typed, so a
 * code pasted with spaces from an authenticator app still submits.
 */
export function CodeField<TFieldValues extends FieldValues>({
  name,
  label,
  disabled,
  autoFocus,
  testId,
}: CodeFieldProps<TFieldValues>) {
  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = filterDigits(event.target.value, TOTP_CODE_LENGTH);
  }, []);

  return (
    <FormInput<TFieldValues>
      name={name}
      label={label}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      maxLength={TOTP_CODE_LENGTH}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={onChange}
      className="text-center text-2xl tracking-widest"
      data-testid={testId}
    />
  );
}
