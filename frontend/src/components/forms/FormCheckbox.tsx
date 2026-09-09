'use client';

import * as React from 'react';
import { useFormContext, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { BaseFormField } from './BaseFormField';

export interface CheckboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface FormCheckboxProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  options?: CheckboxOption[];
  disabled?: boolean;
  required?: boolean;
}

export const FormCheckbox = <TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  options,
  disabled,
  required,
}: FormCheckboxProps<TFieldValues>) => {
  const { control } = useFormContext<TFieldValues>();

  // Single checkbox mode (boolean value)
  if (!options) {
    return (
      <BaseFormField
        name={name}
        className="flex flex-row items-start gap-3 space-y-0"
        render={(field) => (
          <>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              required={required}
            />
            <div className="space-y-1 leading-none">
              {label && <FormLabel>{label}</FormLabel>}
              {description && <FormDescription>{description}</FormDescription>}
            </div>
          </>
        )}
      />
    );
  }

  // Checkbox group mode (array of values)
  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <div className="space-y-2">
            {options.map((option) => (
              <FormField
                key={option.value}
                control={control}
                name={name}
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(option.value)}
                          onCheckedChange={(checked: boolean) => {
                            return checked
                              ? field.onChange([...(field.value || []), option.value])
                              : field.onChange(
                                  field.value?.filter((value: string) => value !== option.value),
                                );
                          }}
                          disabled={disabled || option.disabled}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{option.label}</FormLabel>
                    </FormItem>
                  );
                }}
              />
            ))}
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
