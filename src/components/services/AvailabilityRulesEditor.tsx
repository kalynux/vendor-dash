import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import { Plus, X, Loader2, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import {
  fetchRules, createRules, updateRule, toggleRule, deleteRule,
  AVAILABILITY_ERROR_MAP,
} from '@/services/services.service';
import {
  DAY_ORDER, DAY_LABELS, browserTimezone, getAvailabilityRuleId,
} from '@/components/services/service.constants';
import type {
  AvailabilityRule, CreateAvailabilityRulePayload, DayOfWeek,
} from '@/types/services.types';

// Maps an API error to a short reason for the per-day failure summary.
function reasonFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AVAILABILITY_TIME_OVERLAP') return 'overlaps existing hours';
    return AVAILABILITY_ERROR_MAP[err.code] ?? err.message;
  }
  return 'failed to save';
}

// Default hours used when a day is first opened or a new set is added.
const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '18:00';

interface AvailabilityRulesEditorProps {
  productId: string;
  /** Render the built-in Save button (default true). Hide it to drive saving externally via the ref. */
  showSaveButton?: boolean;
  /** Called after a successful save. */
  onSaved?: () => void;
}

export interface AvailabilityRulesEditorHandle {
  /** Persist all pending changes. Resolves true on success (no per-rule failures). */
  save: () => Promise<boolean>;
  isDirty: boolean;
}

// ─── Local schedule model (day-centric; one "set of hours" = one rule) ──────────

interface HourSet {
  uid: string; // stable local key (server id, or a temp id for new sets)
  serverId: string | null;
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  // Preserved across edits; not shown in this UI (defaulted for new sets).
  timezone: string;
  serverActive: boolean; // isActive at load time — used to diff activation on save
}

interface DayState {
  open: boolean;
  sets: HourSet[];
}

type Schedule = Record<DayOfWeek, DayState>;

function emptySchedule(): Schedule {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = { open: false, sets: [] };
    return acc;
  }, {} as Schedule);
}

// A fresh service has no rules yet — default every day to open with a standard
// set of hours already filled in, so the vendor just turns off the days they're
// closed instead of building the week from scratch.
function buildDefaultOpenSchedule(): Schedule {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = { open: true, sets: [newSet()] };
    return acc;
  }, {} as Schedule);
}

function buildSchedule(rules: AvailabilityRule[]): Schedule {
  const schedule = emptySchedule();
  for (const r of rules) {
    const day = schedule[r.dayOfWeek];
    const serverId = getAvailabilityRuleId(r);
    day.sets.push({
      uid: serverId ?? `srv-${Math.random().toString(36).slice(2)}`,
      serverId,
      startTime: r.startTime,
      endTime: r.endTime,
      timezone: r.timezone,
      serverActive: r.isActive,
    });
    // A day reads as "open" when it has at least one published (active) rule.
    if (r.isActive) day.open = true;
  }
  for (const day of DAY_ORDER) {
    schedule[day].sets.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return schedule;
}

function newSet(): HourSet {
  return {
    uid: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    serverId: null,
    startTime: DEFAULT_OPEN,
    endTime: DEFAULT_CLOSE,
    timezone: browserTimezone(),
    serverActive: false,
  };
}

function isSetInvalid(set: HourSet): boolean {
  return !set.startTime || !set.endTime || set.startTime >= set.endTime;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const AvailabilityRulesEditor = forwardRef<
  AvailabilityRulesEditorHandle,
  AvailabilityRulesEditorProps
>(function AvailabilityRulesEditor({ productId, showSaveButton = true, onSaved }, ref) {
  const [schedule, setSchedule] = useState<Schedule>(emptySchedule);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Snapshot of the rules as loaded — used to diff deletions / time edits / activation.
  const initialRulesRef = useRef<AvailabilityRule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rules = await fetchRules(productId);
      initialRulesRef.current = rules;
      if (rules.length === 0) {
        // No saved hours yet — start with a full open week the vendor can pare down.
        setSchedule(buildDefaultOpenSchedule());
        setDirty(true); // the seeded defaults are unsaved and should persist on Save / Continue
      } else {
        setSchedule(buildSchedule(rules));
        setDirty(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Local mutations ───────────────────────────────────────────────────────

  function updateDay(day: DayOfWeek, updater: (d: DayState) => DayState) {
    setSchedule((prev) => ({ ...prev, [day]: updater(prev[day]) }));
    setDirty(true);
  }

  function toggleDay(day: DayOfWeek) {
    updateDay(day, (d) => {
      if (d.open) return { ...d, open: false };
      // Opening a day with no hours seeds a default set.
      return { open: true, sets: d.sets.length > 0 ? d.sets : [newSet()] };
    });
  }

  function addSet(day: DayOfWeek) {
    updateDay(day, (d) => ({ ...d, sets: [...d.sets, newSet()] }));
  }

  function removeSet(day: DayOfWeek, uid: string) {
    updateDay(day, (d) => {
      const sets = d.sets.filter((s) => s.uid !== uid);
      return { open: sets.length > 0 && d.open, sets };
    });
  }

  function patchSet(day: DayOfWeek, uid: string, patch: Partial<HourSet>) {
    updateDay(day, (d) => ({
      ...d,
      sets: d.sets.map((s) => (s.uid === uid ? { ...s, ...patch } : s)),
    }));
  }

  // ─── Save (batch diff against the loaded snapshot) ──────────────────────────

  const persist = useCallback(async (): Promise<boolean> => {
    // Pre-flight: every open set needs close > open.
    const invalidDays = DAY_ORDER.filter(
      (day) => schedule[day].open && schedule[day].sets.some(isSetInvalid),
    ).map((day) => DAY_LABELS[day]);
    if (invalidDays.length > 0) {
      toast.error('Fix opening hours', {
        description: `${invalidDays.join(', ')}: close time must be after open time.`,
      });
      return false;
    }

    setSaving(true);
    const failures: string[] = [];
    try {
      const initialRules = initialRulesRef.current;

      // 1. Deletions — server rules no longer present in any day's sets.
      const presentIds = new Set<string>();
      for (const day of DAY_ORDER) {
        for (const s of schedule[day].sets) if (s.serverId) presentIds.add(s.serverId);
      }
      for (const r of initialRules) {
        const rid = getAvailabilityRuleId(r);
        if (rid && !presentIds.has(rid)) {
          try {
            await deleteRule(rid);
          } catch {
            failures.push(`${DAY_LABELS[r.dayOfWeek]} (remove)`);
          }
        }
      }

      // 2. Existing rules — update changed times + reconcile published state.
      for (const day of DAY_ORDER) {
        const d = schedule[day];
        for (const set of d.sets) {
          if (!set.serverId) continue;
          try {
            const init = initialRules.find((r) => getAvailabilityRuleId(r) === set.serverId);
            if (init && (init.startTime !== set.startTime || init.endTime !== set.endTime)) {
              await updateRule(set.serverId, {
                startTime: set.startTime,
                endTime: set.endTime,
              });
            }
            // Publish/unpublish to match the day toggle (explicit isActive).
            if (d.open && !set.serverActive) {
              await toggleRule(set.serverId, true);
            } else if (!d.open && set.serverActive) {
              await toggleRule(set.serverId, false);
            }
          } catch (err) {
            failures.push(`${DAY_LABELS[day]} (${reasonFor(err)})`);
          }
        }
      }

      // 3. New hours — create the whole batch in one atomic request, published.
      //    (Only open days; closed days never carry unsaved hours.)
      const toCreate: CreateAvailabilityRulePayload[] = [];
      for (const day of DAY_ORDER) {
        const d = schedule[day];
        if (!d.open) continue;
        for (const set of d.sets) {
          if (!set.serverId) {
            toCreate.push({
              dayOfWeek: day,
              startTime: set.startTime,
              endTime: set.endTime,
              timezone: set.timezone,
              isActive: true,
            });
          }
        }
      }
      if (toCreate.length > 0) {
        try {
          await createRules(productId, toCreate);
        } catch (err) {
          // Atomic: if any new rule is invalid/overlaps, none are created.
          failures.push(`New hours (${reasonFor(err)})`);
        }
      }

      if (failures.length > 0) {
        toast.error('Some hours could not be saved', { description: failures.join('; ') });
      } else {
        toast.success('Availability saved');
      }
      await load();
      onSaved?.();
      return failures.length === 0;
    } finally {
      setSaving(false);
    }
  }, [schedule, productId, load, onSaved]);

  useImperativeHandle(ref, () => ({ save: persist, isDirty: dirty }), [persist, dirty]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <CalendarRange className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {DAY_ORDER.map((day) => {
          const d = schedule[day];
          return (
            <div key={day} className="flex items-start justify-between gap-4 py-5">
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="font-medium leading-tight">{DAY_LABELS[day]}</p>
                  {!d.open && <p className="text-sm text-muted-foreground">Closed</p>}
                </div>

                {d.open && (
                  <div className="space-y-3">
                    {d.sets.map((set, i) => {
                      const invalid = isSetInvalid(set);
                      return (
                        <div key={set.uid} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <TimeField
                              label="Open"
                              value={set.startTime}
                              invalid={invalid}
                              onChange={(v) => patchSet(day, set.uid, { startTime: v })}
                            />
                            <span className="text-muted-foreground">–</span>
                            <TimeField
                              label="Close"
                              value={set.endTime}
                              invalid={invalid}
                              onChange={(v) => patchSet(day, set.uid, { endTime: v })}
                            />
                            {i > 0 && (
                              <button
                                type="button"
                                onClick={() => removeSet(day, set.uid)}
                                aria-label="Remove this set of hours"
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {invalid && (
                            <p className="text-xs text-destructive">
                              Close time must be after open time.
                            </p>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => addSet(day)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Add a set of hours
                    </button>
                  </div>
                )}
              </div>

              <Switch
                checked={d.open}
                onCheckedChange={() => toggleDay(day)}
                aria-label={`${DAY_LABELS[day]} ${d.open ? 'open' : 'closed'}`}
                className="mt-1 shrink-0"
              />
            </div>
          );
        })}
      </div>

      {showSaveButton && (
        <div className="pt-5">
          <Button
            type="button"
            onClick={persist}
            disabled={saving || !dirty}
            className="w-full"
            size="lg"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
});

// ─── Time field (floating-label box, matches the design) ────────────────────────

function TimeField({
  label, value, onChange, invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="relative flex-1">
      <span className="absolute -top-2 left-2.5 z-10 bg-card px-1 text-[11px] text-muted-foreground">
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-14 w-full rounded-md border bg-transparent px-3 text-base tabular-nums outline-none transition-colors',
          invalid ? 'border-destructive' : 'border-input focus:border-foreground',
        )}
      />
    </div>
  );
}
