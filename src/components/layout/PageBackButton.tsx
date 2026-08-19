import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageBackButtonProps {
  /** Where to go when there's no in-app history to pop back to. */
  fallbackPath: string;
  /**
   * Always go to `fallbackPath` instead of popping history.
   *
   * For pages that link *out* to a page which links back here — the editors and
   * the storefront preview do exactly that — popping is a trap: it returns the
   * vendor to the preview they just came from instead of to the list, and the
   * two bounce off each other. Where the parent is unambiguous (and the label
   * already names it), going there directly is both correct and predictable.
   */
  alwaysFallback?: boolean;
  label?: string;
  className?: string;
}

/**
 * Back button that pops the in-app history when possible, otherwise navigates
 * to a sensible parent route. Used on detail/wizard pages (e.g. Product edit)
 * so the user isn't forced to use the sidebar to return to the list.
 */
export function PageBackButton({
  fallbackPath,
  alwaysFallback = false,
  label = 'Back',
  className,
}: PageBackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!alwaysFallback && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn('gap-1.5 -ml-2 text-muted-foreground', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
