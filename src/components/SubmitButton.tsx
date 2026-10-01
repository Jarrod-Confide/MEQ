"use client";

import { useFormStatus } from "react-dom";

/** Form submit button that shows a pending state while its server action runs. */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  );
}
