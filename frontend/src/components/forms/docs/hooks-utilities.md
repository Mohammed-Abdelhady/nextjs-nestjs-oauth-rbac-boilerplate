## Hooks

### useFormWithValidation

Custom hook that sets up React Hook Form with Zod validation.

**Parameters:**

| Parameter       | Type                   | Default  | Description           |
| --------------- | ---------------------- | -------- | --------------------- |
| `schema`        | `ZodSchema` (required) | -        | Zod validation schema |
| `defaultValues` | `object`               | -        | Default form values   |
| `mode`          | `string`               | `onBlur` | Validation mode       |
| `criteriaMode`  | `string`               | `all`    | Error criteria mode   |

**Returns:** `UseFormReturn` from React Hook Form

**Usage:**

```tsx
const form = useFormWithValidation({
  schema: mySchema,
  defaultValues: { name: '', email: '' },
  mode: 'onBlur', // onChange, onSubmit, onTouched
});
```

---

## Utilities

### Form Error Utilities

Located in `lib/utils/form-errors.ts`.

**formatZodError(error: ZodError): Record<string, string>**

- Transforms Zod errors into readable format

**getFieldError(errors: FieldErrors, fieldName: string): string | undefined**

- Extracts error message for specific field

**hasFieldError(errors: FieldErrors, fieldName: string): boolean**

- Checks if field has error

**setServerErrors(setError: UseFormSetError, serverErrors: Record<string, string>): void**

- Maps API errors to form fields

**getAllErrorMessages(errors: FieldErrors): string[]**

- Gets all error messages as array

**Usage:**

```tsx
try {
  await api.post('/submit', data);
} catch (error) {
  if (error.response?.data?.errors) {
    setServerErrors(form.setError, error.response.data.errors);
  }
}
```

---
