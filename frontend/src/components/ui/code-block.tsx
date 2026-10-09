interface CodeBlockProps {
  children: string;
  testId?: string;
}

export function CodeBlock({ children, testId }: CodeBlockProps) {
  return (
    <pre
      dir="ltr"
      data-testid={testId}
      className="overflow-x-auto rounded-md bg-muted p-4 text-xs text-start"
    >
      <code>{children}</code>
    </pre>
  );
}
