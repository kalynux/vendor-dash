/**
 * True when react-hook-form's `dirtyFields` tree holds at least one `true` leaf.
 *
 * Settings forms drive the floating save bar from this rather than from
 * `formState.isDirty`. `isDirty` compares the whole form with its defaults, and
 * an optional field the saved record leaves out (`undefined`) reads back as
 * `''` once its input mounts — so the bar showed on forms nobody had touched.
 * `dirtyFields` only records fields the vendor actually changed.
 */
export function hasDirtyField(node: unknown): boolean {
    if (node === true) return true;
    if (node && typeof node === 'object') return Object.values(node).some(hasDirtyField);
    return false;
}
