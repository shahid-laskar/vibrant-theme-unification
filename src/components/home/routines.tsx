/**
 * Family Routines — authoring and daily progress.
 *
 * Presentation only. Every calculation (schedule resolution, due dates,
 * progress, status) comes from the Routine + Rhythm engines.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Action, EmptyState, Field, Section, Sheet, Tick } from "@/components/veedu/primitives";
import { RecurrenceField } from "@/components/veedu/recurrence-field";
import {
  EMPTY_SCHEDULE,
  ScheduleChip,
  ScheduleField,
  type ScheduleValue,
} from "@/components/veedu/schedule-field";
import { todayKey, uid, useStore } from "@/lib/store";
import { type Recurrence } from "@/lib/recurrence";
import { type FamilyMember } from "@/lib/family-model";
import { usePrayers } from "@/components/deen/modules";
import { useExperience } from "@/lib/theme-provider";
import {
  createRoutine,
  deriveRoutineDayInstance,
  getTodayRoutineInstances,
  skipRoutineStep,
  toggleRoutineStepCompletion,
  type Routine,
  type RoutineCategory,
  type RoutineDayInstance,
  type RoutineStep,
} from "@/lib/routine-engine";

const CATEGORIES: { id: RoutineCategory; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "school", label: "School" },
  { id: "prayer", label: "Prayer" },
  { id: "household", label: "Household" },
  { id: "evening", label: "Evening" },
  { id: "bedtime", label: "Bedtime" },
  { id: "general", label: "General" },
];

type DraftStep = { id: string; title: string; durationMinutes?: number | undefined; assigneeId?: string | undefined };

type Draft = {
  id?: string | undefined;
  name: string;
  category: RoutineCategory;
  schedule: ScheduleValue;
  recur: Recurrence;
  memberId?: string | undefined;
  steps: DraftStep[];
};

function emptyDraft(): Draft {
  return {
    name: "",
    category: "general",
    schedule: { ...EMPTY_SCHEDULE },
    recur: { freq: "daily", start: todayKey() },
    memberId: undefined,
    steps: [],
  };
}

function draftFromRoutine(r: Routine): Draft {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? "general",
    schedule: {
      scheduleMode: r.scheduleMode ?? "unscheduled",
      time: r.time,
      relativeAnchor: r.relativeAnchor,
    },
    recur: r.recur ?? { freq: "daily", start: todayKey() },
    memberId: r.memberId,
    steps: r.steps.map((s: RoutineStep) => ({
      id: s.id,
      title: s.title,
      durationMinutes: s.durationMinutes,
      assigneeId: s.assigneeId,
    })),
  };
}

export function Routines() {
  const { experience } = useExperience();
  const isVibrant = experience === "vibrant";
  const today = todayKey();
  const prayers = usePrayers();
  const [routines, setRoutines] = useStore<Routine[]>("routines", []);
  const [family] = useStore<FamilyMember[]>("family", []);
  const [draft, setDraft] = useState<Draft | null>(null);

  const instances = useMemo(
    () => getTodayRoutineInstances(routines, today, prayers, family),
    [routines, today, prayers, family],
  );

  const others = useMemo(
    () =>
      routines
        .filter((r) => !instances.some((i) => i.routineId === r.id))
        .map((r) => deriveRoutineDayInstance(r, today, prayers, family)),
    [routines, instances, today, prayers, family],
  );

  const doneCount = instances.filter((i) => i.status === "completed").length;

  function toggleStep(routineId: string, stepId: string) {
    setRoutines(
      routines.map((r) => (r.id === routineId ? toggleRoutineStepCompletion(r, stepId, today) : r)),
    );
  }

  function skipStep(routineId: string, stepId: string, skipped: boolean) {
    setRoutines(
      routines.map((r) => (r.id === routineId ? skipRoutineStep(r, stepId, today, skipped) : r)),
    );
  }

  function saveDraft() {
    if (!draft || !draft.name.trim()) return;
    const existing = draft.id ? routines.find((r) => r.id === draft.id) : undefined;
    const next = createRoutine(
      {
        id: draft.id,
        name: draft.name,
        category: draft.category,
        scheduleMode: draft.schedule.scheduleMode,
        time: draft.schedule.time,
        relativeAnchor: draft.schedule.relativeAnchor,
        recur: draft.recur,
        memberId: draft.memberId,
        createdAt: existing?.createdAt,
        steps: draft.steps
          .filter((s) => s.title.trim())
          .map((s, idx) => {
            const kept = existing?.steps.find((e) => e.id === s.id);
            return {
              id: s.id,
              title: s.title,
              order: idx + 1,
              durationMinutes: s.durationMinutes,
              assigneeId: s.assigneeId,
              completions: kept?.completions ?? [],
              skipped: kept?.skipped ?? [],
            };
          }),
      },
      today,
    );
    setRoutines(existing ? routines.map((r) => (r.id === next.id ? next : r)) : [next, ...routines]);
    setDraft(null);
  }

  function removeRoutine(id: string) {
    setRoutines(routines.filter((r) => r.id !== id));
    setDraft(null);
  }

  return (
    <div className="space-y-8" data-tone="kids">
      <Section
        eyebrow="Family"
        title="Routines"
        aside={
          <Action variant="solid" onClick={() => setDraft(emptyDraft())}>
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" aria-hidden /> New routine
            </span>
          </Action>
        }
      >
        {routines.length === 0 ? (
          <EmptyState
            glyph="✦"
            headline="No routines yet"
            body="A routine is a short, ordered sequence — School Morning, Bedtime Reset, After Maghrib. Build one and it will find its place in the day."
            action={
              <Action variant="solid" onClick={() => setDraft(emptyDraft())}>
                Create your first routine
              </Action>
            }
          />
        ) : (
          <div className="space-y-5">
            <p className="text-ink-faint text-xs" aria-live="polite">
              {instances.length === 0
                ? "Nothing scheduled for today."
                : `${doneCount} of ${instances.length} routines complete today`}
            </p>

            {instances.length === 0 ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                None of your routines repeat today. They will return on their next day.
              </p>
            ) : (
              <ul className="space-y-4">
                {instances.map((inst) => (
                  <li key={inst.routineId}>
                    <RoutineCard
                      instance={inst}
                      vibrant={isVibrant}
                      onToggleStep={(stepId) => toggleStep(inst.routineId, stepId)}
                      onSkipStep={(stepId, skipped) => skipStep(inst.routineId, stepId, skipped)}
                      onEdit={() => {
                        const r = routines.find((x) => x.id === inst.routineId);
                        if (r) setDraft(draftFromRoutine(r));
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}

            {others.length > 0 && (
              <div className="border-border/60 border-t pt-4">
                <p className="eyebrow mb-2">Other days</p>
                <ul className="space-y-1.5">
                  {others.map((inst) => (
                    <li
                      key={inst.routineId}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.92rem]">{inst.name}</span>
                        <span className="text-ink-faint text-xs">
                          {inst.displaySchedule || "No set time"} · {inst.totalSteps} step
                          {inst.totalSteps === 1 ? "" : "s"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const r = routines.find((x) => x.id === inst.routineId);
                          if (r) setDraft(draftFromRoutine(r));
                        }}
                        className="text-ink-faint hover:text-foreground shrink-0 text-xs"
                      >
                        Edit
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      {draft && (
        <RoutineEditor
          draft={draft}
          family={family}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          {...(draft.id ? { onDelete: () => removeRoutine(draft.id!) } : {})}
        />
      )}
    </div>
  );
}

const STATUS_TEXT: Record<RoutineDayInstance["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Complete",
  skipped: "Skipped",
};

function RoutineCard({
  instance,
  vibrant,
  onToggleStep,
  onSkipStep,
  onEdit,
}: {
  instance: RoutineDayInstance;
  vibrant: boolean;
  onToggleStep: (stepId: string) => void;
  onSkipStep: (stepId: string, skipped: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <section
      aria-label={instance.name}
      className={
        vibrant
          ? "tile tile-vivid bloom-in p-4 sm:p-5"
          : "border-border/60 rounded-2xl border p-4 sm:p-5"
      }
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex flex-wrap items-center gap-2">
            {STATUS_TEXT[instance.status]}
            <ScheduleChip label={instance.displaySchedule} />
            {instance.memberName && <ScheduleChip label={instance.memberName} />}
          </p>
          <h3 className="title-md mt-1 text-[1.02rem]">{instance.name}</h3>
          <p className="text-ink-faint numeric mt-0.5 text-xs">
            {instance.completedSteps} / {instance.totalSteps} complete
            {instance.skippedSteps > 0 ? ` · ${instance.skippedSteps} skipped` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-ink-faint hover:text-foreground shrink-0 text-xs"
        >
          Edit
        </button>
      </header>

      <div
        className="bg-muted mt-3 h-[5px] w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${instance.name}: ${instance.completedSteps} of ${instance.totalSteps} steps complete`}
      >
        <div
          className="bg-space h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${instance.progressPct}%` }}
        />
      </div>

      {instance.steps.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">
          No steps yet — add a few so this routine can be followed.
        </p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {instance.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-2">
              <Tick
                done={s.isCompleted}
                label={`${s.title}${s.isCompleted ? " (complete)" : ""}`}
                onToggle={() => onToggleStep(s.id)}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[0.93rem] leading-snug ${
                    s.isCompleted
                      ? "text-ink-faint line-through"
                      : s.isSkipped
                        ? "text-ink-faint italic"
                        : ""
                  }`}
                >
                  {s.title}
                </p>
                {(s.assigneeName || s.durationMinutes || s.isSkipped) && (
                  <p className="text-ink-faint numeric mt-0.5 text-xs">
                    {[
                      s.assigneeName,
                      s.durationMinutes ? `${s.durationMinutes} min` : null,
                      s.isSkipped ? "Skipped today" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {!s.isCompleted && (
                <button
                  type="button"
                  onClick={() => onSkipStep(s.id, !s.isSkipped)}
                  className="text-ink-faint hover:text-foreground shrink-0 py-1 text-xs"
                >
                  {s.isSkipped ? "Undo skip" : "Skip"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoutineEditor({
  draft,
  family,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft;
  family: FamilyMember[];
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const [stepTitle, setStepTitle] = useState("");

  function addStep() {
    if (!stepTitle.trim()) return;
    onChange({
      ...draft,
      steps: [...draft.steps, { id: `step_${uid()}`, title: stepTitle.trim() }],
    });
    setStepTitle("");
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...draft.steps];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    onChange({ ...draft, steps: next });
  }

  function updateStep(index: number, patch: Partial<DraftStep>) {
    onChange({
      ...draft,
      steps: draft.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  }

  return (
    <Sheet open onClose={onClose} title={draft.id ? "Edit routine" : "New routine"}>
      <div className="space-y-5">
        <Field
          label="Name"
          value={draft.name}
          placeholder="School Morning"
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />

        <div>
          <span className="eyebrow">Category</span>
          <div role="radiogroup" aria-label="Category" className="mt-1.5 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={draft.category === c.id}
                onClick={() => onChange({ ...draft, category: c.id })}
                className={`press min-h-9 rounded-full px-3 py-1.5 text-[0.78rem] ${
                  draft.category === c.id
                    ? "bg-space-soft text-foreground ring-1 ring-[var(--space-accent)]/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="eyebrow">When</span>
          <div className="mt-1.5">
            <ScheduleField
              value={draft.schedule}
              onChange={(schedule) => onChange({ ...draft, schedule })}
              idPrefix="routine"
            />
          </div>
        </div>

        <div>
          <span className="eyebrow">Repeats</span>
          <div className="mt-1.5">
            <RecurrenceField value={draft.recur} onChange={(recur) => onChange({ ...draft, recur })} />
          </div>
        </div>

        <label className="block">
          <span className="eyebrow">Owner</span>
          <select
            value={draft.memberId ?? ""}
            onChange={(e) => onChange({ ...draft, memberId: e.target.value || undefined })}
            className="control mt-1.5 h-11 w-full"
          >
            <option value="">Household</option>
            {family.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {family.length === 0 && (
            <span className="text-ink-faint mt-1 block text-xs">
              Add family members in Kids to assign routines and steps.
            </span>
          )}
        </label>

        <div>
          <span className="eyebrow">Steps</span>
          {draft.steps.length === 0 ? (
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Add the steps in the order they happen — get dressed, breakfast, pack the bag.
            </p>
          ) : (
            <ol className="mt-2 space-y-2.5">
              {draft.steps.map((s, i) => (
                <li key={s.id} className="border-border/60 rounded-xl border p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="numeric text-ink-faint pt-2.5 text-xs">{i + 1}</span>
                    <input
                      value={s.title}
                      aria-label={`Step ${i + 1} title`}
                      onChange={(e) => updateStep(i, { title: e.target.value })}
                      className="control h-10 min-w-0 flex-1"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${s.title || `step ${i + 1}`} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="icon-btn press size-9 disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${s.title || `step ${i + 1}`} down`}
                        disabled={i === draft.steps.length - 1}
                        onClick={() => move(i, 1)}
                        className="icon-btn press size-9 disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${s.title || `step ${i + 1}`}`}
                        onClick={() =>
                          onChange({ ...draft, steps: draft.steps.filter((x) => x.id !== s.id) })
                        }
                        className="icon-btn press text-ink-faint hover:text-destructive size-9"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 pl-6">
                    <label className="min-w-0">
                      <span className="sr-only">Duration in minutes for {s.title}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="min"
                        value={s.durationMinutes ?? ""}
                        onChange={(e) =>
                          updateStep(i, {
                            durationMinutes: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="control numeric h-9 w-20"
                      />
                    </label>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Assign {s.title}</span>
                      <select
                        value={s.assigneeId ?? ""}
                        onChange={(e) => updateStep(i, { assigneeId: e.target.value || undefined })}
                        className="control h-9 w-full text-xs"
                      >
                        <option value="">Same as owner</option>
                        {family.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="Add step"
                value={stepTitle}
                placeholder="Get dressed"
                onChange={(e) => setStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStep();
                  }
                }}
              />
            </div>
            <Action onClick={addStep} ariaLabel="Add step">
              Add
            </Action>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-ink-faint hover:text-destructive text-xs"
            >
              Delete routine
            </button>
          ) : (
            <span />
          )}
          <Action variant="solid" onClick={onSave} disabled={!draft.name.trim()}>
            Save routine
          </Action>
        </div>
      </div>
    </Sheet>
  );
}
