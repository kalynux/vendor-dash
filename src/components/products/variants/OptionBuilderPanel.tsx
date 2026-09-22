// ─── Option Builder Panel ─────────────────────────────────────────────────────
// UI for creating, editing, renaming, and managing product options and values.

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Plus, X, Pencil, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DraftOption, DraftOptionValue } from './variant.types';
import { MAX_OPTIONS, MAX_VARIANTS } from './variant.engine';
import { useTranslation } from '@/i18n';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OptionBuilderPanelProps {
  options: DraftOption[];
  combinationCount: number;
  exceedsLimit: boolean;
  skuPrefix: string;
  onAddOption: (name: string, initialValues?: string[]) => void;
  onRemoveOption: (localId: string) => void;
  onRenameOption: (localId: string, name: string) => void;
  onAddValue: (optionLocalId: string, value: string) => void;
  onRemoveValue: (optionLocalId: string, valueLocalId: string) => void;
  onRenameValue: (optionLocalId: string, valueLocalId: string, newValue: string) => void;
  onSetSkuPrefix: (prefix: string) => void;
  onApplyAndGenerate: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OptionBuilderPanel({
  options,
  combinationCount,
  exceedsLimit,
  skuPrefix,
  onAddOption,
  onRemoveOption,
  onRenameOption,
  onAddValue,
  onRemoveValue,
  onRenameValue,
  onSetSkuPrefix,
  onApplyAndGenerate,
}: OptionBuilderPanelProps) {
  const { t } = useTranslation();
  const [newOptionName, setNewOptionName] = useState('');
  const canAddOption = options.length < MAX_OPTIONS;
  const hasValidOptions = options.length > 0 && options.every((o) => o.values.length > 0);

  const handleAddOption = () => {
    const trimmed = newOptionName.trim();
    if (!trimmed) return;
    // Check for duplicate option name (case-insensitive)
    const exists = options.some(
      (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) return;
    onAddOption(trimmed);
    setNewOptionName('');
  };

  return (
    <div className="space-y-5">
      {/* Existing Options — flat blocks with hairlines between, not a card
          each: they already sit inside the step's own section. */}
      {options.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {options.map((option) => (
            <OptionCard
              key={option.localId}
              option={option}
              onRemove={() => onRemoveOption(option.localId)}
              onRename={(name) => onRenameOption(option.localId, name)}
              onAddValue={(value) => onAddValue(option.localId, value)}
              onRemoveValue={(valueLocalId) =>
                onRemoveValue(option.localId, valueLocalId)
              }
              onRenameValue={(valueLocalId, newValue) =>
                onRenameValue(option.localId, valueLocalId, newValue)
              }
            />
          ))}
        </div>
      )}

      {/* Add New Option — stacked on a phone, where the button beside the
          field left it too narrow to show its own placeholder. */}
      {canAddOption && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            aria-label={t('products.variants.optionName')}
            placeholder={t('products.options.namePlaceholder')}
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddOption();
              }
            }}
            className="md:max-w-[300px] md:flex-1"
          />
          <Button
            variant="outline"
            onClick={handleAddOption}
            disabled={!newOptionName.trim()}
            className="shrink-0 gap-1.5 max-md:h-11"
          >
            <Plus className="size-4" />
            {t('products.options.addOption')}
          </Button>
        </div>
      )}

      {!canAddOption && (
        <p className="text-sm text-muted-foreground">
          {t('products.options.maxOptions', { max: MAX_OPTIONS })}
        </p>
      )}

      {/* SKU Prefix — read when the variants are generated, so it sits just
          above the button that generates them. */}
      <div className="space-y-2">
        <Label htmlFor="sku-prefix">{t('products.options.skuPrefix')}</Label>
        <Input
          id="sku-prefix"
          placeholder={t('products.options.skuPrefixPlaceholder')}
          value={skuPrefix}
          onChange={(e) => onSetSkuPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          className="w-full font-mono md:max-w-[200px]"
        />
        <p className="text-sm text-muted-foreground">
          {t('products.options.skuPrefixHint')}
        </p>
      </div>

      {/* Combination Preview & Generate Button */}
      {options.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('products.options.preview')}</p>
            <p
              className={cn(
                'text-sm',
                exceedsLimit ? 'text-destructive font-medium' : 'text-muted-foreground',
              )}
            >
              {combinationCount > 0
                ? t('products.options.willGenerate', { count: combinationCount })
                : t('products.options.addValuesToGenerate')}
            </p>
            {exceedsLimit && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {t('products.options.exceedsLimit', { max: MAX_VARIANTS })}
              </p>
            )}
          </div>
          <Button
            onClick={onApplyAndGenerate}
            disabled={!hasValidOptions || exceedsLimit}
            className="w-full max-md:h-11 md:w-auto"
          >
            {t('products.options.applyAndGenerate')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Option Card ─────────────────────────────────────────────────────────────

interface OptionCardProps {
  option: DraftOption;
  onRemove: () => void;
  onRename: (name: string) => void;
  onAddValue: (value: string) => void;
  onRemoveValue: (valueLocalId: string) => void;
  onRenameValue: (valueLocalId: string, newValue: string) => void;
}

function OptionCard({
  option,
  onRemove,
  onRename,
  onAddValue,
  onRemoveValue,
  onRenameValue,
}: OptionCardProps) {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(option.name);
  const [valueInput, setValueInput] = useState('');
  const valueInputRef = useRef<HTMLInputElement>(null);

  const isSaved = !!option.serverId;
  const isRenamed = option.originalName !== undefined && option.name !== option.originalName;

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== option.name) {
      onRename(trimmed);
    }
    setIsEditingName(false);
  };

  const handleValueKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = valueInput.trim().replace(/,+$/, '');
      if (trimmed) {
        onAddValue(trimmed);
        setValueInput('');
      }
    }
  };

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setEditName(option.name);
                    setIsEditingName(false);
                  }
                }}
                onBlur={handleSaveName}
                className="w-[180px] md:h-8"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveName}
                aria-label={t('common.actions.save')}
              >
                <Check className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="tap-target flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium hover:text-primary"
              onClick={() => {
                setEditName(option.name);
                setIsEditingName(true);
              }}
            >
              <span className="truncate">{option.name}</span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {isSaved && (
                <span
                  className={cn(
                    'inline-block size-1.5 shrink-0 rounded-full',
                    isRenamed ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  title={t(isRenamed
                    ? 'products.options.renamedUnsaved'
                    : 'products.options.savedMarker')}
                />
              )}
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={t('common.actions.remove')}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Value Tags */}
      <div className="flex flex-wrap gap-2">
        {option.values && option.values.length > 0 ? (
          option.values.map((val) => (
            <ValueBadge
              key={val.localId}
              value={val}
              onRemove={() => onRemoveValue(val.localId)}
              onRename={(newValue) => onRenameValue(val.localId, newValue)}
            />
          ))) : (
          <p className="text-sm text-destructive">{t('products.options.noValues')}</p>
        )}
      </div>

      {/* Add Value Input */}
      <div className="flex items-center gap-2">
        <Input
          ref={valueInputRef}
          aria-label={t('products.variants.optionValues')}
          placeholder={t('products.options.valuePlaceholder')}
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          onKeyDown={handleValueKeyDown}
          className="min-w-0 flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const trimmed = valueInput.trim();
            if (trimmed) {
              onAddValue(trimmed);
              setValueInput('');
              valueInputRef.current?.focus();
            }
          }}
          disabled={!valueInput.trim()}
          aria-label={t('common.actions.add')}
          className="shrink-0 max-md:size-11"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Value Badge ─────────────────────────────────────────────────────────────

interface ValueBadgeProps {
  value: DraftOptionValue;
  onRemove: () => void;
  onRename: (newValue: string) => void;
}

function ValueBadge({ value, onRemove, onRename }: ValueBadgeProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(value.value);

  const isSaved = !!value.serverId;
  const isRenamed = value.originalValue !== undefined && value.value !== value.originalValue;

  const handleSave = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== value.value) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editText, value.value, onRename]);

  if (isEditing) {
    return (
      <Input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setEditText(value.value);
            setIsEditing(false);
          }
        }}
        onBlur={handleSave}
        // Stays chip-sized on a phone: `ProductFormBody` would otherwise make
        // this inline editor a full 44px field in the middle of a row of chips.
        className="w-[120px] px-2 max-md:!h-9 md:h-7 md:text-xs"
        autoFocus
      />
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer gap-1 py-1 pl-2.5 pr-1.5 text-sm font-normal transition-colors hover:bg-secondary/80',
        isRenamed && 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20',
        isSaved && !isRenamed && 'border-emerald-500/30',
      )}
    >
      <span
        onClick={() => {
          setEditText(value.value);
          setIsEditing(true);
        }}
        className="hover:underline"
      >
        {value.value}
      </span>
      {isSaved && (
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full ml-0.5',
            isRenamed ? 'bg-amber-500' : 'bg-emerald-500',
          )}
        />
      )}
      {!isSaved && (
        <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5 bg-blue-500" />
      )}
      <button
        type="button"
        aria-label={t('products.fields.removeTag', { tag: value.value })}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="tap-target ml-0.5 rounded-sm text-muted-foreground transition-colors hover:text-destructive"
      >
        <X className="size-3.5" />
      </button>
    </Badge>
  );
}
