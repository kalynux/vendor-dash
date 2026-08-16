import { Fragment, useMemo } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  buildProductShareMessage,
  escapeTelegramHtml,
  isEmptyDoc,
  toTelegramHtml,
  type RichDoc,
} from '@/lib/richtext';
import { parseTelegramPreview, parseWhatsAppPreview, type PreviewNode } from './preview';

interface ChatPreviewProps {
  doc: RichDoc;
  /** Rendered as the first bold line, the way the share composer sends it. */
  title?: string;
  price?: string | null;
  /** Product URL, previewed exactly where the share composer puts it. */
  url?: string | null;
  /**
   * Which Telegram transport is being previewed.
   *
   * `'html'` — a Bot API `sendMessage` with `parse_mode: 'HTML'`, which keeps
   * every mark. This is what the editor previews, because it is what the
   * platform is capable of and what the backend will send.
   *
   * `'plain'` — a `t.me/share/url` deep link, which renders its `text` verbatim
   * and therefore drops every mark. The share dialog previews this, because
   * showing bold text that arrives unbolded would make the preview a lie in the
   * one place it is used to decide whether to press send.
   */
  telegramFormat?: 'html' | 'plain';
  onChannelChange?: (channel: 'whatsapp' | 'telegram') => void;
  className?: string;
}

/**
 * Platform palettes, taken from the clients themselves.
 *
 * Hard-coded hex rather than theme tokens, deliberately: this panel is a picture
 * of somebody else's app. Tinting it with Wi-Mall's palette would make it a
 * prettier component and a worse preview — the point is for the vendor to
 * recognise the surface their customer will see.
 *
 * Each palette carries its own dark variant because the dashboard has a dark
 * mode and a preview that stays blinding white in it reads as a rendering bug.
 */
const SKINS = {
  whatsapp: {
    wallpaper: 'bg-[#efeae2] dark:bg-[#0b141a]',
    bubble: 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]',
    tail: 'border-l-[#d9fdd3] dark:border-l-[#005c4b]',
    meta: 'text-[#667781] dark:text-[#8696a0]',
    link: 'text-[#027eb5] dark:text-[#53bdeb]',
  },
  telegram: {
    wallpaper: 'bg-[#dfe7ec] dark:bg-[#17212b]',
    bubble: 'bg-[#effdde] text-[#0f0f0f] dark:bg-[#2b5278] dark:text-[#ffffff]',
    tail: 'border-l-[#effdde] dark:border-l-[#2b5278]',
    meta: 'text-[#6a8a63] dark:text-[#8ab4f8]',
    link: 'text-[#168acd] dark:text-[#6ab3f3]',
  },
} as const;

type Channel = keyof typeof SKINS;

function Rendered({ nodes, linkClass }: { nodes: PreviewNode[]; linkClass: string }) {
  return (
    <>
      {nodes.map((node, i) => {
        // Newlines are real line breaks in a chat bubble, not collapsed
        // whitespace — rendering them through `white-space: pre-wrap` alone
        // would be enough, but splitting keeps marks from spanning a break the
        // way the clients do.
        const lines = node.text.split('\n');
        const content = lines.map((line, li) => (
          <Fragment key={li}>
            {li > 0 && <br />}
            {line}
          </Fragment>
        ));

        let el = <>{content}</>;
        if (node.strike) el = <s>{el}</s>;
        if (node.italic) el = <em>{el}</em>;
        if (node.bold) el = <strong className="font-semibold">{el}</strong>;
        if (node.href) el = <span className={cn('underline underline-offset-2', linkClass)}>{el}</span>;

        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

function Bubble({ channel, nodes }: { channel: Channel; nodes: PreviewNode[] }) {
  const skin = SKINS[channel];

  return (
    <div className={cn('flex min-h-[7rem] justify-end p-3 sm:p-4', skin.wallpaper)}>
      <div className="relative max-w-[85%]">
        <div
          className={cn(
            'rounded-lg rounded-tr-none px-2.5 py-1.5 text-[13.5px] leading-[1.45] shadow-sm',
            'whitespace-pre-wrap break-words',
            skin.bubble,
          )}
        >
          <Rendered nodes={nodes} linkClass={skin.link} />
          <span className={cn('float-right ml-2 mt-1 flex items-center gap-0.5 text-[10px]', skin.meta)}>
            12:45
            {channel === 'whatsapp' ? (
              <CheckCheck className="size-3 text-[#53bdeb]" />
            ) : (
              <Check className="size-3" />
            )}
          </span>
        </div>
        {/* The tail. Small detail, but it is most of what makes the panel read as
            a chat rather than as another bordered box. */}
        <div
          className={cn(
            'absolute right-[-6px] top-0 h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent',
            skin.tail,
          )}
        />
      </div>
    </div>
  );
}

/**
 * Live preview of the outgoing message, per channel.
 *
 * Both tabs are rendered from the *formatted wire string*, not from the
 * document — see `preview.ts`. The two therefore disagree wherever the platforms
 * genuinely disagree, which is the whole reason this is a tabbed preview instead
 * of one styled box.
 */
export function ChatPreview({
  doc,
  title,
  price,
  url,
  telegramFormat = 'html',
  onChannelChange,
  className,
}: ChatPreviewProps) {
  const { t } = useTranslation();

  const nodes = useMemo(() => {
    if (isEmptyDoc(doc) && !title?.trim() && !price) {
      const placeholder = [{ text: t('products.editor.preview.empty') }];
      return { wa: placeholder, tg: placeholder };
    }

    const input = { title: title?.trim() ?? '', price, doc, url };

    // WhatsApp is previewed by parsing the *exact* string the share composer
    // produces, so the bubble and the outgoing message cannot diverge.
    const wa = parseWhatsAppPreview(buildProductShareMessage(input, 'whatsapp'));

    if (telegramFormat === 'plain') {
      return { wa, tg: [{ text: buildProductShareMessage(input, 'telegram') }] };
    }

    // The rich Telegram transport composes the same parts as HTML.
    const parts: string[] = [];
    if (input.title) parts.push(`<b>${escapeTelegramHtml(input.title)}</b>`);
    if (price) parts.push(escapeTelegramHtml(price));
    if (!isEmptyDoc(doc)) parts.push(toTelegramHtml(doc));
    if (url) parts.push(`<a href="${escapeTelegramHtml(url)}">${escapeTelegramHtml(url)}</a>`);

    return { wa, tg: parseTelegramPreview(parts.join('\n\n')) };
  }, [doc, title, price, url, telegramFormat, t]);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <Tabs
        defaultValue="whatsapp"
        onValueChange={(value) => onChannelChange?.(value as Channel)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
          <span className="pl-1 text-xs font-medium text-muted-foreground">
            {t('products.editor.preview.label')}
          </span>
          <TabsList className="h-7">
            <TabsTrigger value="whatsapp" className="h-6 px-2.5 text-xs">
              {t('products.editor.preview.whatsapp')}
            </TabsTrigger>
            <TabsTrigger value="telegram" className="h-6 px-2.5 text-xs">
              {t('products.editor.preview.telegram')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="whatsapp" className="mt-0">
          <Bubble channel="whatsapp" nodes={nodes.wa} />
        </TabsContent>
        <TabsContent value="telegram" className="mt-0">
          <Bubble channel="telegram" nodes={nodes.tg} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
