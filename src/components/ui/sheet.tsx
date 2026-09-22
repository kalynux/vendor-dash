import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        // A bottom sheet is the phone layout, and Radix's default — focus the
        // first focusable element — usually lands on a text field there: the
        // media picker's search box, the first input of a form. That raises the
        // keyboard the moment the sheet opens, and the sheet, sized in `dvh`,
        // shrinks to the half of the screen the keyboard leaves. Focus the sheet
        // itself instead, which keeps focus inside the dialog for screen readers
        // and leaves the keyboard down until a field is tapped. A field that
        // really should take focus on open still can: an `autoFocus` input is
        // focused before this runs, and Radix then skips its own pass.
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented || side !== "bottom") return
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
        }}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm rounded-l-[15px] overflow-hidden",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm rounded-r-[15px] overflow-hidden",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b rounded-b-[15px] overflow-hidden",
          // No bottom safe-area inset here, deliberately. `cn` is tailwind-merge
          // and `className` merges last, so a `pb-*` in this base string is
          // STRIPPED by any call site passing `p-0` — which most bottom sheets do
          // for a pinned header/footer. It would silently no-op on exactly the
          // sheets that need it. The inset is applied per surface instead: via
          // `responsiveSheetProps` (@/components/ui/responsive-sheet) or, for a
          // hardcoded side="bottom", a `pb-[env(safe-area-inset-bottom)]` written
          // after the padding reset. See also FilterSheet and ResponsiveModal.
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t rounded-t-[15px] overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
        {/* Painted box is the bare 16px icon. `tap-target` takes the touchable
            region to 44px; `absolute` outranks the utility's zero-specificity
            `position`, so the icon does not move. Call sites that pull the
            close in to `right-3` lose ~2px of halo to the content's
            `overflow-hidden` — still 42px, against 16px before. */}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none tap-target">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

// Scrollable region for a fixed-header sheet. Pair with a non-scrolling
// SheetContent (the default) so SheetHeader and the close button stay pinned
// while only this body scrolls.
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
