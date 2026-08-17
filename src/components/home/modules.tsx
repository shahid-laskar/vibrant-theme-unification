import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Heart,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Smile,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Action, EmptyState, Field, Meter, Section, Tick } from "@/components/veedu/primitives";
import { ProgressRing } from "@/components/veedu/bento";
import { useLogGroceryRun } from "@/components/budget/history";
import { RecurrenceField, RepeatChip } from "@/components/veedu/recurrence-field";
import {
  EMPTY_SCHEDULE,
  ScheduleField,
  type ScheduleValue,
} from "@/components/veedu/schedule-field";
import { type Recurrence, isRepeating, nextOccurrence, occursOn } from "@/lib/recurrence";
import { todayKey, uid, useStore } from "@/lib/store";
import { type FamilyMember, type Chore } from "@/lib/family-model";
import { rankRecipes } from "@/lib/meal-intelligence";
import { useExperience } from "@/lib/theme-provider";

import {
  type RelativePrayerAnchor,
  type ScheduleMode,
  formatRelativeAnchorLabel,
} from "@/lib/rhythm-engine";

export type Task = {
  id: string;
  title: string;
  list: string;
  time?: string;
  done: boolean;
  date: string;
  recur?: Recurrence;
  completions?: string[];
  assigneeId?: string;
  relativeAnchor?: RelativePrayerAnchor | string;
  scheduleMode?: ScheduleMode;
};
const LISTS = ["General", "Shopping", "Work", "Home"];

/** A repeating task is "done" only for the day you're looking at. */
export function isTaskDone(t: Task, iso = todayKey()) {
  return isRepeating(t.recur) ? (t.completions ?? []).includes(iso) : t.done;
}

export function Tasks() {
  const { experience } = useExperience();
  const [tasks, setTasks] = useStore<Task[]>("tasks", []);
  const [list, setList] = useState("General");
  const [filter, setFilter] = useState<"all" | "today" | "done">("all");
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState<ScheduleValue>({ ...EMPTY_SCHEDULE });
  const [recur, setRecur] = useState<Recurrence>({ freq: "none", start: todayKey() });
  const today = todayKey();

  const listTasks = useMemo(() => tasks.filter((t) => t.list === list), [tasks, list]);
  const listDoneCount = useMemo(
    () => listTasks.filter((t) => isTaskDone(t, today)).length,
    [listTasks, today],
  );
  const listPct = listTasks.length ? Math.round((listDoneCount / listTasks.length) * 100) : 0;

  const visible = listTasks.filter((t) => {
    const done = isTaskDone(t, today);
    if (filter === "done") return done;
    if (filter === "today")
      return !done && (isRepeating(t.recur) ? occursOn(t.recur, today) : t.date <= today);
    return true;
  });

  function toggle(t: Task) {
    setTasks(
      tasks.map((x) => {
        if (x.id !== t.id) return x;
        if (!isRepeating(x.recur)) return { ...x, done: !x.done };
        const days = x.completions ?? [];
        return {
          ...x,
          completions: days.includes(today) ? days.filter((d) => d !== today) : [...days, today],
        };
      }),
    );
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setTasks([
      {
        id: uid(),
        title: title.trim(),
        list,
        time: (schedule.scheduleMode === "exactTime" ? schedule.time : "") ?? "",
        scheduleMode: schedule.scheduleMode,
        ...(schedule.scheduleMode === "relativePrayer" && schedule.relativeAnchor
          ? { relativeAnchor: schedule.relativeAnchor }
          : {}),
        done: false,
        date: today,
        recur: { ...recur },
        completions: [],
      },
      ...tasks,
    ]);
    setTitle("");
    setSchedule({ ...EMPTY_SCHEDULE });
    setRecur({ freq: "none", start: today });
  }

  if (experience === "vibrant") {
    return (
      <div className="space-y-8" data-tone="task">
        {/* ── List Switcher & Filter Controls ── */}
        <section aria-label="Task lists and progress" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="no-scrollbar -mx-2 flex gap-1.5 overflow-x-auto px-2">
              {LISTS.map((l) => {
                const count = tasks.filter((t) => t.list === l).length;
                const active = l === list;
                return (
                  <button
                    key={l}
                    onClick={() => setList(l)}
                    className={`press flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.82rem] font-medium transition-all ${
                      active
                        ? "bg-[var(--tone,var(--space-accent))] text-[oklch(0.995_0.008_70)] shadow-[0_8px_20px_-10px_color-mix(in_oklab,var(--tone,var(--space-accent))_90%,transparent)]"
                        : "bg-[var(--card)] text-ink-soft hover:text-foreground hover:bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_8%,transparent)]"
                    }`}
                  >
                    <span>{l}</span>
                    {count > 0 && (
                      <span
                        className={`numeric rounded-full px-1.5 py-0.2 text-[0.68rem] font-bold ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-black/5 dark:bg-white/10 text-ink-faint"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--card)_80%,transparent)] p-1 border border-border/60">
              {(["all", "today", "done"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`press rounded-full px-3 py-1 text-[0.72rem] font-semibold capitalize transition-colors ${
                    f === filter
                      ? "bg-[var(--tone,var(--space-accent))] text-[oklch(0.995_0.008_70)]"
                      : "text-ink-faint hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List Progress Banner */}
          {listTasks.length > 0 && (
            <div className="tile tile-vivid bloom-in flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3.5">
                <ProgressRing pct={listPct} tone="task" size={54} thickness={5.5}>
                  <span className="numeric text-[0.8rem] font-bold" style={{ color: "var(--tone)" }}>
                    {listPct}%
                  </span>
                </ProgressRing>
                <div>
                  <p className="title-md text-[0.98rem]">
                    {listDoneCount === listTasks.length
                      ? `${list} tasks all settled ✨`
                      : `${listDoneCount} of ${listTasks.length} ${list.toLowerCase()} tasks completed`}
                  </p>
                  <p className="text-ink-soft mt-0.5 text-xs">
                    {listDoneCount === listTasks.length
                      ? "Well done. All clear for now."
                      : `${listTasks.length - listDoneCount} still waiting`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Add Task Form ── */}
        <form
          onSubmit={handleAddTask}
          className="tile bloom-in border border-border/70 p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1">
              <Field
                label={`Add to ${list}`}
                value={title}
                placeholder="Something to take care of…"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold">
              Add Task
            </Action>
          </div>
          <ScheduleField value={schedule} onChange={setSchedule} idPrefix="task-vibrant" />
          <RecurrenceField value={recur} onChange={setRecur} compact />
        </form>

        {/* ── Task Items ── */}
        {visible.length === 0 ? (
          <div className="empty-field bloom-in">
            <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center mx-auto text-[var(--tone,var(--space-accent))] mb-3">
              <CheckCircle2 className="size-6" strokeWidth={2.2} />
            </div>
            <p className="title-md">Nothing waiting in {list}</p>
            <p className="text-ink-soft mt-1 max-w-sm mx-auto text-xs leading-relaxed">
              {filter === "done"
                ? "No completed tasks yet in this list."
                : filter === "today"
                  ? "Nothing specifically due for today in this list."
                  : `Your ${list.toLowerCase()} list is clear. Add the next thing when it comes to mind.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((t) => {
              const done = isTaskDone(t, today);
              const next = isRepeating(t.recur) ? nextOccurrence(t.recur, today) : null;
              return (
                <li
                  key={t.id}
                  data-done={done}
                  className={`row-item group flex items-start gap-3.5 p-3.5 border transition-all ${
                    done
                      ? "border-border/40 bg-card/40 opacity-75"
                      : "border-border/70 bg-card/80 hover:border-[var(--tone,var(--space-accent))]/40"
                  }`}
                >
                  <Tick done={done} label={t.title} onToggle={() => toggle(t)} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={`text-[0.95rem] font-medium leading-snug transition-all ${
                        done ? "text-ink-faint line-through" : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </p>
                    {(() => {
                      const anchorLabel = formatRelativeAnchorLabel(t.relativeAnchor);
                      const timingDisplay = anchorLabel || t.time;
                      if (!timingDisplay && (!next || next === today)) return null;
                      return (
                        <p className="text-ink-faint numeric mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {timingDisplay && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3 text-ink-faint" />
                              {timingDisplay}
                            </span>
                          )}
                          {next && next !== today && <span>next {next}</span>}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RepeatChip recur={t.recur} />
                    <button
                      onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                      aria-label={`Remove ${t.title}`}
                      className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Section eyebrow="Household" title="Tasks">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {LISTS.map((l) => (
          <button
            key={l}
            onClick={() => setList(l)}
            className={`press rounded-full px-3 py-1 text-[0.78rem] ${
              l === list ? "bg-space-soft text-foreground" : "text-muted-foreground"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="bg-rule mx-1 h-4 w-px" />
        {(["all", "today", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`press rounded-full px-2.5 py-1 text-[0.72rem] capitalize ${
              f === filter
                ? "text-foreground underline decoration-[var(--space-accent)] decoration-2 underline-offset-4"
                : "text-ink-faint"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <form onSubmit={handleAddTask} className="mb-6 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label="Add to this list"
              value={title}
              placeholder="Something to take care of…"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Action type="submit" variant="solid" className="h-[42px]">
            Add
          </Action>
        </div>
        <ScheduleField value={schedule} onChange={setSchedule} idPrefix="task-calm" />
        <RecurrenceField value={recur} onChange={setRecur} compact />
      </form>

      {visible.length === 0 ? (
        <EmptyState
          glyph="⌂"
          headline="Nothing waiting here"
          body={`Your ${list.toLowerCase()} list is clear. Add the next thing when it comes to mind.`}
        />
      ) : (
        <ul className="thread space-y-1">
          {visible.map((t) => {
            const done = isTaskDone(t, today);
            const next = isRepeating(t.recur) ? nextOccurrence(t.recur, today) : null;
            return (
              <li
                key={t.id}
                data-done={done}
                className="thread-node group flex items-start gap-3 py-2.5"
              >
                <Tick done={done} label={t.title} onToggle={() => toggle(t)} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[0.95rem] ${done ? "text-ink-faint line-through" : ""}`}>
                    {t.title}
                  </p>
                  {(() => {
                    const anchorLabel = formatRelativeAnchorLabel(t.relativeAnchor);
                    const timingDisplay = anchorLabel || t.time;
                    return (
                      <p className="text-ink-faint numeric text-xs">
                        {[timingDisplay, next && next !== today ? `next ${next}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RepeatChip recur={t.recur} />
                  <button
                    onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                    aria-label={`Remove ${t.title}`}
                    className="text-ink-faint hover:text-destructive text-xs transition-colors p-1"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["Breakfast", "Lunch", "Dinner"];
type Plan = Record<string, string>;

/** ISO-ish week key, e.g. 2026-W33 — used to keep a light history of meal plans. */
export function weekKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function Meals() {
  const { experience } = useExperience();
  const [plan, setPlan] = useStore<Plan>("meals", {});
  const [history, setHistory] = useStore<Record<string, Plan>>("mealsHistory", {});
  const [recipes, setRecipes] = useStore<{ id: string; name: string; items: string }[]>(
    "recipes",
    [],
  );
  const [name, setName] = useState("");
  const [items, setItems] = useState("");
  const thisWeek = weekKey(0);
  const lastWeek = weekKey(-1);
  const previous = history[lastWeek];

  const rankedRecipes = useMemo(() => {
    return rankRecipes(recipes, history, thisWeek);
  }, [recipes, history, thisWeek]);
  const suggestions = rankedRecipes.slice(0, 4);

  function addSuggestion(dishName: string) {
    const slotOrder: string[] = [];
    for (const d of DAYS) {
      slotOrder.push(`${d}-Dinner`);
      slotOrder.push(`${d}-Lunch`);
      slotOrder.push(`${d}-Breakfast`);
    }
    const emptySlot = slotOrder.find((slot) => !plan[slot]);
    if (emptySlot) {
      setPlan({ ...plan, [emptySlot]: dishName });
    }
  }

  // Keep this week's plan in the light history so "copy last week" has something to read.
  useEffect(() => {
    if (Object.keys(plan).length === 0) return;
    if (JSON.stringify(history[thisWeek] ?? {}) === JSON.stringify(plan)) return;
    setHistory({ ...history, [thisWeek]: plan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const todayDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];

  if (experience === "vibrant") {
    const plannedCount = Object.values(plan).filter(Boolean).length;
    const todaySlots = SLOTS.map((s) => ({
      slot: s,
      dish: plan[`${todayDayName}-${s}`],
    })).filter((x) => Boolean(x.dish));

    return (
      <div className="space-y-8" data-tone="meal">
        {/* ── Meal Plan Summary & Suggestions Header ── */}
        <section aria-label="Meal planning header" className="space-y-4">
          <div className="tile tile-vivid bloom-in p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center flex-none">
                <UtensilsCrossed className="size-6 text-[var(--tone,var(--space-accent))]" />
              </div>
              <div>
                <p className="eyebrow" style={{ color: "var(--tone)" }}>
                  Week of {thisWeek} · Family Kitchen
                </p>
                <h2 className="title-md text-[1.1rem] mt-0.5">
                  {plannedCount === 0
                    ? "Plan this week's meals"
                    : `${plannedCount} meal${plannedCount === 1 ? "" : "s"} planned for the week`}
                </h2>
                <p className="text-ink-soft text-xs mt-0.5">
                  {todaySlots.length > 0
                    ? `Tonight: ${todaySlots[todaySlots.length - 1]?.dish}`
                    : "Save family staples, plan calmly, grocery list builds automatically."}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              {previous && (
                <button
                  type="button"
                  onClick={() => setPlan({ ...previous })}
                  className="btn-quiet press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                >
                  <Copy className="size-3.5" />
                  Copy last week
                </button>
              )}
              {plannedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Clear the entire week?")) setPlan({});
                  }}
                  className="icon-btn press size-8 text-ink-faint hover:text-destructive"
                  title="Clear week"
                  aria-label="Clear week"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Smart Recipe Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-ink-faint text-xs font-semibold flex items-center gap-1">
                <Sparkles className="size-3 text-[var(--tone,var(--space-accent))]" />
                Ideas:
              </span>
              {suggestions.map((s) => (
                <button
                  key={s.recipe.id}
                  type="button"
                  onClick={() => addSuggestion(s.recipe.name)}
                  className="press rounded-full border border-border/80 bg-card/70 hover:bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_12%,transparent)] hover:border-[var(--tone,var(--space-accent))]/40 px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  title={
                    s.lastUsedWeek
                      ? `Click to add · Used in ${s.lastUsedWeek} (${s.historicalCount}x historically)`
                      : `Click to add · Fresh idea (${s.historicalCount}x recorded)`
                  }
                >
                  <Plus className="size-3 text-[var(--tone,var(--space-accent))]" />
                  <span>{s.recipe.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Datalist for autocomplete */}
        <datalist id="saved-recipes">
          {rankedRecipes.map((r) => (
            <option key={r.recipe.id} value={r.recipe.name} />
          ))}
        </datalist>

        {/* ── Weekly Planner Table / Board ── */}
        <section aria-label="Weekly planner" className="tile bloom-in border border-border/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="title-md text-[1rem]">Weekly Menu</h3>
            <span className="text-ink-faint text-xs">Type dish or pick from saved</span>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[560px] border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="eyebrow w-20 text-left pl-2">Day</th>
                  {SLOTS.map((s) => (
                    <th key={s} className="eyebrow text-left pl-1">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => {
                  const isToday = d === todayDayName;
                  return (
                    <tr
                      key={d}
                      className={`transition-colors ${
                        isToday
                          ? "bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_12%,transparent)] font-medium"
                          : "bg-card/60 hover:bg-card"
                      }`}
                    >
                      <td
                        className={`py-2.5 pl-3.5 pr-3 text-sm rounded-l-xl border-y border-l ${
                          isToday
                            ? "border-[var(--tone,var(--space-accent))]/30 text-foreground font-bold"
                            : "border-border/60 text-ink-soft"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{d}</span>
                          {isToday && (
                            <span className="size-1.5 rounded-full bg-[var(--tone,var(--space-accent))]" />
                          )}
                        </div>
                      </td>
                      {SLOTS.map((s, i) => {
                        const key = `${d}-${s}`;
                        const isLast = i === SLOTS.length - 1;
                        return (
                          <td
                            key={s}
                            className={`py-1.5 px-2 border-y ${
                              isLast ? "border-r rounded-r-xl" : ""
                            } ${
                              isToday
                                ? "border-[var(--tone,var(--space-accent))]/30"
                                : "border-border/60"
                            }`}
                          >
                            <input
                              aria-label={`${d} ${s}`}
                              list="saved-recipes"
                              value={plan[key] ?? ""}
                              placeholder="—"
                              onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}
                              className="w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-ink-faint/40 focus:bg-background/80 rounded-lg transition-colors"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Recipe Repository ── */}
        <section aria-label="Saved recipes" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="title-md text-[1rem]">Family Recipes</h3>
              <p className="text-ink-soft text-xs mt-0.5">
                Saved dishes used for autocompletion and grocery list generation.
              </p>
            </div>
            <span className="numeric text-ink-faint text-xs font-semibold">
              {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setRecipes([{ id: uid(), name: name.trim(), items }, ...recipes]);
              setName("");
              setItems("");
            }}
            className="tile bloom-in border border-border/70 p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
          >
            <Field
              label="Dish Name"
              value={name}
              placeholder="e.g. Chicken Biryani, Dal Tadka…"
              onChange={(e) => setName(e.target.value)}
            />
            <Field
              label="Ingredients (comma separated)"
              value={items}
              placeholder="Rice, spices, onion, ghee…"
              onChange={(e) => setItems(e.target.value)}
            />
            <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold">
              Save Recipe
            </Action>
          </form>

          {recipes.length === 0 ? (
            <div className="empty-field bloom-in">
              <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center mx-auto text-[var(--tone,var(--space-accent))] mb-3">
                <UtensilsCrossed className="size-6" strokeWidth={2.2} />
              </div>
              <p className="title-md">No family recipes saved yet</p>
              <p className="text-ink-soft mt-1 max-w-sm mx-auto text-xs leading-relaxed">
                Save the meals your family loves. When you plan meals with them, ingredients automatically sync to your grocery list.
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {recipes.map((r) => (
                <div
                  key={r.id}
                  className="row-item group flex items-start justify-between gap-3 p-3.5 border border-border/70 bg-card/70 hover:border-[var(--tone,var(--space-accent))]/40 transition-all rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="title-md text-[0.95rem] truncate">{r.name}</p>
                    <p className="text-ink-faint text-xs mt-1 line-clamp-2">
                      {r.items || "No ingredients noted"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => addSuggestion(r.name)}
                      className="icon-btn press size-7 text-[var(--tone,var(--space-accent))]"
                      title={`Add ${r.name} to plan`}
                      aria-label={`Add ${r.name} to plan`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipes(recipes.filter((x) => x.id !== r.id))}
                      className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors"
                      title={`Remove ${r.name}`}
                      aria-label={`Remove ${r.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Section
        eyebrow="This week"
        title="Meal plan"
        aside={
          <div className="flex items-center gap-3">
            {previous && (
              <button
                onClick={() => setPlan({ ...previous })}
                className="text-ink-faint hover:text-foreground text-xs transition"
              >
                Copy last week
              </button>
            )}
            {Object.keys(plan).length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear the entire week?")) setPlan({});
                }}
                className="text-ink-faint hover:text-destructive text-xs transition"
              >
                Clear week
              </button>
            )}
          </div>
        }
      >
        {suggestions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-ink-faint text-xs mr-1">Suggestions:</span>
            {suggestions.map((s) => (
              <button
                key={s.recipe.id}
                type="button"
                onClick={() => addSuggestion(s.recipe.name)}
                className="press bg-space-soft/60 hover:bg-space-soft text-foreground rounded-full px-2.5 py-0.5 text-xs inline-flex items-center gap-1 cursor-pointer transition"
                title={
                  s.lastUsedWeek
                    ? `Click to add · Used in ${s.lastUsedWeek} (${s.historicalCount}x historically)`
                    : `Click to add · Fresh idea (${s.historicalCount}x recorded)`
                }
              >
                + {s.recipe.name}
              </button>
            ))}
          </div>
        )}

        <datalist id="saved-recipes">
          {rankedRecipes.map((r) => (
            <option key={r.recipe.id} value={r.recipe.name} />
          ))}
        </datalist>
        <div className="overflow-x-auto no-scrollbar -mx-5 px-5">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th className="eyebrow w-20 text-left"> </th>
                {SLOTS.map((s) => (
                  <th key={s} className="eyebrow text-left">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => {
                const isToday =
                  d === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
                return (
                  <tr key={d} className={isToday ? "bg-space-soft/30 rounded-lg" : ""}>
                    <td
                      className={`font-display pr-3 text-sm rounded-l-lg py-1 pl-2 ${isToday ? "text-foreground font-semibold" : "text-ink-soft"}`}
                    >
                      {d}
                    </td>
                    {SLOTS.map((s, i) => (
                      <td
                        key={s}
                        className={`pr-2 ${i === SLOTS.length - 1 ? "rounded-r-lg" : ""}`}
                      >
                        <input
                          aria-label={`${d} ${s}`}
                          list="saved-recipes"
                          value={plan[`${d}-${s}`] ?? ""}
                          placeholder="—"
                          onChange={(e) => setPlan({ ...plan, [`${d}-${s}`]: e.target.value })}
                          className={`w-full border-b bg-transparent py-1.5 text-sm outline-none transition-colors ${
                            isToday
                              ? "border-border/80 focus:border-space"
                              : "border-border/50 focus:border-space"
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Repository" title="Recipes">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setRecipes([{ id: uid(), name: name.trim(), items }, ...recipes]);
            setName("");
            setItems("");
          }}
          className="mb-5 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
        >
          <Field label="Dish" value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Ingredients (comma separated)"
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
          <Action type="submit" variant="solid" className="h-[42px]">
            Save
          </Action>
        </form>
        {recipes.length === 0 ? (
          <EmptyState
            glyph="✧"
            headline="No recipes yet"
            body="Save the meals your family actually eats — grocery lists build themselves from here."
          />
        ) : (
          <ul className="divide-border/70 divide-y">
            {recipes.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <p className="title-md">{r.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.items || "No ingredients noted"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => addSuggestion(r.name)}
                    className="text-space hover:underline text-xs cursor-pointer"
                  >
                    + Add to plan
                  </button>
                  <button
                    onClick={() => setRecipes(recipes.filter((x) => x.id !== r.id))}
                    className="text-ink-faint hover:text-destructive text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

type Grocery = { id: string; name: string; got: boolean };

export function GroceryList() {
  const { experience } = useExperience();
  const [items, setItems] = useStore<Grocery[]>("grocery", []);
  const [plan] = useStore<Plan>("meals", {});
  const [recipes] = useStore<{ id: string; name: string; items: string }[]>("recipes", []);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"all" | "needed" | "got">("all");

  const remaining = items.filter((i) => !i.got).length;
  const gotCount = items.length - remaining;
  const pct = items.length ? Math.round((gotCount / items.length) * 100) : 0;

  function generate() {
    const planned = new Set(
      Object.values(plan)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
    const derived: string[] = [];
    recipes.forEach((r) => {
      if (planned.has(r.name.trim().toLowerCase())) {
        r.items.split(",").forEach((i) => i.trim() && derived.push(i.trim()));
      }
    });
    const existing = new Set(items.map((i) => i.name.toLowerCase()));
    const fresh = [...new Set(derived)]
      .filter((d) => !existing.has(d.toLowerCase()))
      .map((name) => ({ id: uid(), name, got: false }));
    setItems([...fresh, ...items]);
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setItems([{ id: uid(), name: draft.trim(), got: false }, ...items]);
    setDraft("");
  }

  const visible = items.filter((i) => {
    if (filter === "needed") return !i.got;
    if (filter === "got") return i.got;
    return true;
  });

  if (experience === "vibrant") {
    return (
      <div className="space-y-8" data-tone="grocery">
        {/* ── Shopping Overview & Quick Generation Header ── */}
        <section aria-label="Grocery list header" className="space-y-4">
          <div className="tile tile-vivid bloom-in p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {items.length > 0 ? (
                <ProgressRing pct={pct} tone="grocery" size={56} thickness={5.5}>
                  <span className="numeric text-[0.8rem] font-bold" style={{ color: "var(--tone)" }}>
                    {pct}%
                  </span>
                </ProgressRing>
              ) : (
                <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center flex-none">
                  <ShoppingBasket className="size-6 text-[var(--tone,var(--space-accent))]" />
                </div>
              )}
              <div>
                <p className="eyebrow" style={{ color: "var(--tone)" }}>
                  Household Shopping
                </p>
                <h2 className="title-md text-[1.1rem] mt-0.5">
                  {items.length === 0
                    ? "The basket is empty"
                    : remaining === 0
                      ? "All items picked up! 🧺"
                      : `${remaining} of ${items.length} items left to pick up`}
                </h2>
                <p className="text-ink-soft text-xs mt-0.5">
                  {items.length === 0
                    ? "Add items manually or let Sunnah Home pull ingredients from your meal plan."
                    : `${gotCount} item${gotCount === 1 ? "" : "s"} already in basket`}
                </p>
              </div>
            </div>

            {/* From Meal Plan Action */}
            <button
              type="button"
              onClick={generate}
              className="btn-quiet press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold self-end sm:self-center"
            >
              <Sparkles className="size-3.5 text-[var(--tone,var(--space-accent))]" />
              From meal plan
            </button>
          </div>

          {/* Filter Pills */}
          {items.length > 0 && (
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: `All (${items.length})` },
                { id: "needed", label: `To buy (${remaining})` },
                { id: "got", label: `In basket (${gotCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id as any)}
                  className={`press rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    filter === f.id
                      ? "bg-[var(--tone,var(--space-accent))] text-[oklch(0.995_0.008_70)] shadow-[0_4px_14px_-6px_color-mix(in_oklab,var(--tone,var(--space-accent))_80%,transparent)]"
                      : "bg-card/70 border border-border/70 text-ink-soft hover:text-foreground hover:bg-card"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Add Item Form ── */}
        <form
          onSubmit={handleAddItem}
          className="tile bloom-in border border-border/70 p-4 sm:p-5 flex items-end gap-2.5"
        >
          <div className="flex-1">
            <Field
              label="Add to shopping list"
              value={draft}
              placeholder="e.g. Milk, olive oil, bananas, sourdough…"
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold">
            Add Item
          </Action>
        </form>

        {/* ── Items List / Empty State ── */}
        {items.length === 0 ? (
          <div className="empty-field bloom-in">
            <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center mx-auto text-[var(--tone,var(--space-accent))] mb-3">
              <ShoppingBasket className="size-6" strokeWidth={2.2} />
            </div>
            <p className="title-md">Nothing on the shopping list</p>
            <p className="text-ink-soft mt-1 max-w-sm mx-auto text-xs leading-relaxed">
              Add items above, or tap "From meal plan" to automatically pull the ingredients needed for this week's planned dishes.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={generate}
                className="btn-solid press inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold"
              >
                <Sparkles className="size-4" />
                Build from meal plan
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {visible.map((i) => (
                <li
                  key={i.id}
                  data-done={i.got}
                  className={`row-item group flex items-center justify-between gap-3 p-3.5 border transition-all ${
                    i.got
                      ? "border-border/40 bg-card/40 opacity-75"
                      : "border-border/70 bg-card/80 hover:border-[var(--tone,var(--space-accent))]/40"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <Tick
                      done={i.got}
                      label={i.name}
                      onToggle={() =>
                        setItems(items.map((x) => (x.id === i.id ? { ...x, got: !x.got } : x)))
                      }
                    />
                    <span
                      className={`text-[0.95rem] font-medium truncate ${
                        i.got ? "text-ink-faint line-through" : "text-foreground"
                      }`}
                    >
                      {i.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((x) => x.id !== i.id))}
                    aria-label={`Remove ${i.name}`}
                    className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Vibrant Grocery Run */}
            <VibrantGroceryRun />
          </div>
        )}
      </div>
    );
  }

  return (
    <Section
      eyebrow="Shopping"
      title="Grocery"
      aside={<Action onClick={generate}>From meal plan</Action>}
    >
      <form
        onSubmit={handleAddItem}
        className="mb-5"
      >
        <Field
          label="Add item"
          value={draft}
          placeholder="Rice, onions, olive oil…"
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
      {items.length === 0 ? (
        <EmptyState
          glyph="◦"
          headline="The basket is empty"
          body="Add what's missing, or let Sunnah Home read this week's meal plan and fill it for you."
          action={
            <Action variant="solid" onClick={generate}>
              Build from meal plan
            </Action>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-muted-foreground text-xs">
              {remaining} of {items.length} still to pick up
            </p>
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: `All (${items.length})` },
                { id: "needed", label: `To buy (${remaining})` },
                { id: "got", label: `In basket (${gotCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id as "all" | "needed" | "got")}
                  className={`press rounded-full px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${
                    filter === f.id
                      ? "bg-space text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-space-soft/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-0.5">
            {visible.map((i) => (
              <li key={i.id} className="group flex items-center gap-3 py-2">
                <Tick
                  done={i.got}
                  label={i.name}
                  onToggle={() =>
                    setItems(items.map((x) => (x.id === i.id ? { ...x, got: !x.got } : x)))
                  }
                />
                <span
                  className={`flex-1 text-[0.95rem] ${i.got ? "text-ink-faint line-through" : ""}`}
                >
                  {i.name}
                </span>
                <button
                  onClick={() => setItems(items.filter((x) => x.id !== i.id))}
                  className="text-ink-faint hover:text-destructive text-xs transition-colors cursor-pointer p-1"
                  aria-label={`Remove ${i.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <GroceryRun />
        </>
      )}
    </Section>
  );
}

function VibrantGroceryRun() {
  const { picked, log } = useLogGroceryRun();
  const [amount, setAmount] = useState("");
  const [logged, setLogged] = useState<string | null>(null);

  if (picked.length === 0)
    return (
      <p className="text-ink-faint mt-4 text-center text-xs">
        Tick items as you shop — Sunnah Home can log the completed run straight to Budget.
      </p>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(amount);
        if (log(value)) {
          setLogged(`₹${value} logged to Groceries · basket settled!`);
          setAmount("");
          setTimeout(() => setLogged(null), 3000);
        }
      }}
      className="tile tile-vivid bloom-in border border-border/70 p-5 space-y-3 mt-6"
    >
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_18%,transparent)] grid place-items-center flex-none">
          <Wallet className="size-4 text-[var(--tone,var(--space-accent))]" />
        </div>
        <div>
          <p className="title-md text-[0.98rem]">Log Run to Budget</p>
          <p className="text-ink-soft text-xs">
            {picked.length} item{picked.length === 1 ? "" : "s"} ready in basket. Record amount spent to settle the list and update Groceries budget.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2.5 pt-1">
        <div className="flex-1">
          <Field
            label="Total Amount Spent (₹)"
            type="number"
            value={amount}
            placeholder="e.g. 1250"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold flex-none">
          Log to Budget
        </Action>
      </div>
      {logged && (
        <p className="text-space font-medium mt-2 text-xs flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          {logged}
        </p>
      )}
    </form>
  );
}

/** PROTOTYPE — the shopping run flows straight into Budget instead of being retyped. */
function GroceryRun() {
  const { picked, log } = useLogGroceryRun();
  const [amount, setAmount] = useState("");
  const [logged, setLogged] = useState<string | null>(null);

  if (picked.length === 0)
    return (
      <p className="text-ink-faint mt-6 text-xs">
        Tick what you've picked up — Sunnah Home can log the run as an expense.
      </p>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(amount);
        if (log(value)) {
          setLogged(`₹${value} logged to Groceries · list cleared`);
          setAmount("");
          setTimeout(() => setLogged(null), 3000);
        }
      }}
      className="border-border/70 mt-7 rounded-2xl border p-4"
    >
      <p className="eyebrow">Finished shopping</p>
      <p className="text-muted-foreground mt-1 mb-3 text-sm">
        {picked.length} item{picked.length === 1 ? "" : "s"} in the basket. Log what it cost and
        Budget picks it up.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Amount spent"
            type="number"
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Action type="submit" variant="solid" className="h-[42px]">
          Log to Budget
        </Action>
      </div>
      {logged && <p className="text-space mt-3 text-xs">{logged}</p>}
    </form>
  );
}

export function isChoreDone(c: Chore, iso = todayKey()) {
  return isRepeating(c.recur) ? (c.completions ?? []).includes(iso) : c.done;
}

export function Kids() {
  const { experience } = useExperience();
  const [family, setFamily] = useStore<FamilyMember[]>("family", []);
  const kids = family.filter((f) => f.role === "child");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const today = todayKey();

  const routineTotal = kids.reduce(
    (s, k) => s + k.chores.filter((c) => !isRepeating(c.recur) || occursOn(c.recur, today)).length,
    0,
  );
  const routineDone = kids.reduce(
    (s, k) =>
      s +
      k.chores.filter(
        (c) => (!isRepeating(c.recur) || occursOn(c.recur, today)) && isChoreDone(c, today),
      ).length,
    0,
  );
  const routinePct = routineTotal > 0 ? Math.round((routineDone / routineTotal) * 100) : 0;

  function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setFamily([...family, { id: uid(), name: name.trim(), role: "child", age, chores: [] }]);
    setName("");
    setAge("");
  }

  if (experience === "vibrant") {
    return (
      <div className="space-y-8" data-tone="kids">
        {/* ── Family & Children Overview Header ── */}
        <section aria-label="Kids routines overview" className="space-y-4">
          <div className="tile tile-vivid bloom-in p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {routineTotal > 0 ? (
                <ProgressRing pct={routinePct} tone="kids" size={56} thickness={5.5}>
                  <span className="numeric text-[0.8rem] font-bold" style={{ color: "var(--tone)" }}>
                    {routinePct}%
                  </span>
                </ProgressRing>
              ) : (
                <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center flex-none">
                  <Smile className="size-6 text-[var(--tone,var(--space-accent))]" />
                </div>
              )}
              <div>
                <p className="eyebrow" style={{ color: "var(--tone)" }}>
                  Family & Routines
                </p>
                <h2 className="title-md text-[1.1rem] mt-0.5">
                  {kids.length === 0
                    ? "Children & Daily Routines"
                    : routineTotal === 0
                      ? `${kids.length} child${kids.length === 1 ? "" : "ren"} added · no routines due`
                      : routineDone === routineTotal
                        ? "All daily routines completed! 🌟"
                        : `${routineDone} of ${routineTotal} routines done today`}
                </h2>
                <p className="text-ink-soft text-xs mt-0.5">
                  {kids.length === 0
                    ? "Add your children to guide daily habits, small responsibilities, and Islamic routines."
                    : `${kids.length} child${kids.length === 1 ? "" : "ren"} active`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Add Child Form ── */}
        <form
          onSubmit={handleAddChild}
          className="tile bloom-in border border-border/70 p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end"
        >
          <Field
            label="Child Name"
            value={name}
            placeholder="e.g. Maryam, Zayd…"
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Age (optional)"
            value={age}
            placeholder="e.g. 7"
            onChange={(e) => setAge(e.target.value)}
          />
          <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold">
            Add Child
          </Action>
        </form>

        {/* ── Children List / Empty State ── */}
        {kids.length === 0 ? (
          <div className="empty-field bloom-in">
            <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center mx-auto text-[var(--tone,var(--space-accent))] mb-3">
              <Smile className="size-6" strokeWidth={2.2} />
            </div>
            <p className="title-md">No little ones added yet</p>
            <p className="text-ink-soft mt-1 max-w-sm mx-auto text-xs leading-relaxed">
              Add your children above to track their daily routines, chores, and the small wins worth noticing together.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {kids.map((k) => (
              <VibrantKidCard
                key={k.id}
                kid={k}
                today={today}
                onRemoveKid={() => setFamily(family.filter((x) => x.id !== k.id))}
                onChangeChores={(chores) =>
                  setFamily(family.map((x) => (x.id === k.id ? { ...x, chores } : x)))
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Section
      eyebrow="Family"
      title="Kids"
      aside={
        routineTotal > 0 ? (
          <span className="text-ink-faint numeric text-xs">
            {routineDone}/{routineTotal} done today
          </span>
        ) : undefined
      }
    >
      <form
        onSubmit={handleAddChild}
        className="mb-6 grid gap-2 sm:grid-cols-[1fr_100px_auto] sm:items-end"
      >
        <Field label="Child" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Age" value={age} onChange={(e) => setAge(e.target.value)} />
        <Action type="submit" variant="solid" className="h-[42px]">
          Add
        </Action>
      </form>

      {kids.length === 0 ? (
        <EmptyState
          glyph="❋"
          headline="No little ones added"
          body="Add a child to track routines, chores and the small wins worth noticing."
        />
      ) : (
        <div className="space-y-8">
          {kids.map((k) => (
            <div key={k.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="title-md">
                  {k.name}
                  {k.age && <span className="text-ink-faint text-sm font-normal"> · {k.age}</span>}
                </h3>
                <button
                  onClick={() => setFamily(family.filter((x) => x.id !== k.id))}
                  className="text-ink-faint hover:text-destructive text-xs"
                >
                  Remove
                </button>
              </div>
              <ChoreList
                kid={k}
                onChange={(chores) =>
                  setFamily(family.map((x) => (x.id === k.id ? { ...x, chores } : x)))
                }
              />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function VibrantKidCard({
  kid,
  today,
  onRemoveKid,
  onChangeChores,
}: {
  kid: FamilyMember;
  today: string;
  onRemoveKid: () => void;
  onChangeChores: (c: Chore[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [recur, setRecur] = useState<Recurrence>({ freq: "daily", start: todayKey() });

  const visible = kid.chores.filter((c) => !isRepeating(c.recur) || occursOn(c.recur, today));
  const doneCount = visible.filter((c) => isChoreDone(c, today)).length;

  function toggle(c: Chore) {
    onChangeChores(
      kid.chores.map((x) => {
        if (x.id !== c.id) return x;
        if (!isRepeating(x.recur)) return { ...x, done: !x.done };
        const days = x.completions ?? [];
        return {
          ...x,
          completions: days.includes(today) ? days.filter((d) => d !== today) : [...days, today],
        };
      }),
    );
  }

  function handleAddChore(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onChangeChores([
      ...kid.chores,
      { id: uid(), title: draft.trim(), done: false, recur: { ...recur }, completions: [] },
    ]);
    setDraft("");
  }

  return (
    <div className="tile bloom-in border border-border/70 p-5 space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center font-bold text-foreground">
            {kid.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="title-md text-[1.05rem] flex items-center gap-2">
              <span>{kid.name}</span>
              {kid.age && (
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-normal border border-border/60 text-ink-soft">
                  Age {kid.age}
                </span>
              )}
            </h3>
            {visible.length > 0 && (
              <p className="text-ink-soft text-xs mt-0.5">
                {doneCount === visible.length
                  ? "All daily routines completed ✨"
                  : `${doneCount} of ${visible.length} routines done`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {visible.length > 0 && (
            <span
              className="numeric text-xs font-semibold px-2.5 py-1 rounded-full bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_12%,transparent)]"
              style={{ color: "var(--tone)" }}
            >
              {doneCount}/{visible.length}
            </span>
          )}
          <button
            type="button"
            onClick={onRemoveKid}
            className="icon-btn press size-7 text-ink-faint hover:text-destructive"
            title={`Remove ${kid.name}`}
            aria-label={`Remove ${kid.name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Chores List */}
      {visible.length === 0 ? (
        <p className="text-ink-faint text-xs py-2 italic">
          No routines or chores set for today.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => {
            const done = isChoreDone(c, today);
            return (
              <li
                key={c.id}
                data-done={done}
                className={`row-item group flex items-center justify-between gap-3 p-3 border transition-all ${
                  done
                    ? "border-border/40 bg-card/40 opacity-75"
                    : "border-border/70 bg-card/80 hover:border-[var(--tone,var(--space-accent))]/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Tick done={done} label={c.title} onToggle={() => toggle(c)} />
                  <span
                    className={`text-[0.92rem] font-medium truncate ${
                      done ? "text-ink-faint line-through" : "text-foreground"
                    }`}
                  >
                    {c.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RepeatChip recur={c.recur} />
                  <button
                    type="button"
                    onClick={() => onChangeChores(kid.chores.filter((x) => x.id !== c.id))}
                    aria-label={`Remove ${c.title}`}
                    className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add Chore Form */}
      <form onSubmit={handleAddChore} className="space-y-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add a routine for ${kid.name}…`}
            className="control text-sm h-[38px] flex-1 px-3"
          />
          <Action type="submit" variant="solid" className="btn-solid h-[38px] px-4 font-bold text-xs">
            Add
          </Action>
        </div>
        <RecurrenceField value={recur} onChange={setRecur} compact />
      </form>
    </div>
  );
}

function ChoreList({ kid, onChange }: { kid: FamilyMember; onChange: (c: Chore[]) => void }) {
  const [draft, setDraft] = useState("");
  const [recur, setRecur] = useState<Recurrence>({ freq: "daily", start: todayKey() });
  const today = todayKey();

  function toggle(c: Chore) {
    onChange(
      kid.chores.map((x) => {
        if (x.id !== c.id) return x;
        if (!isRepeating(x.recur)) return { ...x, done: !x.done };
        const days = x.completions ?? [];
        return {
          ...x,
          completions: days.includes(today) ? days.filter((d) => d !== today) : [...days, today],
        };
      }),
    );
  }

  const visible = kid.chores.filter((c) => !isRepeating(c.recur) || occursOn(c.recur, today));

  return (
    <div className="thread">
      {visible.map((c) => {
        const done = isChoreDone(c, today);
        return (
          <div
            key={c.id}
            data-done={done}
            className="thread-node group flex items-center gap-3 py-2"
          >
            <Tick done={done} label={c.title} onToggle={() => toggle(c)} />
            <span className={`flex-1 text-[0.95rem] ${done ? "text-ink-faint line-through" : ""}`}>
              {c.title}
            </span>
            <RepeatChip recur={c.recur} />
            <button
              onClick={() => onChange(kid.chores.filter((x) => x.id !== c.id))}
              aria-label={`Remove ${c.title}`}
              className="text-ink-faint hover:text-destructive text-xs transition-colors p-1"
            >
              Remove
            </button>
          </div>
        );
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([
            ...kid.chores,
            { id: uid(), title: draft.trim(), done: false, recur: { ...recur }, completions: [] },
          ]);
          setDraft("");
        }}
        className="thread-node space-y-2 py-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a routine or chore"
          className="text-ink-faint placeholder:text-ink-faint focus:text-foreground w-full bg-transparent text-sm outline-none"
        />
        <RecurrenceField value={recur} onChange={setRecur} compact />
      </form>
    </div>
  );
}

export function Deeds() {
  const { experience } = useExperience();
  const [deeds, setDeeds] = useStore<{ id: string; who: string; what: string; date: string }[]>(
    "deeds",
    [],
  );
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");

  function handleAddDeed(e: React.FormEvent) {
    e.preventDefault();
    if (!what.trim()) return;
    setDeeds([
      { id: uid(), who: who.trim() || "Family", what: what.trim(), date: todayKey() },
      ...deeds,
    ]);
    setWhat("");
  }

  function handleDeleteDeed(id: string) {
    setDeeds(deeds.filter((x) => x.id !== id));
  }

  if (experience === "vibrant") {
    return (
      <div className="space-y-8" data-tone="habit">
        {/* ── Deeds Overview Banner ── */}
        <section aria-label="Good deeds overview" className="space-y-4">
          <div className="tile tile-vivid bloom-in p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center flex-none">
                <Heart className="size-6 text-[var(--tone,var(--space-accent))]" />
              </div>
              <div>
                <p className="eyebrow" style={{ color: "var(--tone)" }}>
                  Spiritual Atmosphere · Good Deeds
                </p>
                <h2 className="title-md text-[1.1rem] mt-0.5">
                  {deeds.length === 0
                    ? "Notice the good in each other"
                    : `${deeds.length} good deed${deeds.length === 1 ? "" : "s"} noticed & recorded`}
                </h2>
                <p className="text-ink-soft text-xs mt-0.5">
                  Small kindnesses build a blessed home. Every act of khayr is remembered.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Record Deed Form ── */}
        <form
          onSubmit={handleAddDeed}
          className="tile bloom-in border border-border/70 p-4 sm:p-5 grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end"
        >
          <Field
            label="Who"
            value={who}
            placeholder="e.g. Maryam, Dad…"
            onChange={(e) => setWho(e.target.value)}
          />
          <Field
            label="What they did"
            value={what}
            placeholder="e.g. Made tea for everyone, helped with Quran revision, gave charity…"
            onChange={(e) => setWhat(e.target.value)}
          />
          <Action type="submit" variant="solid" className="btn-solid h-[42px] px-5 font-bold">
            Record
          </Action>
        </form>

        {/* ── Deeds Stream / Empty State ── */}
        {deeds.length === 0 ? (
          <div className="empty-field bloom-in">
            <div className="size-12 rounded-2xl bg-[color-mix(in_oklab,var(--tone,var(--space-accent))_15%,transparent)] grid place-items-center mx-auto text-[var(--tone,var(--space-accent))] mb-3">
              <Heart className="size-6" strokeWidth={2.2} />
            </div>
            <p className="title-md">Nothing recorded yet</p>
            <p className="text-ink-soft mt-1 max-w-sm mx-auto text-xs leading-relaxed">
              Small kindnesses are easy to forget in the rush of daily life. Record one above to keep the warmth alive.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {deeds.map((d) => (
              <li
                key={d.id}
                className="row-item group flex items-start justify-between gap-4 p-4 border border-border/70 bg-card/70 hover:border-[var(--tone,var(--space-accent))]/40 transition-all rounded-xl"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[0.98rem] font-medium text-foreground leading-snug">
                    {d.what}
                  </p>
                  <p className="numeric text-ink-faint text-xs flex items-center gap-2">
                    <span className="font-semibold text-[var(--tone,var(--space-accent))]">
                      {d.who}
                    </span>
                    <span>·</span>
                    <span>{d.date}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteDeed(d.id)}
                  aria-label={`Remove deed by ${d.who}`}
                  className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Section eyebrow="Noticed" title="Good deeds">
      <form
        onSubmit={handleAddDeed}
        className="mb-6 grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end"
      >
        <Field label="Who" value={who} onChange={(e) => setWho(e.target.value)} />
        <Field label="What they did" value={what} onChange={(e) => setWhat(e.target.value)} />
        <Action type="submit" variant="solid" className="h-[42px]">
          Record
        </Action>
      </form>
      {deeds.length === 0 ? (
        <EmptyState
          glyph="✧"
          headline="Nothing recorded yet"
          body="Small kindnesses are easy to forget. Write one down and it stays."
        />
      ) : (
        <ul className="thread">
          {deeds.map((d) => (
            <li
              key={d.id}
              data-active="true"
              className="thread-node group flex items-start justify-between gap-4 py-3"
            >
              <div>
                <p className="text-[0.95rem]">{d.what}</p>
                <p className="text-ink-faint numeric text-xs">
                  {d.who} · {d.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteDeed(d.id)}
                aria-label={`Remove deed by ${d.who}`}
                className="icon-btn press size-7 text-ink-faint hover:text-destructive transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* Calendar and Notes now live in ./calendar.tsx and ./notes.tsx — richer versions of both. */

export function TodayGlance() {
  const [tasks] = useStore<Task[]>("tasks", []);
  const [grocery] = useStore<Grocery[]>("grocery", []);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Eyebrowed label="Tasks completed" value={`${done}/${tasks.length || 0}`} />
        <Meter value={tasks.length ? (done / tasks.length) * 100 : 0} />
      </div>
      <div>
        <Eyebrowed
          label="Grocery picked up"
          value={`${grocery.filter((g) => g.got).length}/${grocery.length || 0}`}
        />
        <Meter
          value={grocery.length ? (grocery.filter((g) => g.got).length / grocery.length) * 100 : 0}
        />
      </div>
    </div>
  );
}

function Eyebrowed({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <span className="eyebrow">{label}</span>
      <span className="numeric font-display text-lg">{value}</span>
    </div>
  );
}
