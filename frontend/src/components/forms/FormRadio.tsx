'use client';

import * as React from 'react';
import { type FieldPath, type FieldValues } from 'react-hook-form';
import { FormControl, FormItem, FormLabel } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BaseFormField } from './BaseFormField';

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface FormRadioProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  options: RadioOption[];
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export const FormRadio = <TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  options,
  disabled,
  orientation = 'vertical',
}: FormRadioProps<TFieldValues>) => {
  return (
    <BaseFormField
      name={name}
      label={label}
      description={description}
      className="space-y-3"
      render={(field) => (
        <RadioGroup
          onValueChange={field.onChange}
          defaultValue={field.value}
          disabled={disabled}
          className={
            orientation === 'horizontal' ? 'flex flex-row gap-4' : 'flex flex-col space-y-1'
          }
        >
          {options.map((option) => (
            <FormItem key={option.value} className="flex items-center gap-3 space-y-0">
              <FormControl>
                <RadioGroupItem value={option.value} disabled={disabled || option.disabled} />
              </FormControl>
              <FormLabel className="font-normal">{option.label}</FormLabel>
            </FormItem>
          ))}
        </RadioGroup>
      )}
    />
  );
};
