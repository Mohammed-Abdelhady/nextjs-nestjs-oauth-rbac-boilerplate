## Accessibility

All form components include:

- ✅ Semantic HTML (`label`, `input`, `select`, etc.)
- ✅ Proper `aria-*` attributes
- ✅ Keyboard navigation support
- ✅ Screen reader announcements
- ✅ Focus management
- ✅ Error state indicators

**Best Practices:**

1. Always provide a `label` prop
2. Use `description` for helpful context
3. Ensure proper tab order
4. Test with keyboard only
5. Test with screen readers

---

## Troubleshooting

### TypeScript Errors

**Problem:** Type inference not working

**Solution:** Ensure schema is defined outside component:

```tsx
// ❌ Bad
function MyForm() {
  const schema = z.object({ ... });

// ✅ Good
const schema = z.object({ ... });
function MyForm() {
```

---

### Form Not Submitting

**Problem:** Form doesn't submit on Enter key

**Solution:** Ensure button has `type="submit"`:

```tsx
<button type="submit">Submit</button>
```

---

### Validation Not Working

**Problem:** Fields not validating on blur

**Solution:** Check validation mode:

```tsx
const form = useFormWithValidation({
  schema,
  mode: 'onBlur', // or 'onChange', 'onSubmit'
});
```

---

### Field Not Registering

**Problem:** Field value not captured

**Solution:** Ensure `name` prop matches schema:

```tsx
const schema = z.object({
  email: zodEmail(), // ✅ name="email"
});

<FormInput name="email" /> // ✅ Matches schema
<FormInput name="emailAddress" /> // ❌ Doesn't match
```

---

## Additional Resources

- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [Shadcn UI Forms](https://ui.shadcn.com/docs/components/form)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
