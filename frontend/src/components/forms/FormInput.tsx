'use client';

import * as React from 'react';
import { type FieldPath, type FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getInputClassName } from '@/lib/config/form-styles';
import { BaseFormField } from './BaseFormField';

export interface FormInputProps<TFieldValues extends FieldValues = FieldValues> extends Omit<
  React.ComponentProps<'input'>,
  'name'
> {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
}

export const FormInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  className,
  onChange: consumerOnChange,
  onBlur: consumerOnBlur,
  ...inputProps
}: FormInputProps<TFieldValues>): React.JSX.Element => {
  const restInputProps: Record<string, unknown> = { ...inputProps };
  delete restInputProps['aria-describedby'];
  delete restInputProps['aria-invalid'];

  return (
    <BaseFormField
      name={name}
      label={label}
      description={description}
      render={(field) => {
        const { onChange: fieldOnChange, onBlur: fieldOnBlur, ...restField } = field;
        return (
          <Input
            {...restField}
            {...restInputProps}
            onChange={(e) => {
              consumerOnChange?.(e);
              fieldOnChange(e);
            }}
            onBlur={(e) => {
              consumerOnBlur?.(e);
              fieldOnBlur();
            }}
            className={cn(getInputClassName(), className)}
          />
        );
      }}
    />
  );
};
