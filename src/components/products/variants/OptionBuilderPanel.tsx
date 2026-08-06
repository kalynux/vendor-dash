// ─── Option Builder Panel ─────────────────────────────────────────────────────
// UI for creating, editing, renaming, and managing product options and values.

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Plus, X, GripVertical, Pencil, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      {/* SKU Prefix */}
      <div className="space-y-2">
        <Label htmlFor="sku-prefix" className="text-sm font-medium">
          {t('products.options.skuPrefix')}
        </Label>
        <Input
          id="sku-prefix"
          placeholder={t('products.options.skuPrefixPlaceholder')}
          value={skuPrefix}
          onChange={(e) => onSetSkuPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          className="w-full sm:max-w-[200px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {t('products.options.skuPrefixHint')}
        </p>
      </div>

      {/* Existing Options */}
      <div className="space-y-4">
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

      {/* Add New Option */}
      {canAddOption && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('products.options.namePlaceholder')}
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddOption();
              }
            }}
            className="flex-1 sm:max-w-[300px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            disabled={!newOptionName.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{t('products.options.addOption')}</span>
          </Button>
        </div>
      )}

      {!canAddOption && (
        <p className="text-xs text-muted-foreground">
          {t('products.options.maxOptions', { max: MAX_OPTIONS })}
        </p>
      )}

      {/* Combination Preview & Generate Button */}
      {options.length > 0 && (
        <div className="pt-4 border-t space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t('products.options.exceedsLimit', { max: MAX_VARIANTS })}
                </p>
              )}
            </div>
            <Button
              onClick={onApplyAndGenerate}
              disabled={!hasValidOptions || exceedsLimit}
              className="w-full sm:w-auto"
            >
              {t('products.options.applyAndGenerate')}
            </Button>
          </div>
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
    <Card className="relative gap-2">
      <CardHeader className="">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
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
                  className="h-7 w-[160px] text-sm"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleSaveName}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <CardTitle
                className="text-sm font-medium cursor-pointer hover:text-primary flex items-center gap-1.5"
                onClick={() => {
                  setEditName(option.name);
                  setIsEditingName(true);
                }}
              >
                {option.name}
                <Pencil className="h-3 w-3 text-muted-foreground group-hover:opacity-100 transition-opacity" />
                {isSaved && (
                  <span
                    className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full',
                      isRenamed ? 'bg-amber-500' : 'bg-emerald-500',
                    )}
                    title={t(isRenamed
                      ? 'products.options.renamedUnsaved'
                      : 'products.options.savedMarker')}
                  />
                )}
              </CardTitle>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Value Tags */}
        <div className="flex flex-wrap gap-1.5">
          {option.values && option.values.length > 0 ? (
            option.values.map((val) => (
              <ValueBadge
                key={val.localId}
                value={val}
                onRemove={() => onRemoveValue(val.localId)}
                onRename={(newValue) => onRenameValue(val.localId, newValue)}
              />
            ))) : (
            <p className="text-xs text-red-500">{t('products.options.noValues')}</p>
          )}
        </div>

        {/* Add Value Input */}
        <div className="flex items-center gap-2">
          <Input
            ref={valueInputRef}
            placeholder={t('products.options.valuePlaceholder')}
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onKeyDown={handleValueKeyDown}
            className="text-sm flex-1 min-w-0"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const trimmed = valueInput.trim();
              if (trimmed) {
                onAddValue(trimmed);
                setValueInput('');
                valueInputRef.current?.focus();
              }
            }}
            disabled={!valueInput.trim()}
            className="shrink-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Value Badge ─────────────────────────────────────────────────────────────

interface ValueBadgeProps {
  value: DraftOptionValue;
  onRemove: () => void;
  onRename: (newValue: string) => void;
}

function ValueBadge({ value, onRemove, onRename }: ValueBadgeProps) {
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
        className="h-6 w-[100px] text-xs px-2"
        autoFocus
      />
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer hover:bg-secondary/80 transition-colors gap-1 pr-1',
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
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 hover:text-destructive transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
