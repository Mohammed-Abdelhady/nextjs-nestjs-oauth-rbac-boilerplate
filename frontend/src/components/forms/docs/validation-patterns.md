## Validation Schemas

All validation schemas are located in `@app/core` and organized by category:

- **String validators** (25): `zodEmail`, `zodPassword`, `zodUrl`, `zodSlug`, etc.
- **Number validators** (12): `zodPositiveNumber`, `zodAge`, `zodPrice`, etc.
- **Date validators** (7): `zodDate`, `zodFutureDate`, `zodDateRange`, etc.
- **Boolean validators** (2): `zodBoolean`, `zodAcceptTerms`
- **Array validators** (8): `zodArray`, `zodNonEmptyArray`, `zodUniqueArray`, etc.

**Example Schema:**

```tsx
import { zodEmail, zodStrongPassword, zodName } from '@app/core';
import { z } from 'zod';

const registerSchema = z
  .object({
    name: zodName({ required: true }),
    email: zodEmail(),
    password: zodStrongPassword({ min: 12 }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

---

## Common Patterns

### Password with Confirmation

```tsx
const schema = z.object({
  password: zodPassword({ min: 8 }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

<FormPassword name="password" label="Password" />
<FormPassword name="confirmPassword" label="Confirm Password" />
```

### Conditional Fields

```tsx
const schema = z
  .object({
    hasCompany: zodBoolean(),
    companyName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.hasCompany) {
        return !!data.companyName;
      }
      return true;
    },
    {
      message: 'Company name is required',
      path: ['companyName'],
    },
  );

const hasCompany = form.watch('hasCompany');

<FormCheckbox name="hasCompany" label="I have a company" />;
{
  hasCompany && <FormInput name="companyName" label="Company Name" />;
}
```

### Dynamic Field Arrays

```tsx
import { useFieldArray } from 'react-hook-form';

const schema = z.object({
  emails: z.array(
    z.object({
      value: zodEmail(),
    }),
  ),
});

const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'emails',
});

{
  fields.map((field, index) => (
    <div key={field.id}>
      <FormInput name={`emails.${index}.value`} label={`Email ${index + 1}`} />
      <button onClick={() => remove(index)}>Remove</button>
    </div>
  ));
}
<button onClick={() => append({ value: '' })}>Add Email</button>;
```

### Server-side Validation

```tsx
const onSubmit = async (data: FormValues) => {
  try {
    await api.post('/submit', data);
  } catch (error) {
    if (error.response?.data?.errors) {
      setServerErrors(form.setError, error.response.data.errors);
    }
  }
};
```

---
