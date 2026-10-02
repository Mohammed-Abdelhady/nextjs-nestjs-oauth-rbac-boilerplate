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

### useServerFieldErrors

Marks the fields a rejected request names in `error.details.fields`.

**Parameters:**

| Parameter      | Type                                       | Description                                        |
| -------------- | ------------------------------------------ | -------------------------------------------------- |
| `target`       | `{ getFieldElement, setError }` (required) | Where the form's controls and errors live          |
| `isSubmitting` | `boolean` (required)                       | The flag that disables the fields during a request |

**Returns:** `(error: unknown) => boolean`, true when at least one field was marked

Build the target with `useFormFieldTarget(form.setError, formRef)` for a react-hook-form form, or `useLocalFieldTarget(setErrors, idPrefix)` for a form that keeps its errors in local state. Both return the same object on every render.

- The server's messages are English only and are not shown. Every marked field shows the localized `errors.codes.INVALID_INPUT` message.
- A field name the form has no control for is ignored.
- The first marked field, as the fields appear on screen, takes the focus once the fields are enabled again.
- Do not call `toast.error` for a rejected request. The store's error interceptor raises one localized toast for every rejection, so a second call shows the message twice.
- End the catch with `reportUnlessHandled(error)`. It does nothing for a rejected request. For anything else, such as a programming error, it shows the generic failure message and rethrows.
- Give the mutation `invalidatesTags: invalidateOnSuccess([...])`. A plain tag list also refetches after a rejection, and a refetch can replace what the person typed.

**Usage:**

```tsx
const form = useFormWithValidation({ schema: mySchema, defaultValues });
const formRef = useRef<HTMLFormElement>(null);
const applyServerFieldErrors = useServerFieldErrors(
  useFormFieldTarget(form.setError, formRef),
  isLoading,
);

try {
  await save(data).unwrap();
} catch (error) {
  applyServerFieldErrors(error);
  reportUnlessHandled(error);
}

return <form ref={formRef}>...</form>;
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
