/**
 * Copied / adapted from supabase/apps/studio/components/layouts/Scaffold.tsx
 * Copyright (c) Supabase contributors — Apache-2.0.
 * Adapted for NyaLife HMS (App Router); imports remapped to local ui-studio.
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/components/ui-studio";

export const MAX_WIDTH_CLASSES = "mx-auto w-full max-w-[1200px]";
export const PADDING_CLASSES = "px-4 lg:px-6 xl:px-10";
export const MAX_WIDTH_CLASSES_COLUMN = "min-w-[420px]";

/**
 * Controls the width of UI contents. Horizontal padding comes from the
 * dashboard shell layout so every page (Studio PageLayout or HMS PageHeader)
 * shares one gutter — avoids double-padding.
 */
export const ScaffoldContainer = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    bottomPadding?: boolean;
    size?: "small" | "default" | "large" | "full";
    /** When true, also apply Studio horizontal padding (default false — shell pads). */
    padded?: boolean;
  }
>(({ className, bottomPadding, size = "default", padded = false, ...props }, ref) => {
  const maxWidthClass = {
    small: "max-w-[768px]",
    default: "max-w-[1200px]",
    large: "max-w-[1600px]",
    full: "max-w-none",
  }[size];

  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        "mx-auto w-full",
        maxWidthClass,
        padded && PADDING_CLASSES,
        bottomPadding && "pb-16",
        className,
      )}
    />
  );
});

export const ScaffoldHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <header {...props} ref={ref} className={cn("w-full flex-col gap-3 py-6", className)} />
    );
  },
);

export const ScaffoldTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h1
        ref={ref}
        {...props}
        className={cn(
          "font-heading text-2xl font-semibold tracking-tight text-foreground",
          className,
        )}
      />
    );
  },
);

export const ScaffoldDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return <p ref={ref} {...props} className={cn("text-sm text-foreground-light", className)} />;
});

export const ScaffoldSection = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { isFullWidth?: boolean; topPadding?: boolean }
>(({ className, isFullWidth, ...props }, ref) => {
  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        "flex flex-col py-6 first:pt-8",
        isFullWidth ? "w-full" : "gap-3 lg:grid lg:grid-cols-12",
        className,
      )}
    />
  );
});

export const ScaffoldDivider = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} {...props} className={cn("h-px w-full shrink-0 bg-border", className)} />;
  },
);

export const ScaffoldSectionTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return <h3 ref={ref} {...props} className={cn("text-xl text-foreground", className)} />;
});

export const ScaffoldSectionDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return <p ref={ref} {...props} className={cn("text-sm text-foreground-light", className)} />;
});

export const ScaffoldSectionDetail = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { title?: ReactNode }
>(({ className, children, title, ...props }, ref) => {
  return (
    <div ref={ref} {...props} className={cn("col-span-4 text-sm xl:col-span-5", className)}>
      {title && <h2 className="mb-2 font-medium text-foreground">{title}</h2>}
      {children}
    </div>
  );
});

export const ScaffoldSectionContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("col-span-8 flex flex-col gap-6 xl:col-span-7", className)}
      />
    );
  },
);

export const ScaffoldFilterAndContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} {...props} className={cn("flex flex-col items-center gap-3", className)} />
    );
  },
);

export const ScaffoldActionsContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} {...props} className={cn("flex w-full items-center", className)} />;
  },
);

export const ScaffoldActionsGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} {...props} className={cn("flex flex-row gap-3", className)} />;
  },
);

export const ScaffoldColumn = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("flex flex-col gap-3", MAX_WIDTH_CLASSES_COLUMN, className)}
      />
    );
  },
);

ScaffoldHeader.displayName = "ScaffoldHeader";
ScaffoldTitle.displayName = "ScaffoldTitle";
ScaffoldDescription.displayName = "ScaffoldDescription";
ScaffoldContainer.displayName = "ScaffoldContainer";
ScaffoldDivider.displayName = "ScaffoldDivider";
ScaffoldSection.displayName = "ScaffoldSection";
ScaffoldColumn.displayName = "ScaffoldColumn";
ScaffoldSectionDetail.displayName = "ScaffoldSectionDetail";
ScaffoldSectionContent.displayName = "ScaffoldSectionContent";
ScaffoldFilterAndContent.displayName = "ScaffoldFilterAndContent";
ScaffoldActionsContainer.displayName = "ScaffoldActionsContainer";
ScaffoldActionsGroup.displayName = "ScaffoldActionsGroup";
ScaffoldSectionTitle.displayName = "ScaffoldSectionTitle";
ScaffoldSectionDescription.displayName = "ScaffoldSectionDescription";
