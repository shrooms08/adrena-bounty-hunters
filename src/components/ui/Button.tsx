"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type ButtonVariant = "execute" | "navigate" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  action?: string;
  bracketPrefix?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonElementProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | "href"> & {
    href?: undefined;
  };

type AnchorElementProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
    href: string;
    disabled?: boolean;
  };

export type ButtonProps = ButtonElementProps | AnchorElementProps;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  execute: clsx(
    "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500",
    "hover:opacity-90",
    "shadow-md hover:shadow-lg",
    "text-white font-mono",
    "rounded-md",
    "transition duration-300",
  ),
  navigate: clsx(
    "bg-gradient-to-r from-[#0284c7] via-[#1e40af] to-[#1a2a6a]",
    "hover:opacity-90",
    "shadow-md hover:shadow-lg",
    "text-white font-mono",
    "rounded-md",
    "transition duration-300",
  ),
  outline: clsx(
    "bg-transparent",
    "border border-white/20",
    "hover:bg-white/5",
    "text-white font-mono",
    "rounded-md",
    "transition duration-300",
  ),
  ghost: clsx(
    "bg-transparent",
    "hover:bg-white/5",
    "text-txtfade hover:text-white",
    "font-mono",
    "rounded-md",
    "transition duration-300",
  ),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-6 py-2 text-sm",
  lg: "px-8 py-3 text-base",
};

const FOCUS_CLASSES =
  "focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none";

const DISABLED_CLASSES = "opacity-50 cursor-not-allowed pointer-events-none";

const GRADIENT_VARIANTS: ReadonlySet<ButtonVariant> = new Set([
  "execute",
  "navigate",
]);

let warnedNonStringBracketPrefix = false;

function renderBracketedChildren(
  children: ReactNode,
  action: string | undefined,
  bracketPrefix: boolean,
): ReactNode {
  if (!bracketPrefix || !action) return children;

  if (typeof children !== "string") {
    if (process.env.NODE_ENV !== "production" && !warnedNonStringBracketPrefix) {
      warnedNonStringBracketPrefix = true;
      console.warn(
        "[Button] bracketPrefix skipped: children is not a plain string. Pass `bracketPrefix={false}` to silence.",
      );
    }
    return children;
  }

  const trimmed = children.trimStart();
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return children;
  }

  const actionFirstChar = action.trim().charAt(0).toLowerCase();
  const childFirstChar = trimmed.charAt(0).toLowerCase();
  if (!actionFirstChar || actionFirstChar !== childFirstChar) {
    return children;
  }

  const leadingWhitespace = children.slice(
    0,
    children.length - trimmed.length,
  );
  const head = trimmed.charAt(0);
  const tail = trimmed.slice(1);

  return (
    <>
      {leadingWhitespace}[{head}]{tail}
    </>
  );
}

function Spinner({ size }: { size: ButtonSize }) {
  const px = size === "sm" ? 12 : size === "lg" ? 18 : 14;
  return (
    <svg
      aria-hidden="true"
      className="animate-spin"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}

export function Button(props: ButtonProps) {
  const {
    variant = "execute",
    size = "md",
    action,
    bracketPrefix = true,
    loading = false,
    fullWidth,
    className,
    children,
    ...rest
  } = props;

  const defaultFullWidth = GRADIENT_VARIANTS.has(variant);
  const widthClass =
    (fullWidth ?? defaultFullWidth) ? "w-full" : "w-auto";

  const disabled =
    loading ||
    (rest as { disabled?: boolean }).disabled === true;

  const classes = clsx(
    "inline-flex items-center justify-center gap-2 select-none",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    widthClass,
    FOCUS_CLASSES,
    disabled && DISABLED_CLASSES,
    className,
  );

  const content = (
    <>
      {loading && (
        <>
          <Spinner size={size} />
          <span className="sr-only">Loading</span>
        </>
      )}
      <span className={loading ? "opacity-70" : undefined}>
        {renderBracketedChildren(children, action, bracketPrefix)}
      </span>
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, disabled: _omitDisabled, ...anchorRest } =
      rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
        disabled?: boolean;
      };
    void _omitDisabled;
    const external = isExternalHref(href);

    if (disabled) {
      return (
        <a
          {...anchorRest}
          role="button"
          aria-disabled="true"
          aria-busy={loading || undefined}
          className={classes}
        >
          {content}
        </a>
      );
    }

    if (external) {
      return (
        <a
          {...anchorRest}
          href={href}
          target={anchorRest.target ?? "_blank"}
          rel={anchorRest.rel ?? "noopener noreferrer"}
          aria-busy={loading || undefined}
          className={classes}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        {...(anchorRest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={href}
        aria-busy={loading || undefined}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={buttonRest.type ?? "button"}
      {...buttonRest}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
