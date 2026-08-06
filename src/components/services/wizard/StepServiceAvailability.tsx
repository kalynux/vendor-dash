import { useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import {
  AvailabilityRulesEditor,
  type AvailabilityRulesEditorHandle,
} from '@/components/services/AvailabilityRulesEditor';

interface StepServiceAvailabilityProps {
  productId: string;
  onContinue: () => void;
  onBack: () => void;
}

export function StepServiceAvailability({
  productId,
  onContinue,
  onBack,
}: StepServiceAvailabilityProps) {
  const { t } = useTranslation();
  const editorRef = useRef<AvailabilityRulesEditorHandle>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    const editor = editorRef.current;
    // Persist pending edits before advancing; block on validation/API failure.
    if (editor?.isDirty) {
      setSaving(true);
      try {
        const ok = await editor.save();
        if (!ok) return;
      } finally {
        setSaving(false);
      }
    }
    onContinue();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('services.availability.stepTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('services.availability.stepDescription')}
        </p>
      </div>

      <AvailabilityRulesEditor ref={editorRef} productId={productId} showSaveButton={false} />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5" disabled={saving}>
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <Button type="button" onClick={handleContinue} className="gap-1.5" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            <>
              {t('services.wizard.saveAndContinue')}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
