import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useIsMobile } from '@/hooks/use-mobile';
import { responsiveSheetProps } from '@/components/ui/responsive-sheet';
import { useTranslation } from '@/i18n';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I update my payment method?',
    a: 'Go to Settings > Billing to manage your payment methods and subscription plan.',
  },
  {
    q: 'Can I manage multiple stores?',
    a: 'Yes, you can manage multiple stores from a single account. Use the store switcher in the top left.',
  },
  {
    q: 'How are shipping rates calculated?',
    a: 'Shipping rates can be configured in Settings > Shipping per region or weight.',
  },
  {
    q: 'When do I get paid?',
    a: 'Payouts are processed weekly. You can view your payout schedule in the Finance section.',
  },
];

interface FaqSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * {t('tickets.faq.title')}, shown as a right-side sheet on desktop and a
 * bottom sheet on mobile (matching CreateTicketSheet / TicketDetailSheet).
 */
export function FaqSheet({ open, onOpenChange }: FaqSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const sheetProps = responsiveSheetProps(isMobile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheetProps.side} className={sheetProps.className}>
        <SheetHeader>
          <SheetTitle>{t('tickets.faq.title')}</SheetTitle>
          <SheetDescription>
            {t('tickets.faq.description')}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="px-4 pb-4">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
