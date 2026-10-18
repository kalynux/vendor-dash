import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import {
  agencyBlockerRemedy,
  agencyBlockerText,
  DEFAULT_AGENCY_SETTING_PATH,
  NO_DELIVERY_AGENCY_CODE,
  productEditorPath,
  readAgencyBlockerDetails,
} from '@/lib/agencyBlocker';
import { ApiError } from '@/types/api';
import type { ProductMode } from '@/types/product.types';

/**
 * For a refused Publish (`PATCH /products/:id/status` → active): when the cause
 * is the delivery agency, shows which problem it is plus the button that fixes
 * it, and returns true. Returns false for any other error — the caller shows
 * its usual message then.
 */
export function useAgencyBlockerToast() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useCallback(
    (
      err: unknown,
      product: { id: string; mode?: ProductMode },
      /** Set on the product's own editor, where its delivery section is on screen. */
      onShowProductAgency?: () => void,
    ): boolean => {
      if (!(err instanceof ApiError) || err.code !== NO_DELIVERY_AGENCY_CODE) return false;
      const remedy = agencyBlockerRemedy(readAgencyBlockerDetails(err.detailsObject));
      toast.error(agencyBlockerText(t, err.detailsObject, err.message), {
        duration: 10000,
        action: {
          label: t(remedy.labelKey),
          onClick: () => {
            if (remedy.target === 'agencySettings') navigate(DEFAULT_AGENCY_SETTING_PATH);
            else if (onShowProductAgency) onShowProductAgency();
            else navigate(productEditorPath(product));
          },
        },
      });
      return true;
    },
    [t, navigate],
  );
}
