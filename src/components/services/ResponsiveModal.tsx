import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Scrollable body content. */
  children: React.ReactNode;
  /** Pinned footer (action buttons). Optional. */
  footer?: React.ReactNode;
  /** Desktop popup max-width utility (e.g. `sm:max-w-2xl`). */
  desktopClassName?: string;
  /** Mobile sheet panel override — e.g. `h-auto max-h-[92dvh]` for a short form. */
  mobileClassName?: string;
  /** Footer row override, e.g. `flex-col-reverse` to float the primary action. */
  footerClassName?: string;
  /** When true the modal can't be dismissed by overlay/escape (e.g. while saving). */
  disableClose?: boolean;
}

/**
 * Centered popup on desktop, bottom sheet on mobile — the shared shell for the
 * service create / manage / availability modals. Header and footer stay pinned
 * while the body scrolls, so tabbed forms keep their actions in view.
 */
export function ResponsiveModal({
  open, onOpenChange, title, description, children, footer,
  desktopClassName = 'sm:max-w-lg', mobileClassName, footerClassName, disableClose,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = (next: boolean) => {
    if (!next && disableClose) return;
    onOpenChange(next);
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('flex h-[92vh] flex-col gap-0 rounded-t-2xl p-0', mobileClassName)}
          onInteractOutside={(e) => disableClose && e.preventDefault()}
          onEscapeKeyDown={(e) => disableClose && e.preventDefault()}
        >
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <SheetBody className="p-4">{children}</SheetBody>
          {footer && (
            <SheetFooter className={cn('border-t pb-[calc(1rem+env(safe-area-inset-bottom))]', footerClassName)}>
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('flex max-h-[85vh] flex-col gap-0 p-0', desktopClassName)}
        onInteractOutside={(e) => disableClose && e.preventDefault()}
        onEscapeKeyDown={(e) => disableClose && e.preventDefault()}
      >
        <DialogHeader className="border-b p-4 pr-12 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div
            className={cn(
              'flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end',
              footerClassName,
            )}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
