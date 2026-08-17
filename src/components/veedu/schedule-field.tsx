/**
 * The single scheduling control used by tasks and routines.
 *
 * Presentation only — it maps directly onto the canonical Rhythm Engine
 * scheduling model (`scheduleMode` + `relativeAnchor`). No timing is
 * calculated here.
 */

import {
  CANONICAL_RELATIVE_ANCHOR_KEYS,
  RELATIVE_ANCHOR_DEFINITIONS,
  type CanonicalRelativeAnchorKey,
  type RelativePrayerAnchor,
  type ScheduleMode,
} from "@/lib/rhythm-engine";

export type ScheduleValue = {
  scheduleMode: ScheduleMode;
  time?: string | undefined;
  relativeAnchor?: RelativePrayerAnchor | string | undefined;
};

export const EMPTY_SCHEDULE: ScheduleValue = { scheduleMode: "unscheduled" };

const MODES: { id: ScheduleMode; label: string; hint: string }[] = [
  { id: "unscheduled", label: "No time", hint: "Sometime today" },
  { id: "exactTime", label: "Exact time", hint: "At a clock time" },
  { id: "relativePrayer", label: "Around prayer", hint: "Anchored to salah" },
];

export function ScheduleField({
  value,
  onChange,
  idPrefix = "schedule",
}: {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  idPrefix?: string;
}) {
  const mode = value.scheduleMode;
  const anchorKey =
    typeof value.relativeAnchor === "string"
      ? (value.relativeAnchor as CanonicalRelativeAnchorKey)
      : undefined;

  function setMode(next: ScheduleMode) {
    if (next === "unscheduled") {
      onChange({ scheduleMode: "unscheduled", time: undefined, relativeAnchor: undefined });
    } else if (next === "exactTime") {
      onChange({ scheduleMode: "exactTime", time: value.time ?? "", relativeAnchor: undefined });
    } else {
      onChange({
        scheduleMode: "relativePrayer",
        time: undefined,
        relativeAnchor: anchorKey ?? "afterFajr",
      });
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="When should this happen?"
        className="flex flex-wrap gap-1.5"
      >
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={m.hint}
              onClick={() => setMode(m.id)}
              className={`press min-h-9 rounded-full px-3.5 py-1.5 text-[0.78rem] font-medium transition-colors ${
                active
                  ? "bg-space-soft text-foreground ring-1 ring-[var(--space-accent)]/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "exactTime" && (
        <label className="block">
          <span className="eyebrow">Time</span>
          <input
            id={`${idPrefix}-time`}
            type="time"
            value={value.time ?? ""}
            onChange={(e) =>
              onChange({ scheduleMode: "exactTime", time: e.target.value, relativeAnchor: undefined })
            }
            className="control numeric mt-1.5 h-11 w-full sm:w-auto"
          />
        </label>
      )}

      {mode === "relativePrayer" && (
        <div>
          <span className="eyebrow">Prayer anchor</span>
          <div
            role="radiogroup"
            aria-label="Prayer anchor"
            className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3"
          >
            {CANONICAL_RELATIVE_ANCHOR_KEYS.map((key) => {
              const def = RELATIVE_ANCHOR_DEFINITIONS[key];
              const active = key === anchorKey;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={def.description}
                  onClick={() =>
                    onChange({
                      scheduleMode: "relativePrayer",
                      time: undefined,
                      relativeAnchor: key,
                    })
                  }
                  className={`press min-h-9 rounded-xl px-3 py-2 text-left text-[0.78rem] font-medium transition-colors ${
                    active
                      ? "bg-space-soft text-foreground ring-1 ring-[var(--space-accent)]/40"
                      : "text-muted-foreground hover:text-foreground border border-border/60"
                  }`}
                >
                  {def.label}
                </button>
              );
            })}
          </div>
          {anchorKey && (
            <p className="text-ink-faint mt-2 text-xs leading-relaxed">
              {RELATIVE_ANCHOR_DEFINITIONS[anchorKey]?.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Small inline label for an item's schedule — quiet, never decorative. */
export function ScheduleChip({ label }: { label: string }) {
  if (!label) return null;
  return (
    <span className="text-ink-faint numeric bg-space-soft/60 rounded-full px-2 py-0.5 text-[0.68rem]">
      {label}
    </span>
  );
}
