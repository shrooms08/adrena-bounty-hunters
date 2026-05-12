"use client";

import { clsx } from "clsx";
import Link from "next/link";
import {
  createElement,
  type AnchorHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

export type CardVariant = "default" | "nested" | "disabled" | "bare";
export type CardPadding = "none" | "sm" | "md" | "lg";

type ElementTag = keyof React.JSX.IntrinsicElements;

export interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  href?: string;
  onClick?: (e: MouseEvent) => void;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: ElementTag;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "bg-secondary border border-bcolor rounded-lg",
  nested: "bg-gray-200 border border-bcolor rounded-lg",
  disabled: "bg-third border border-bcolor rounded-lg opacity-60",
  bare: "",
};

const HOVER_CLASSES: Record<CardVariant, string> = {
  default: "hover:bg-gray-200",
  nested: "hover:bg-inputcolor",
  disabled: "",
  bare: "hover:bg-white/5",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const INTERACTIVE_CLASSES =
  "cursor-pointer transition duration-300 ease-smooth focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none";

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}

export function Card({
  variant = "default",
  padding = "md",
  interactive,
  href,
  onClick,
  title,
  action,
  children,
  className,
  as,
}: CardProps) {
  const isDisabled = variant === "disabled";
  const autoInteractive =
    !isDisabled && (interactive ?? (href !== undefined || onClick !== undefined));

  const classes = clsx(
    VARIANT_CLASSES[variant],
    PADDING_CLASSES[padding],
    autoInteractive && INTERACTIVE_CLASSES,
    autoInteractive && HOVER_CLASSES[variant],
    className,
  );

  const body = (
    <>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title ? (
            <h3 className="text-white font-semibold text-lg">{title}</h3>
          ) : (
            <span />
          )}
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </>
  );

  if (href !== undefined && !isDisabled) {
    const external = isExternalHref(href);
    const anchorProps: AnchorHTMLAttributes<HTMLAnchorElement> = {
      className: classes,
    };
    if (external) {
      return (
        <a
          {...anchorProps}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {body}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick !== undefined && !isDisabled) {
    if (as === undefined) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={clsx(classes, "text-left w-full")}
        >
          {body}
        </button>
      );
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(e as unknown as MouseEvent);
      }
    };
    return createElement(
      as,
      {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
        className: classes,
      },
      body,
    );
  }

  return createElement(as ?? "div", { className: classes }, body);
}
