import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { useTranslation } from '@/i18n';
import type { CategoryConflict, CategoryConflictChoice } from '@/types/category.types';

interface CategoryConflictDialogProps {
  conflicts: CategoryConflict[] | null;
  onConfirm: (choices: CategoryConflictChoice[]) => void;
  onCancel: () => void;
}

const KEEP = 'keep';

/**
 * The answer to `422 CATEGORY_SIMILAR_EXISTS`: one question per typed name that
 * looks like an existing category. Every conflict is on screen at once — the
 * server lists them all, and nothing is saved until each one is answered.
 *
 * The first suggestion is preselected: picking the existing category is what
 * keeps a product next to similar ones, and the vendor can still keep theirs.
 */
export function CategoryConflictDialog({ conflicts, onConfirm, onCancel }: CategoryConflictDialogProps) {
  const { t } = useTranslation();
  const baseId = useId();
  // Answers belong to one set of conflicts; a new set starts from the defaults.
  const [picked, setPicked] = useState<{ for: CategoryConflict[] | null; answers: string[] }>({
    for: null,
    answers: [],
  });
  const answers =
    picked.for === conflicts
      ? picked.answers
      : (conflicts ?? []).map((c) => c.suggestions[0]?.id ?? KEEP);

  function answer(index: number, value: string) {
    setPicked({ for: conflicts, answers: answers.map((a, j) => (j === index ? value : a)) });
  }

  function confirm() {
    if (!conflicts) return;
    onConfirm(
      conflicts.map((conflict, i): CategoryConflictChoice => {
        const chosen = conflict.suggestions.find((s) => s.id === answers[i]);
        return chosen ? { kind: 'suggestion', category: chosen } : { kind: 'keep' };
      }),
    );
  }

  return (
    <ResponsiveModal
      open={conflicts !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={t('products.categories.conflict.title')}
      description={t('products.categories.conflict.description')}
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} className="max-sm:w-full">
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={confirm} className="max-sm:w-full">
            {t('products.categories.conflict.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {conflicts?.map((conflict, i) => {
          const groupId = `${baseId}-${i}`;
          return (
            <fieldset key={`${conflict.name}-${i}`} className="space-y-3">
              <legend className="mb-3 text-sm font-medium">
                {t('products.categories.conflict.typed', { name: conflict.name })}
              </legend>
              <RadioGroup
                value={answers[i] ?? KEEP}
                onValueChange={(v) => answer(i, v)}
                className="gap-1"
              >
                {conflict.suggestions.map((s) => (
                  <Label
                    key={s.id}
                    htmlFor={`${groupId}-${s.id}`}
                    className="flex min-h-11 cursor-pointer items-center gap-3 font-normal"
                  >
                    <RadioGroupItem id={`${groupId}-${s.id}`} value={s.id} />
                    {t('products.categories.didYouMean', { name: s.name })}
                  </Label>
                ))}
                <Label
                  htmlFor={`${groupId}-keep`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 font-normal"
                >
                  <RadioGroupItem id={`${groupId}-keep`} value={KEEP} />
                  {t('products.categories.conflict.keep', { name: conflict.name })}
                </Label>
              </RadioGroup>
            </fieldset>
          );
        })}
      </div>
    </ResponsiveModal>
  );
}
