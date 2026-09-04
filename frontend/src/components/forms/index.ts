/**
 * Form Components
 *
 * Reusable form field components that wrap Shadcn UI with React Hook Form integration.
 * All components support label, description, and automatic error messages.
 *
 * @module components/forms
 */

export { BaseFormField, type BaseFormFieldProps } from './BaseFormField';
export { FormInput, type FormInputProps } from './FormInput';
export { FormPassword, type FormPasswordProps } from './FormPassword';
export {
  FormSelect,
  type FormSelectProps,
  type SelectOption,
  type SelectOptionGroup,
} from './FormSelect';
export { FormTextarea, type FormTextareaProps } from './FormTextarea';
export { FormCheckbox, type FormCheckboxProps, type CheckboxOption } from './FormCheckbox';
export { FormRadio, type FormRadioProps, type RadioOption } from './FormRadio';
export { FormSwitch, type FormSwitchProps } from './FormSwitch';
export { FormRootError, type FormRootErrorProps } from './FormRootError';
export { SubmitButton, type SubmitButtonProps } from './SubmitButton';
export {
  PasswordVisibilityToggle,
  type PasswordVisibilityToggleProps,
} from './PasswordVisibilityToggle';
export { PasswordRules, type PasswordRulesProps } from './PasswordRules';
