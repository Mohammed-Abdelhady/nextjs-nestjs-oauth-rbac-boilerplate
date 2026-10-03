### FormCheckbox

Checkbox input supporting single checkbox or checkbox group.

**Props:**

| Prop          | Type                | Default | Description                |
| ------------- | ------------------- | ------- | -------------------------- |
| `name`        | `string` (required) | -       | Field name in form         |
| `label`       | `string`            | -       | Label text                 |
| `description` | `string`            | -       | Helper text below checkbox |
| `options`     | `CheckboxOption[]`  | -       | Array for checkbox group   |
| `disabled`    | `boolean`           | `false` | Disable checkbox           |
| `required`    | `boolean`           | `false` | Required checkbox          |

**Single Checkbox:**

```tsx
<FormCheckbox name="acceptTerms" label="I accept the terms and conditions" required />
```

**Checkbox Group:**

```tsx
<FormCheckbox
  name="interests"
  label="Interests"
  options={[
    { label: 'Technology', value: 'tech' },
    { label: 'Sports', value: 'sports' },
    { label: 'Music', value: 'music' },
  ]}
/>
```

---

### FormRadio

Radio button group with vertical or horizontal layout.

**Props:**

| Prop          | Type                     | Default    | Description                   |
| ------------- | ------------------------ | ---------- | ----------------------------- |
| `name`        | `string` (required)      | -          | Field name in form            |
| `label`       | `string`                 | -          | Label text                    |
| `description` | `string`                 | -          | Helper text below radio group |
| `options`     | `RadioOption[]`          | (required) | Array of {label, value}       |
| `disabled`    | `boolean`                | `false`    | Disable all options           |
| `orientation` | `vertical \| horizontal` | `vertical` | Layout direction              |

**Basic Usage:**

```tsx
<FormRadio
  name="role"
  label="Select Role"
  options={[
    { label: 'User', value: 'user' },
    { label: 'Admin', value: 'admin' },
    { label: 'Moderator', value: 'moderator' },
  ]}
/>
```

**Horizontal Layout:**

```tsx
<FormRadio
  name="theme"
  label="Theme"
  orientation="horizontal"
  options={[
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ]}
/>
```

---

### FormSwitch

Toggle switch with inline label.

**Props:**

| Prop          | Type                | Default | Description              |
| ------------- | ------------------- | ------- | ------------------------ |
| `name`        | `string` (required) | -       | Field name in form       |
| `label`       | `string`            | -       | Label text               |
| `description` | `string`            | -       | Helper text below switch |
| `disabled`    | `boolean`           | `false` | Disable switch           |

**Basic Usage:**

```tsx
<FormSwitch
  name="notifications"
  label="Enable Notifications"
  description="Receive email notifications"
/>
```

---

### BaseFormField

Low-level wrapper component for custom form fields. All form components are built on top of this base component.

#### Minimal API - Global Styles Always Applied

BaseFormField applies global form styles (compact spacing, hidden labels) automatically. Labels are not supported - use placeholders instead.

**Props:**

| Prop          | Type                  | Default | Description                     |
| ------------- | --------------------- | ------- | ------------------------------- |
| `name`        | `string` (required)   | -       | Field name in form              |
| `description` | `string`              | -       | Helper text (shown if provided) |
| `render`      | `function` (required) | -       | Render function for control     |
| `className`   | `string`              | -       | Custom className for FormItem   |

**Basic Usage:**

```tsx
// Simple input field with placeholder
<BaseFormField
  name="email"
  render={(field) => <Input {...field} placeholder="Email" />}
/>

// With description
<BaseFormField
  name="bio"
  description="Tell us about yourself"
  render={(field) => <Textarea {...field} />}
/>
```

**Custom Layout (Manual Label Rendering):**

For special cases like FormSwitch or FormCheckbox where you need custom label positioning:

```tsx
// Render labels manually inside the render function
<BaseFormField
  name="notifications"
  className="flex items-center justify-between rounded-lg border p-4"
  render={(field) => (
    <>
      <div>
        <FormLabel>Enable Notifications</FormLabel>
        <FormDescription>Get email updates</FormDescription>
      </div>
      <Switch {...field} />
    </>
  )}
/>
```

---
