import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { EMOJI_CATEGORIES } from './emoji';
import { ToolbarButton } from './ToolbarButton';

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {EMOJI_CATEGORIES.map((category) => (
        <div key={category.key}>
          <p className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t(category.label)}
          </p>
          <div className="grid grid-cols-10 gap-0.5">
            {category.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                // The editor's selection must survive the click, so the button
                // never takes focus — same rule as every toolbar control.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-accent"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Popover on desktop, bottom sheet on mobile.
 *
 * The mobile branch is a sheet rather than a popover because a popover anchored
 * to a toolbar button gets shoved around by the on-screen keyboard, which is
 * open the whole time the vendor is writing.
 */
export function EmojiPicker({ onPick, disabled }: EmojiPickerProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const pick = (emoji: string) => {
    onPick(emoji);
    if (isMobile) setOpen(false);
  };

  if (isMobile) {
    return (
      <>
        <ToolbarButton
          label={t('products.editor.toolbar.emoji')}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Smile />
        </ToolbarButton>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className={cn('flex h-[60dvh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]')}>
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{t('products.editor.emoji.title')}</SheetTitle>
            </SheetHeader>
            <SheetBody className="p-4">
              <EmojiGrid onPick={pick} />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label={t('products.editor.toolbar.emoji')} disabled={disabled}>
          <Smile />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[22rem] max-h-80 overflow-y-auto p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiGrid onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}
