import { cloneElement, type ReactNode } from 'react';

import { useI18n } from './I18nContext';
import type { TranslationKey } from './keys';
import type { TranslateParams } from './types';

/**
 * A translated sentence with React nodes inside it.
 *
 * Splitting a sentence into "text + <strong> + text" hardcodes English word
 * order and breaks in any language that puts the emphasised part elsewhere.
 * Instead, keep the whole sentence in the catalog with numbered slots and
 * supply the nodes:
 *
 * ```tsx
 * // catalog: "Deleting {{name}} also removes <0>every variant</0>."
 * <Trans i18nKey="products.deleteWarning"
 *        params={{ name: product.title }}
 *        components={[<strong />]} />
 * ```
 *
 * Slots are `<0>…</0>`, `<1>…</1>`, … indexing into `components`. Anything
 * without slots renders as plain text, so this is safe to use everywhere.
 */
export interface TransProps {
    i18nKey: TranslationKey;
    params?: TranslateParams;
    /** Elements cloned around each numbered slot, in index order. */
    components?: React.ReactElement[];
}

export function Trans({ i18nKey, params, components = [] }: TransProps) {
    const { t } = useI18n();
    const message = t(i18nKey, params);

    if (components.length === 0 || !message.includes('<')) return <>{message}</>;

    // Built per call rather than hoisted: a module-level `/g` regex carries
    // `lastIndex` between renders, so two <Trans> on one page would interleave.
    const slot = /<(\d+)>(.*?)<\/\1>/gs;
    const parts: ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = slot.exec(message)) !== null) {
        if (match.index > cursor) parts.push(message.slice(cursor, match.index));
        const element = components[Number(match[1])];
        parts.push(
            element
                ? // Keyed so React can reconcile the cloned elements as a list.
                  cloneElement(element, { key: `slot-${parts.length}` }, match[2])
                : match[2],
        );
        cursor = match.index + match[0].length;
    }
    if (cursor < message.length) parts.push(message.slice(cursor));

    return <>{parts}</>;
}
