interface AuthLayoutProps {
  readonly children: React.ReactNode;
}

/**
 * AuthLayout component for authentication pages
 * Split layout design matching original - form on left, illustration on right
 *
 * @example
 * <AuthLayout>
 *   <LoginForm />
 * </AuthLayout>
 */
export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center">
      <div className="max-w-screen-xl m-0 sm:m-20 bg-card shadow sm:rounded-lg flex justify-center flex-1">
        {/* Start Side - Form Content */}
        <div className="lg:w-1/2 xl:w-5/12 p-6 sm:p-12">{children}</div>

        {/* End Side - Illustration */}
        <div className="flex-1 bg-primary/10 text-center hidden lg:flex">
          <div
            className="m-12 xl:m-16 w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/login.svg)' }}
          ></div>
        </div>
      </div>
    </div>
  );
}
