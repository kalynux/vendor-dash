import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageBack } from '@/hooks/use-page-back';
import { cn } from '@/lib/utils';

interface PageBackButtonProps {
  /** Where to go when there's no in-app history to pop back to. */
  fallbackPath: string;
  /** Always go to `fallbackPath` instead of popping history. See `usePageBack`. */
  alwaysFallback?: boolean;
  label?: string;
  className?: string;
}

/**
 * Back button that pops the in-app history when possible, otherwise navigates
 * to a sensible parent route. Used on detail/wizard pages (e.g. Product edit)
 * so the user isn't forced to use the sidebar to return to the list.
 *
 * This is the wide-screen form — a labelled link sitting *above* the page title.
 * On a handset the same navigation is an arrow to the *left* of the title, in
 * `MobilePageHeader`; both go through `usePageBack`.
 */
export function PageBackButton({
  fallbackPath,
  alwaysFallback = false,
  label = 'Back',
  className,
}: PageBackButtonProps) {
  const goBack = usePageBack({ fallbackPath, alwaysFallback });

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={goBack}
      className={cn('gap-1.5 -ml-2 text-muted-foreground', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
