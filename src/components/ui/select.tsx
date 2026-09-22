import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  MobileSheetHandle,
  MobileSheetPanel,
  MobileSheetScrim,
} from "@/components/ui/mobile-sheet"
import {
  mobileSheetItem,
  mobileSheetScrollArea,
  mobileSheetShell,
} from "@/components/ui/mobile-sheet.styles"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&>[data-slot=select-value]]:min-w-0 [&>[data-slot=select-value]]:truncate [&>[data-slot=select-value]]:text-left [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    // ⚠ The portal takes exactly one child. `Select.Portal` is
    // `<Portal asChild>`, and a second element there throws
    // `React.Children.only` — which is why the scrim is inside the content.
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-mobile-sheet=""
        className={cn(
          // The zoom/slide entrance is a *popup* gesture, so it is md-and-up
          // only; below that the panel slides up from the bottom edge instead
          // (see mobile-sheet.tsx).
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[side=bottom]:slide-in-from-top-2 md:data-[side=left]:slide-in-from-right-2 md:data-[side=right]:slide-in-from-left-2 md:data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] origin-[var(--radix-select-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "md:data-[side=bottom]:translate-y-1 md:data-[side=left]:-translate-x-1 md:data-[side=right]:translate-x-1 md:data-[side=top]:-translate-y-1",
          className,
          // Last, so its `!important` overrides win over anything a call site
          // passed for the desktop popup.
          mobileSheetShell
        )}
        position={position}
        align={align}
        {...props}
      >
        {/* Inside the content, and transparent to the pointer, so a press on it
            is still an outside-press. See `MobileSheetScrim`. */}
        <MobileSheetScrim />
        <MobileSheetPanel>
          <MobileSheetHandle />
          {/* Radix's own scroll arrows are a pointer affordance — on a sheet the
              list is scrolled with a thumb and they would just eat two rows. */}
          <SelectScrollUpButton className="max-md:hidden" />
          <SelectPrimitive.Viewport
            className={cn(
              "p-1",
              position === "popper" &&
                "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
              // ⚠ `!h-auto` — `position="popper"` pins the viewport to the
              // trigger's height, which on a sheet is a one-row-tall list.
              "max-md:!h-auto max-md:p-2",
              mobileSheetScrollArea
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton className="max-md:hidden" />
        </MobileSheetPanel>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs",
        "max-md:px-3 max-md:pt-3 max-md:pb-1.5 max-md:text-[11px] max-md:font-semibold max-md:uppercase max-md:tracking-wide",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "md:focus:bg-accent md:focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:gap-2",
        // Thumb-sized rows in the sheet, and the checked state carried by a
        // tinted row as well as the tick — on a phone the tick alone is a long
        // way from the text the eye is on.
        //
        // The focus tint is desktop-only (`md:focus:` above): Radix focuses the
        // first row when a Select opens with nothing chosen, and on a sheet that
        // tinted row reads as a choice already made. Keyboard focus and the
        // press itself still show.
        mobileSheetItem,
        "max-md:pr-11 max-md:data-[state=checked]:bg-accent/60 max-md:data-[state=checked]:font-medium",
        "max-md:focus-visible:bg-accent max-md:active:bg-accent",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center max-md:right-3.5"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
