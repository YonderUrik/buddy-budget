"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AuthFieldProps extends Omit<React.ComponentProps<typeof Input>, "id"> {
  id: string;
  label: string;
  /** Line under the field (hint or rule), already translated. */
  hint?: string;
}

/** One labelled field of the sign-in pages, at the size of the sign-in buttons. */
export function AuthField({ id, label, hint, className, ...input }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className={className ?? "h-11 bg-card px-3.5 text-base"} aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-text-3">
          {hint}
        </p>
      )}
    </div>
  );
}
