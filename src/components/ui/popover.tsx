"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import {
  MobileSheetHandle,
  MobileSheetPanel,
  MobileSheetPortalScrim,
} from "@/components/ui/mobile-sheet"
import {
  mobileSheetScrollArea,
  mobileSheetShell,
} from "@/components/ui/mobile-sheet.styles"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  asSheet = true,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  /**
   * Below `md`, become a bottom sheet. On by default — a popup anchored to a
   * trigger is a pointer idiom, and the things this app puts in popovers
   * (country pickers, calendars, agency browsers) are all easier to hit as a
   * sheet.
   *
   * Set `false` for a popover that is genuinely *attached* to its trigger and
   * loses its meaning detached from it. Nothing in the app needs that today; the
   * prop exists so the next thing that does has an answer other than a fork.
   */
  asSheet?: boolean
}) {
  return (
    <>
      {/* ⚠ Its own portal. `Popover.Portal` is `<Portal asChild>` and takes
          exactly one child — putting the scrim beside the content throws
          `React.Children.only` and takes the route down. A popover is
          non-modal, so unlike Select and DropdownMenu the scrim here has to be
          a real surface that absorbs the press; see `MobileSheetPortalScrim`. */}
      {asSheet && (
        <PopoverPrimitive.Portal>
          <MobileSheetPortalScrim />
        </PopoverPrimitive.Portal>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="popover-content"
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[side=bottom]:slide-in-from-top-2 md:data-[side=left]:slide-in-from-right-2 md:data-[side=right]:slide-in-from-left-2 md:data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
            className,
            asSheet && mobileSheetShell
          )}
          {...props}
        >
          {asSheet ? (
            <MobileSheetPanel>
              <MobileSheetHandle />
              {/*
                ⚠ `className` is applied here as well as on the shell, and that
                is not a duplicate.

                Unlike a Select or a menu — whose callers only ever pass a width
                — popover callers pass *layout*: `space-y-2`, `flex`, `p-0` for a
                command list. Wrapping the children moves them one level down, so
                those classes would land on this wrapper and stop reaching the
                content they were written for.

                It cannot double up. On desktop this element is
                `display: contents` and every class on it is inert; on mobile the
                shell's `!important` overrides have already stripped its padding,
                border, ground and width, so what survives here is exactly the
                layout the caller asked for. The width reset below is the one
                thing that has to be undone — `w-64` inside a full-width sheet is
                not what anyone meant.
              */}
              <div
                className={cn(
                  className,
                  "max-md:!w-full max-md:!max-w-full",
                  mobileSheetScrollArea,
                )}
              >
                {children}
              </div>
            </MobileSheetPanel>
          ) : (
            children
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
