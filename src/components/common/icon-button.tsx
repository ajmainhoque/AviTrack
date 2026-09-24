import type { ButtonHTMLAttributes, ReactNode } from "react";
export function IconButton({
  label,
  children,
  active,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}
