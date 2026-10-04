import type { InlineNode, RichDoc } from '@/lib/richtext';
import { cn } from '@/lib/utils';

/**
 * Read-only rendering of a description document — what the AI wrote, shown
 * before the vendor accepts it. Built from the blocks rather than through
 * `docToHtml` + `innerHTML`, so nothing the model returns can become markup.
 */
export function RichDocView({ doc, className }: { doc: RichDoc; className?: string }) {
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed', className)}>
      {doc.blocks.map((block, i) =>
        block.type === 'paragraph' ? (
          <p key={i} className="whitespace-pre-line">
            <Inline nodes={block.text} />
          </p>
        ) : block.ordered ? (
          <ol key={i} className="list-decimal space-y-0.5 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline nodes={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline nodes={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => (
        <span
          key={i}
          className={cn(
            node.bold && 'font-semibold',
            node.italic && 'italic',
            node.strike && 'line-through',
            node.type === 'link' && 'text-primary underline underline-offset-2',
          )}
        >
          {node.text}
        </span>
      ))}
    </>
  );
}
