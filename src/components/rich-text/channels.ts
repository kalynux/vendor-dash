import type { ShareChannel } from '@/lib/richtext';
import { TelegramMark, WhatsAppMark } from './ChannelMarks';

/**
 * Brand plates, hard-coded rather than themed — same reasoning as the chat
 * preview's wallpaper palettes. A WhatsApp button in Wi-Mall green is a worse
 * button: the colour *is* the recognition, and it is what lets the caption go
 * away on a narrow screen.
 *
 * Shared by the share dialog's send buttons and the preview's channel switch, so
 * the green a vendor taps to preview a message is the green they tap to send it.
 */
export const CHANNEL_BRAND: Record<
  ShareChannel,
  {
    Mark: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
    /** Solid brand background + hover + focus ring. Always paired with white text. */
    plate: string;
  }
> = {
  whatsapp: {
    Mark: WhatsAppMark,
    plate: 'bg-[#25D366] hover:bg-[#1da851] focus-visible:ring-[#25D366]/60',
  },
  telegram: {
    Mark: TelegramMark,
    plate: 'bg-[#229ED9] hover:bg-[#1b86b8] focus-visible:ring-[#229ED9]/60',
  },
};

/** Rendering order, so every channel switch in the app lists them the same way. */
export const CHANNEL_ORDER: readonly ShareChannel[] = ['whatsapp', 'telegram'] as const;
