import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';

/**
 * "Required" / "Optional", as the **reviewers** mean it.
 *
 * ⚠ This is guidance and nothing else. The API enforces no completeness rule
 * anywhere — a vendor can submit an empty record — so this badge must never be
 * wired to a disabled Submit button. It exists so the vendor knows what will get
 * their submission rejected before they wait a day to find out.
 *
 * Which rows are required is not fixed: two of them depend on whether this
 * vendor has a physical store. See `kycChecklist`.
 */
export function RequirementBadge({ required }: { required: boolean }) {
  const { t } = useTranslation();

  return (
    <Badge variant={required ? 'secondary' : 'outline'} className="h-5 px-1.5 text-[10px] font-medium">
      {required
        ? t('account.verification.checklist.required')
        : t('account.verification.checklist.optional')}
    </Badge>
  );
}
