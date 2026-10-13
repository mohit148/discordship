import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-blossom-500 text-white hover:bg-blossom-600 active:bg-blossom-600",
  secondary: "bg-white border border-border text-ink hover:border-lavender-200 hover:bg-cream-100",
  ghost: "text-ink-soft shadow-none hover:bg-cream-200",
  danger: "bg-white border border-blossom-100 text-blossom-600 hover:border-blossom-400 hover:bg-blossom-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

export function Button({ variant = "primary", className = "", href, children, ...props }: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium shadow-softer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`;

  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
