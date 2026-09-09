'use client';

import { useCallback, useState } from 'react';

export interface DialogTarget<T> {
  /** What the dialog is about. Held past the close so the text does not
   *  empty out while the dialog fades. */
  target: T | null;
  isOpen: boolean;
  open: (value: T) => void;
  close: () => void;
}

/** A dialog that acts on one row of a list, remembering which row. */
export function useDialogTarget<T>(): DialogTarget<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((value: T) => {
    setTarget(value);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return { target, isOpen, open, close };
}
