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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTextareaClassName, FORM_STYLES } from '@/lib/config/form-styles';

export interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues> extends Omit<
  React.ComponentProps<'textarea'>,
  'name'
> {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  showCharCount?: boolean;
}

export const FormTextarea = <TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  maxLength,
  showCharCount = false,
  className,
  onChange: consumerOnChange,
  onBlur: consumerOnBlur,
  ...textareaProps
}: FormTextareaProps<TFieldValues>): React.JSX.Element => {
  const { control } = useFormContext<TFieldValues>();
  const restTextareaProps: Record<string, unknown> = { ...textareaProps };
  delete restTextareaProps['aria-describedby'];
  delete restTextareaProps['aria-invalid'];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const { onChange: fieldOnChange, onBlur: fieldOnBlur, ...restField } = field;
        return (
          <FormItem className={cn(FORM_STYLES.container, className)}>
            {label && <FormLabel>{label}</FormLabel>}
            <div className="relative">
              <FormControl>
                <Textarea
                  {...restField}
                  {...restTextareaProps}
                  maxLength={maxLength}
                  onChange={(e) => {
                    consumerOnChange?.(e);
                    fieldOnChange(e);
                  }}
                  onBlur={(e) => {
                    consumerOnBlur?.(e);
                    fieldOnBlur();
                  }}
                  className={cn(getTextareaClassName())}
                />
              </FormControl>
              {showCharCount && maxLength && (
                <div
                  className="absolute bottom-2 end-2 text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {field.value?.length || 0}/{maxLength}
                </div>
              )}
            </div>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
