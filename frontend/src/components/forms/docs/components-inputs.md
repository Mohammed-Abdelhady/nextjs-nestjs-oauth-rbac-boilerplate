## Components

### FormInput

Basic text input field with label, error message, and helper text.

**Props:**

| Prop          | Type                | Default | Description                        |
| ------------- | ------------------- | ------- | ---------------------------------- |
| `name`        | `string` (required) | -       | Field name in form                 |
| `label`       | `string`            | -       | Label text                         |
| `description` | `string`            | -       | Helper text below input            |
| `type`        | `string`            | `text`  | Input type (text, email, tel, etc) |
| `placeholder` | `string`            | -       | Placeholder text                   |
| `disabled`    | `boolean`           | `false` | Disable input                      |
| ...           | Native input props  | -       | All HTML input attributes          |

**Basic Usage:**

```tsx
<FormInput name="username" label="Username" placeholder="Enter username" />
```

**With Validation:**

```tsx
const schema = z.object({
  email: zodEmail({ message: 'Invalid email address' }),
});

<FormInput
  name="email"
  label="Email Address"
  type="email"
  description="We'll never share your email"
/>;
```

---

### FormPassword

Password input with visibility toggle button.

**Props:**

| Prop          | Type                | Default | Description               |
| ------------- | ------------------- | ------- | ------------------------- |
| `name`        | `string` (required) | -       | Field name in form        |
| `label`       | `string`            | -       | Label text                |
| `description` | `string`            | -       | Helper text below input   |
| `placeholder` | `string`            | -       | Placeholder text          |
| `disabled`    | `boolean`           | `false` | Disable input             |
| ...           | Native input props  | -       | All HTML input attributes |

**Basic Usage:**

```tsx
<FormPassword name="password" label="Password" placeholder="Enter password" />
```

**With Validation:**

```tsx
const schema = z.object({
  password: zodStrongPassword({
    min: 12,
    messages: {
      min: 'Password must be at least 12 characters',
    },
  }),
});

<FormPassword
  name="password"
  label="Password"
  description="Must contain uppercase, lowercase, number, and special character"
/>;
```

---

### FormSelect

Dropdown select field with options or grouped options.

**Props:**

| Prop          | Type                  | Default | Description              |
| ------------- | --------------------- | ------- | ------------------------ |
| `name`        | `string` (required)   | -       | Field name in form       |
| `label`       | `string`              | -       | Label text               |
| `description` | `string`              | -       | Helper text below select |
| `placeholder` | `string`              | -       | Placeholder when empty   |
| `options`     | `SelectOption[]`      | -       | Array of {label, value}  |
| `groups`      | `SelectOptionGroup[]` | -       | Grouped options          |
| `disabled`    | `boolean`             | `false` | Disable select           |

**Basic Usage:**

```tsx
<FormSelect
  name="country"
  label="Country"
  placeholder="Select country"
  options={[
    { label: 'United States', value: 'us' },
    { label: 'Canada', value: 'ca' },
    { label: 'United Kingdom', value: 'uk' },
  ]}
/>
```

**With Grouped Options:**

```tsx
<FormSelect
  name="timezone"
  label="Timezone"
  groups={[
    {
      label: 'North America',
      options: [
        { label: 'Eastern Time', value: 'et' },
        { label: 'Central Time', value: 'ct' },
      ],
    },
    {
      label: 'Europe',
      options: [
        { label: 'GMT', value: 'gmt' },
        { label: 'CET', value: 'cet' },
      ],
    },
  ]}
/>
```

---

### FormTextarea

Multiline text input with optional character count.

**Props:**

| Prop            | Type                  | Default | Description                  |
| --------------- | --------------------- | ------- | ---------------------------- |
| `name`          | `string` (required)   | -       | Field name in form           |
| `label`         | `string`              | -       | Label text                   |
| `description`   | `string`              | -       | Helper text below textarea   |
| `maxLength`     | `number`              | -       | Maximum character length     |
| `showCharCount` | `boolean`             | `false` | Show character count         |
| `placeholder`   | `string`              | -       | Placeholder text             |
| `disabled`      | `boolean`             | `false` | Disable textarea             |
| ...             | Native textarea props | -       | All HTML textarea attributes |

**Basic Usage:**

```tsx
<FormTextarea name="bio" label="Bio" placeholder="Tell us about yourself" rows={4} />
```

**With Character Count:**

```tsx
<FormTextarea
  name="description"
  label="Description"
  maxLength={500}
  showCharCount
  description="Provide a detailed description"
/>
```

---
