"use client";
import { useActionState } from "react";
import { formAction } from "@/lib/actions";
export function ActionForm({
  action,
  children,
  label = "Save",
  className = "",
  confirm,
}: {
  action: string;
  children?: React.ReactNode;
  label?: string;
  className?: string;
  confirm?: string;
}) {
  const [state, submit, pending] = useActionState(formAction, {});
  return (
    <form
      action={submit}
      className={`form ${className}`}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="action" value={action} />
      {children}
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="feedback success" role="status">
          {state.success}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Working..." : label}
      </button>
    </form>
  );
}
