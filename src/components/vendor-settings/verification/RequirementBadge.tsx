import { useTranslation } from '@/i18n';

/**
 * Marks an **optional** slot, as the reviewers mean it — "(optional)" after the
 * label, like every other form. Required is the norm here, so it gets no mark:
 * a "Required" pill on nearly every slot was noise.
 *
 * ⚠ This is guidance and nothing else. The API enforces no completeness rule
 * anywhere — a vendor can submit an empty record — so this must never be wired
 * to a disabled Submit button. It exists so the vendor knows what will get their
 * submission rejected before they wait a day to find out.
 *
 * Which rows are required is not fixed: two of them depend on whether this
 * vendor has a physical store. See `kycChecklist`.
 */
export function RequirementBadge({ required }: { required: boolean }) {
  const { t } = useTranslation();
  if (required) return null;

  return (
    <span className="text-sm font-normal lowercase text-muted-foreground">
      ({t('common.labels.optional')})
    </span>
  );
}
