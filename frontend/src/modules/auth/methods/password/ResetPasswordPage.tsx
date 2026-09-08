import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { ResetPasswordForm } from './ResetPasswordForm';

/**
 * ResetPasswordPage component
 * Renders the password reset form within the auth layout
 *
 * @example
 * // In Next.js route
 * export default function ResetPasswordRoute() {
 *   return <ResetPasswordPage />;
 * }
 */
export function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
