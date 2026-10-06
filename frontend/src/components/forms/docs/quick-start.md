## Installation

All dependencies are already installed in this project:

```bash
pnpm add react-hook-form@^7.71.1 zod@^3.25.76 @hookform/resolvers@^3.10.0
```

---

## Quick Start

```tsx
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormPassword } from '@/components/forms';
import { Form } from '@/components/ui/form';
import { zodEmail, zodPassword } from '@app/core';
import { z } from 'zod';

const schema = z.object({
  email: zodEmail(),
  password: zodPassword({ min: 8 }),
});

type FormValues = z.infer<typeof schema>;

function MyForm() {
  const form = useFormWithValidation({
    schema,
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: FormValues) => {
    console.log(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput name="email" label="Email" type="email" />
        <FormPassword name="password" label="Password" />
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}
```

---
