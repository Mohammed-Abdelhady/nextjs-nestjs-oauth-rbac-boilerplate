'use client';

import { Heading } from '@/components/design-system';
import { useEffect, useRef } from 'react';
import { LogIn } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';

interface AuthCompletionNoticeProps {
  title: string;
  message: string;
  href: string;
  actionLabel: string;
  testId: string;
  actionTestId: string;
}

// Focus the outcome when its form is removed, including for screen readers.
export function AuthCompletionNotice({
  title,
  message,
  href,
  actionLabel,
  testId,
  actionTestId,
}: AuthCompletionNoticeProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby={`${testId}-heading`}>
      <Heading
        level={1}
        variant="display"
        ref={headingRef}
        tabIndex={-1}
        id={`${testId}-heading`}
        aria-describedby={testId}
        className="text-center"
      >
        {title}
      </Heading>
      <p id={testId} role="status" data-testid={testId} className="mt-4 max-w-xs text-center">
        {message}
      </p>
      <IconLinkButton href={href} icon={LogIn} testId={actionTestId} className="mt-4">
        {actionLabel}
      </IconLinkButton>
    </section>
  );
}
