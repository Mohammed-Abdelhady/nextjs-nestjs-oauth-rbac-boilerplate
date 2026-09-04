'use client';

/**
 * Generic Form Example - Demonstrates All Form Components
 *
 * This is a demo component showing all form components with validation.
 * NOT intended for production use - for reference only.
 *
 * Demonstrates:
 * - All 7 form components (Input, Password, Select, Textarea, Checkbox, Radio, Switch)
 * - Zod validation with custom validators
 * - Error display and handling
 * - Accessibility features
 * - TypeScript type inference
 */

import * as React from 'react';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import {
  FormInput,
  FormPassword,
  FormSelect,
  FormTextarea,
  FormCheckbox,
  FormRadio,
  FormSwitch,
} from '@/components/forms';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { exampleSchema, type ExampleFormValues } from './exampleSchema';

export function GenericFormExample() {
  const [submittedData, setSubmittedData] = React.useState<ExampleFormValues | null>(null);

  // Initialize form with useFormWithValidation hook
  const form = useFormWithValidation({
    schema: exampleSchema,
    defaultValues: {
      name: '',
      email: '',
      website: '',
      password: '',
      country: '' as 'us' | 'ca' | 'uk' | 'au',
      bio: '',
      acceptTerms: false,
      interests: [],
      role: '' as 'user' | 'admin' | 'moderator',
      notifications: false,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  // Form submission handler
  const onSubmit = (data: ExampleFormValues) => {
    console.log('Form submitted:', data);
    setSubmittedData(data);

    // In a real app, you would send this to your API
    // Example:
    // try {
    //   await api.post('/endpoint', data);
    // } catch (error) {
    //   setServerErrors(form.setError, error.response.data.errors);
    // }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Generic Form Example</h1>
        <p className="mt-2 text-muted-foreground">
          Demonstrating all form components with Zod validation and React Hook Form integration.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Text Input - Basic */}
          <FormInput
            name="name"
            placeholder="John Doe"
            description="Enter your full name as it appears on official documents"
            autoFocus
          />

          {/* Email Input - Email validation */}
          <FormInput name="email" type="email" placeholder="john@example.com" />

          {/* URL Input - Optional field */}
          <FormInput
            name="website"
            type="url"
            placeholder="https://example.com"
            description="Your personal or company website (optional)"
          />

          {/* Password Input - With visibility toggle */}
          <FormPassword
            name="password"
            placeholder="Enter a secure password"
            description="Minimum 8 characters required"
          />

          {/* Select - Country dropdown */}
          <FormSelect
            name="country"
            placeholder="Select your country"
            options={[
              { label: 'United States', value: 'us' },
              { label: 'Canada', value: 'ca' },
              { label: 'United Kingdom', value: 'uk' },
              { label: 'Australia', value: 'au' },
            ]}
          />

          {/* Textarea - With character count */}
          <FormTextarea
            name="bio"
            placeholder="Tell us about yourself..."
            maxLength={500}
            showCharCount
            rows={4}
            description="Write a brief description about yourself (20-500 characters)"
          />

          {/* Single Checkbox - Terms acceptance */}
          <FormCheckbox name="acceptTerms" label="I accept the terms and conditions" required />

          {/* Checkbox Group - Multiple selections */}
          <FormCheckbox
            name="interests"
            label="Interests"
            description="Select all that apply"
            options={[
              { label: 'Technology', value: 'tech' },
              { label: 'Sports', value: 'sports' },
              { label: 'Music', value: 'music' },
              { label: 'Art', value: 'art' },
              { label: 'Travel', value: 'travel' },
            ]}
          />

          {/* Radio Buttons - Single selection */}
          <FormRadio
            name="role"
            label="Select Your Role"
            description="Choose the role that best describes you"
            options={[
              { label: 'User', value: 'user' },
              { label: 'Administrator', value: 'admin' },
              { label: 'Moderator', value: 'moderator' },
            ]}
          />

          {/* Switch - Toggle boolean */}
          <FormSwitch
            name="notifications"
            label="Enable Email Notifications"
            description="Receive updates and notifications via email"
          />

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Submitting...' : 'Submit Form'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setSubmittedData(null);
              }}
            >
              Reset
            </Button>
          </div>

          {/* Display form errors if any */}
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4">
              <h3 className="mb-2 font-semibold text-destructive">
                Please fix the following errors:
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                {Object.entries(form.formState.errors).map(([field, error]) => (
                  <li key={field}>
                    <strong>{field}:</strong> {error?.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </Form>

      {/* Display submitted data */}
      {submittedData && (
        <div className="mt-8 rounded-md border border-success/20 bg-success/10 p-6">
          <h2 className="mb-4 text-xl font-semibold text-success">Form Submitted Successfully!</h2>
          <pre className="overflow-x-auto rounded bg-card border border-border p-4 text-sm text-foreground">
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        </div>
      )}

      {/* Usage notes */}
      <div className="mt-8 rounded-md border bg-muted p-6">
        <h3 className="mb-2 font-semibold">Usage Notes:</h3>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Validation:</strong> Try leaving required fields empty or entering invalid data
          </li>
          <li>
            <strong>Error Display:</strong> Errors appear below each field and in the summary
          </li>
          <li>
            <strong>Accessibility:</strong> Navigate using Tab key and test with screen readers
          </li>
          <li>
            <strong>Type Safety:</strong> All fields are fully typed with TypeScript
          </li>
          <li>
            <strong>Password Visibility:</strong> Click the eye icon to toggle password visibility
          </li>
          <li>
            <strong>Character Count:</strong> Bio field shows character count as you type
          </li>
        </ul>
      </div>
    </div>
  );
}
