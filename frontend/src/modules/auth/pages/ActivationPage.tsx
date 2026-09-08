import { AuthLayout } from '../components/AuthLayout';
import { ActivationForm } from '../components/ActivationForm';
import { ActivationGuard } from '@/components/providers/ActivationGuard';

/**
 * ActivationPage component
 * Renders the email verification form within the auth layout
 * Protected by ActivationGuard to prevent authenticated users from accessing
 *
 * @example
 * // In Next.js route
 * export default function ActivationRoute() {
 *   return <ActivationPage />;
 * }
 */
export function ActivationPage() {
  return (
    <ActivationGuard>
      <AuthLayout>
        <ActivationForm />
      </AuthLayout>
    </ActivationGuard>
  );
}
