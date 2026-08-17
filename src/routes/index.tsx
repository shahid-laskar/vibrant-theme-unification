import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, type ComponentType, type CSSProperties, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Moon,
  ShoppingBasket,
  Sparkles,
  Sun,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  BentoHeading,
  IconChip,
  ProgressRing,
  RowTile,
  StatTile,
  Tile,
  type Tone,
} from "@/components/veedu/bento";
import { Shell } from "@/components/veedu/shell";
import { SubTabs, Section, EmptyState } from "@/components/veedu/primitives";
import { TimeBand, ProgressLine, Status } from "@/components/veedu/phase4";
import {
  Deeds,
  GroceryList,
  Kids,
  Meals,
  Tasks,
  isTaskDone,
  type Task,
} from "@/components/home/modules";
import { Notes } from "@/components/home/notes";
import { Routines } from "@/components/home/routines";
import type { Routine } from "@/lib/routine-engine";
import { UnifiedCalendar, eventsOn, type CalEvent } from "@/components/home/calendar";
import { Reminders, useReminderEngine } from "@/components/home/reminders";
import { useNextPrayer, usePrayers, useSalah } from "@/components/deen/modules";
import { isRepeating, occursOn } from "@/lib/recurrence";
import { useTab } from "@/lib/use-tab";
import { todayKey, useNow, useStore } from "@/lib/store";
import { useFamilyMigration } from "@/lib/family-model";
import { buildDailyThread, type DailyThreadItem } from "@/lib/daily-surface";
import { useRamadanMode } from "@/lib/ramadan";
import { hijriLabel, islamicMarker } from "@/lib/hijri";
import { useExperience } from "@/lib/theme-provider";
import type { HifzItem } from "@/lib/hifz-scheduler";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sunnah Home — a handcrafted home for everyday life" },
      {
        name: "description",
        content:
          "Sunnah Home brings family life, prayer, money and personal wellbeing into one calm, beautifully made daily companion.",
      },
      { property: "og:title", content: "Sunnah Home — a handcrafted home for everyday life" },
      {
        property: "og:description",
        content:
          "Family, Deen, budget and wellbeing in one quiet daily companion. Offline-first, private by default.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const TABS = [
  { id: "today", label: "Today" },
  { id: "tasks", label: "Tasks" },
  { id: "meals", label: "Meals" },
  { id: "grocery", label: "Grocery" },
  { id: "kids", label: "Kids" },
  { id: "routines", label: "Routines" },
  { id: "deeds", label: "Deeds" },
  { id: "calendar", label: "Calendar" },
  { id: "notes", label: "Notes" },
  { id: "reminders", label: "Reminders" },
];

function calmGreeting(h: number) {
  if (h < 5) return "Still awake";
  if (h < 12) return "Good morning";
  if (h < 16) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Winding down";
}

function vibrantGreeting(h: number) {
  if (h < 5) return { text: "Still awake", emoji: "🌙" };
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 16) return { text: "Good afternoon", emoji: "🌤️" };
  if (h < 20) return { text: "Good evening", emoji: "🌇" };
  return { text: "Winding down", emoji: "🌌" };
}

/** A gentle line of encouragement, stable for the whole day. */
const ENCOURAGEMENTS = [
  { text: "Small, steady deeds are the most beloved.", arabic: "أَحَبُّ الأَعْمَالِ أَدْوَمُهَا" },
  { text: "With hardship comes ease — twice over.", arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا" },
  { text: "Begin gently. Barakah is in the beginning.", arabic: "بِسْمِ اللهِ" },
  { text: "Be grateful and you will be given more.", arabic: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ" },
  { text: "Hearts find their rest in remembrance.", arabic: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ" },
  { text: "Do good — Allah loves those who do good.", arabic: "وَأَحْسِنُوا إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ" },
  { text: "Your patience today is tomorrow's ease.", arabic: "وَاصْبِرْ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" },
];

function encouragementFor(key: string) {
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 9973;
  return ENCOURAGEMENTS[sum % ENCOURAGEMENTS.length]!;
}

type Band = { id: string; label: string; meta?: string | undefined; items: DailyThreadItem[] };

function groupThread(items: DailyThreadItem[]): Band[] {
  const now = items.filter((i) => !i.done && i.priority <= 2);
  const next = items.filter((i) => !i.done && i.priority >= 3 && i.priority <= 4);
  const today = items.filter((i) => !i.done && i.priority >= 5 && i.priority <= 7);
  const later = items.filter((i) => !i.done && i.priority >= 8);
  const behind = items.filter((i) => i.done);

  return [
    { id: "now", label: "Now", items: now },
    { id: "next", label: "Next", items: next },
    { id: "today", label: "Today", items: today },
    { id: "later", label: "Later", items: later },
    { id: "behind", label: "Behind you", items: behind },
  ].filter((b) => b.items.length > 0);
}

/**
 * Shared Data & Domain layer for the Today view.
 * Both Calm and Vibrant experiences receive identical underlying data and calculations.
 */
function Today() {
  const { experience } = useExperience();

  const now = useNow(60_000);
  const today = todayKey();
  const [profile] = useStore("profile", { name: "", city: "Kozhikode" });
  const [tasks] = useStore<Task[]>("tasks", []);
  const [grocery] = useStore<{ id: string; got: boolean }[]>("grocery", []);
  const [events] = useStore<CalEvent[]>("events", []);
  const [meals] = useStore<Record<string, string>>("meals", {});
  const [habits] = useStore<{ id: string; name: string; days: string[] }[]>("habits", []);
  const [health] = useStore<Record<string, { water: number }>>("health", {});
  const [checkins] = useStore<Record<string, string>>("checkins", {});
  const [expenses] = useStore<{ amount: number; date: string }[]>("expenses", []);
  const [limits] = useStore<Record<string, number>>("limits", {});
  const [hifzItems] = useStore<HifzItem[]>("hifz", []);
  const [routines] = useStore<Routine[]>("routines", []);
  const [salah] = useSalah();
  const countdown = useNextPrayer();
  const prayers = usePrayers();
  const { isActive: isRamadan, ramadanDay } = useRamadanMode();
  const activeReminders = useReminderEngine();

  const hour = now?.getHours() ?? 8;
  const dueToday = tasks.filter((t) =>
    isRepeating(t.recur) ? occursOn(t.recur, today) : !t.done,
  );
  const open = dueToday.filter((t) => !isTaskDone(t));
  const doneCount = dueToday.length - open.length;
  const todayEvents = eventsOn(events, today);
  const loggedSalah = salah[today] ?? {};
  const prayed = Object.keys(loggedSalah).length;
  const leftToBuy = grocery.filter((g) => !g.got).length;

  const threadItems = useMemo(
    () =>
      buildDailyThread({
        now: now ?? new Date(),
        profile,
        prayers,
        nextPrayer: countdown,
        salahLog: salah,
        hifzItems,
        isRamadan,
        ramadanDay,
        tasks,
        events,
        meals,
        grocery,
        habits,
        health,
        checkins,
        expenses,
        limits,
        activeReminders,
        routines,
      }),
    [
      now,
      profile,
      prayers,
      countdown,
      salah,
      hifzItems,
      isRamadan,
      ramadanDay,
      tasks,
      events,
      meals,
      grocery,
      habits,
      health,
      checkins,
      expenses,
      limits,
      activeReminders,
      routines,
    ],
  );

  const bands = useMemo(() => groupThread(threadItems), [threadItems]);
  const quietDay = threadItems.every((i) => i.done) || threadItems.length === 0;

  // Shared completion & derived metrics
  const taskPct = dueToday.length ? (doneCount / dueToday.length) * 100 : 0;
  const salahPct = (prayed / 5) * 100;
  const groceryPct = grocery.length ? ((grocery.length - leftToBuy) / grocery.length) * 100 : 0;
  const dayPct = Math.round((taskPct + salahPct + groceryPct) / 3);
  const spentToday = expenses
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const dayName = (now ?? new Date()).toLocaleDateString("en-US", { weekday: "short" });
  const mealToday = meals[`${dayName}-Dinner`] || meals[today];
  const water = health[today]?.water ?? 0;
  const verse = encouragementFor(today);
  const marker = now ? islamicMarker(now) : null;
  const hijri = now ? hijriLabel(now) : "";

  if (experience === "vibrant") {
    return (
      <VibrantToday
        now={now}
        hour={hour}
        profile={profile}
        dueToday={dueToday}
        open={open}
        doneCount={doneCount}
        todayEvents={todayEvents}
        loggedSalah={loggedSalah}
        prayed={prayed}
        prayers={prayers}
        countdown={countdown}
        leftToBuy={leftToBuy}
        grocery={grocery}
        bands={bands}
        quietDay={quietDay}
        isRamadan={isRamadan}
        ramadanDay={ramadanDay}
        spentToday={spentToday}
        mealToday={mealToday}
        water={water}
        verse={verse}
        marker={marker}
        hijri={hijri}
        dayPct={dayPct}
        salahPct={salahPct}
      />
    );
  }

  return (
    <CalmToday
      now={now}
      hour={hour}
      profile={profile}
      dueToday={dueToday}
      open={open}
      doneCount={doneCount}
      todayEvents={todayEvents}
      prayed={prayed}
      leftToBuy={leftToBuy}
      grocery={grocery}
      bands={bands}
      quietDay={quietDay}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Calm Experience — Today Screen (Default)
 * ────────────────────────────────────────────────────────────────────────── */

function CalmToday({
  now,
  hour,
  profile,
  dueToday,
  open,
  doneCount,
  todayEvents,
  prayed,
  leftToBuy,
  grocery,
  bands,
  quietDay,
}: {
  now: Date | null;
  hour: number;
  profile: { name: string; city: string };
  dueToday: Task[];
  open: Task[];
  doneCount: number;
  todayEvents: CalEvent[];
  prayed: number;
  leftToBuy: number;
  grocery: { id: string; got: boolean }[];
  bands: Band[];
  quietDay: boolean;
}) {
  return (
    <div className="space-y-12">
      <header className="rise">
        <p className="eyebrow">
          {now?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) ??
            " "}
        </p>
        <h1 className="display-xl mt-3">
          {calmGreeting(hour)}
          {profile.name ? `, ${profile.name}` : ""}.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-[0.98rem] leading-relaxed">
          {open.length === 0 && todayEvents.length === 0
            ? "Nothing is asking for you right now. That is allowed."
            : `${open.length} thing${open.length === 1 ? "" : "s"} waiting${
                todayEvents.length ? ` · ${todayEvents.length} on the calendar` : ""
              }.`}
        </p>
      </header>

      {/* The thread — today read as one prioritised line, arranged now → next → today → later */}
      {quietDay && bands.length === 0 ? (
        <EmptyState
          glyph="☾"
          headline="A quiet day"
          body="Nothing is due and nothing is waiting. When something arrives, it will appear here first."
        />
      ) : (
        <div className="space-y-10">
          {bands.map((band) => (
            <TimeBand key={band.id} label={band.label} meta={band.meta}>
              <section className="thread space-y-0.5">
                {band.items.map((item, idx) => (
                  <CalmThreadItem key={item.id} item={item} index={idx} lead={band.id === "now"} />
                ))}
              </section>
            </TimeBand>
          ))}
        </div>
      )}

      <Section
        eyebrow="How today looks"
        title="Progress"
        aside={
          <Link to="/review" className="text-ink-faint hover:text-foreground text-xs">
            Weekly review →
          </Link>
        }
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <ProgressLine
            label="Tasks"
            value={`${doneCount}/${dueToday.length}`}
            pct={dueToday.length ? (doneCount / dueToday.length) * 100 : 0}
          />
          <ProgressLine label="Salah" value={`${prayed}/5`} pct={(prayed / 5) * 100} />
          <ProgressLine
            label="Grocery"
            value={`${grocery.length - leftToBuy}/${grocery.length}`}
            pct={grocery.length ? ((grocery.length - leftToBuy) / grocery.length) * 100 : 0}
          />
        </div>
      </Section>
    </div>
  );
}

const CALM_TONE_BY_BAND: Record<string, "urgent" | "attention" | "ambient" | "settled"> = {
  prayer: "attention",
  ramadan: "urgent",
  reminder: "urgent",
};

function CalmThreadItem({
  item,
  index,
  lead,
}: {
  item: DailyThreadItem;
  index: number;
  lead: boolean;
}) {
  const tone = item.active ? (CALM_TONE_BY_BAND[item.category] ?? "attention") : "ambient";
  const body = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
      <div className="min-w-0">
        <p className="eyebrow">{item.label}</p>
        <p
          className={`mt-1 ${lead ? "thread-lead" : "text-[1.02rem]"} ${
            item.done ? "text-ink-faint" : "text-foreground"
          }`}
        >
          {item.value}
        </p>
        {item.detail && <p className="text-ink-faint numeric mt-1 text-xs">{item.detail}</p>}
      </div>
      {item.active && !item.done && (
        <span className="shrink-0 pt-0.5">
          <Status tone={tone}>{tone === "urgent" ? "Now" : "Soon"}</Status>
        </span>
      )}
    </div>
  );

  return (
    <div
      className="thread-node thread-in"
      style={{ "--i": index } as CSSProperties}
      data-active={item.active ? "true" : undefined}
      data-done={item.done ? "true" : undefined}
    >
      {item.to ? (
        <Link
          to={item.to}
          className="focus-visible:ring-space/40 block rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Vibrant Experience — Today Screen (Alternative Experience)
 * ────────────────────────────────────────────────────────────────────────── */

function VibrantToday({
  now,
  hour,
  profile,
  dueToday,
  open,
  doneCount,
  todayEvents,
  loggedSalah,
  prayed,
  prayers,
  countdown,
  leftToBuy,
  grocery,
  bands,
  quietDay,
  isRamadan,
  ramadanDay,
  spentToday,
  mealToday,
  water,
  verse,
  marker,
  hijri,
  dayPct,
  salahPct,
}: {
  now: Date | null;
  hour: number;
  profile: { name: string; city: string };
  dueToday: Task[];
  open: Task[];
  doneCount: number;
  todayEvents: CalEvent[];
  loggedSalah: Record<string, unknown>;
  prayed: number;
  prayers: { id: string; name: string; time: string }[];
  countdown: { next: { id: string; name: string; time: string }; hours: number; mins: number } | null;
  leftToBuy: number;
  grocery: { id: string; got: boolean }[];
  bands: Band[];
  quietDay: boolean;
  isRamadan: boolean;
  ramadanDay: number | null;
  spentToday: number;
  mealToday?: string | undefined;
  water: number;
  verse: { text: string; arabic: string };
  marker: string | null;
  hijri: string;
  dayPct: number;
  salahPct: number;
}) {
  const hello = vibrantGreeting(hour);

  return (
    <div className="space-y-9">
      {/* ── The emotional centre: one warm, living moment ─────────────────── */}
      <header className="hero-aurora bloom-in min-h-[15.5rem] p-6 sm:p-7">
        <span
          className="orb drift -top-12 -left-10 size-44"
          style={{ "--i": 0 } as CSSProperties}
          aria-hidden
        />
        <span
          className="orb drift -right-8 -bottom-16 size-52"
          style={{ "--i": 1 } as CSSProperties}
          aria-hidden
        />
        <span className="motif top-0 right-0 h-40 w-52" aria-hidden />

        <div className="relative z-[3] flex h-full flex-col justify-between gap-7">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="eyebrow opacity-85">
                {now?.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) ?? " "}
                {isRamadan ? ` · Ramadan ${ramadanDay}` : ""}
              </p>
              <h1 className="display-xl mt-2.5 flex flex-wrap items-baseline gap-x-2.5">
                <span>
                  {hello.text}
                  {profile.name ? `, ${profile.name}` : ""}
                </span>
                <span className="float-soft text-[1.4rem] leading-none" aria-hidden>
                  {hello.emoji}
                </span>
              </h1>
              <p className="mt-2.5 max-w-md text-[0.95rem] leading-relaxed opacity-90">
                {open.length === 0 && todayEvents.length === 0
                  ? "Nothing is asking for you right now. That is allowed."
                  : `${open.length} thing${open.length === 1 ? "" : "s"} waiting${
                      todayEvents.length ? ` · ${todayEvents.length} on the calendar` : ""
                    }.`}
              </p>
            </div>

            <HeroRing pct={dayPct} />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {countdown && (
              <Link to="/deen" className="hero-pill">
                <span className="breathe size-1.5 rounded-full bg-current" aria-hidden />
                {countdown.next.name} in {countdown.hours > 0 ? `${countdown.hours}h ` : ""}
                {countdown.mins}m
              </Link>
            )}
            <span className="hero-pill sm:hidden">
              <Sun className="size-3.5" strokeWidth={2.4} aria-hidden />
              {dayPct}% tended
            </span>
            {hijri && (
              <span className="hero-pill">
                <Moon className="size-3.5" strokeWidth={2.4} aria-hidden />
                {hijri}
              </span>
            )}
            {marker && (
              <span className="hero-pill">
                <Sparkles className="size-3.5" strokeWidth={2.4} aria-hidden />
                {marker}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Salah rhythm: a timeline, not a widget ───────────────────────── */}
      {now && (
        <PrayerRhythm
          prayers={prayers}
          logged={loggedSalah}
          nextId={countdown?.next.id}
          prayed={prayed}
        />
      )}

      {/* ── Quick actions: small, colourful, one tap away ─────────────────── */}
      <nav aria-label="Quick actions" className="-mx-4 sm:-mx-6 no-scrollbar overflow-x-auto px-4 sm:px-6">
        <div className="flex gap-2.5 pb-1 min-w-max">
          <QuickAction to="/deen" tone="prayer" icon={Moon} label="Log salah" />
          <QuickAction to="/deen" tone="habit" icon={BookOpen} label="Quran" />
          <QuickAction to="/me" tone="self" icon={Droplets} label="Water" />
          <QuickAction to="/budget" tone="money" icon={Wallet} label="Add expense" />
          <QuickAction to="/review" tone="kids" icon={CalendarDays} label="Weekly review" />
        </div>
      </nav>

      {/* ── Bento: the day at a glance, one hue per life-area ───────────── */}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile tone="prayer" to="/deen" index={0} className="col-span-2 flex items-center gap-4.5 p-4 sm:p-5">
          <ProgressRing pct={salahPct} tone="prayer" label="Salah" size={72} thickness={7}>
            <span className="numeric text-[0.95rem] font-bold" style={{ color: "var(--tone)" }}>
              {prayed}
              <span className="text-ink-faint text-[0.7rem]">/5</span>
            </span>
          </ProgressRing>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block" style={{ color: "var(--tone)" }}>
              Salah
            </span>
            <span className="title-md mt-1 block text-[1.05rem]">
              {prayed === 5 ? "All five, alhamdulillah 🤍" : `${prayed} of 5 prayed`}
            </span>
            <span className="text-ink-soft mt-0.5 block text-[0.8rem] font-medium">
              {prayed === 5 ? "A complete thread today" : "Keep the thread going"}
            </span>
          </span>
        </Tile>

        <StatTile
          tone="task"
          icon={CheckCircle2}
          figure={`${doneCount}/${dueToday.length}`}
          title="Tasks"
          note={open.length ? `${open.length} still open` : "All clear"}
          index={1}
          {...(dueToday.length && !open.length ? { emoji: "🎉" } : {})}
        />
        <StatTile
          tone="grocery"
          icon={ShoppingBasket}
          figure={`${leftToBuy}`}
          title="To buy"
          note={leftToBuy ? "Items left on the list" : "Basket is settled"}
          index={2}
        />
        <RowTile
          tone="meal"
          icon={UtensilsCrossed}
          label="Tonight"
          value={mealToday || "Not planned yet"}
          index={3}
          wide
        />
        <RowTile
          tone="money"
          icon={Wallet}
          label="Spent today"
          value={spentToday ? `₹${spentToday.toLocaleString()}` : "Nothing yet"}
          to="/budget"
          index={4}
        />
        <RowTile
          tone="self"
          icon={HeartPulse}
          label="Water"
          value={`${water} glasses`}
          to="/me"
          index={5}
        />
      </section>

      {/* ── The thread — now → next → today → later, as tonal cards ─────── */}
      {quietDay && bands.length === 0 ? (
        <EmptyState
          glyph="🌙"
          headline="A quiet day"
          body="Nothing is due and nothing is waiting. When something arrives, it will appear here first."
        />
      ) : (
        <div className="space-y-8">
          {bands.map((band) => (
            <section key={band.id} aria-label={band.label}>
              <BentoHeading
                title={band.label}
                tone={VIBRANT_BAND_TONE[band.id]}
                aside={
                  <span className="text-ink-faint numeric text-[0.72rem] font-semibold">
                    {band.items.length}
                  </span>
                }
              />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {band.items.map((item, idx) => (
                  <VibrantThreadCard key={item.id} item={item} index={idx} lead={band.id === "now"} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── A closing breath: encouragement, or a celebration ─────────────── */}
      {dayPct >= 100 ? (
        <section className="celebrate-field bloom-in p-6">
          <span className="orb drift -top-10 -right-6 size-40" aria-hidden />
          <div className="relative flex items-center gap-4">
            <span className="sparkle text-[2rem] leading-none" aria-hidden>
              🎉
            </span>
            <div>
              <p className="title-md text-[1.1rem]">Today is fully tended</p>
              <p className="mt-1 text-[0.88rem] leading-relaxed opacity-90">
                Prayers, tasks and the list — all settled. Rest well tonight.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="verse-field bloom-in p-6">
          <p className="arabic text-[1.35rem] leading-[2] text-[var(--cat-prayer)]">
            {verse.arabic}
          </p>
          <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed font-medium">
            {verse.text}
          </p>
        </section>
      )}

      <div className="px-1">
        <Link
          to="/review"
          className="text-ink-faint hover:text-foreground text-xs font-semibold transition-colors"
        >
          Weekly review →
        </Link>
      </div>
    </div>
  );
}

/** The day, held as a light arc on the hero. */
function HeroRing({ pct }: { pct: number }) {
  const size = 86;
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative hidden flex-none place-items-center sm:grid"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped}% of today tended`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={7}
          stroke="oklch(1 0 0 / 0.22)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          stroke="oklch(0.995 0.008 70)"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        <span className="numeric text-[1.15rem] leading-none font-bold">{clamped}%</span>
        <span className="mt-1 text-[0.6rem] font-bold tracking-wider uppercase opacity-80">
          tended
        </span>
      </span>
    </span>
  );
}

/** Five prayers as a rhythm line — done, now, still ahead. */
function PrayerRhythm({
  prayers,
  logged,
  nextId,
  prayed,
}: {
  prayers: { id: string; name: string; time: string }[];
  logged: Record<string, unknown>;
  nextId?: string | undefined;
  prayed: number;
}) {
  return (
    <section
      aria-label="Prayer rhythm"
      data-tone="prayer"
      className="tile tile-vivid bloom-in p-4 sm:p-5"
    >
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconChip icon={Sun} solid />
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: "var(--tone)" }}>
              Today's Rhythm
            </p>
            <p className="title-md text-[0.98rem] mt-0.5">
              {prayed === 5 ? "Every prayer kept 🤍" : `${prayed} of 5 kept so far`}
            </p>
          </div>
        </div>
        <Link
          to="/deen"
          className="text-ink-soft hover:text-foreground text-xs font-semibold shrink-0 transition-colors"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {prayers.map((p) => {
          const isDone = Boolean(logged[p.id]);
          const isNext = p.id === nextId && !isDone;
          const state = isDone ? "done" : isNext ? "next" : "ahead";
          return (
            <span key={p.id} className="rhythm-node p-1.5 sm:p-2 rounded-xl transition-all" data-state={state}>
              <span className="dot" aria-hidden />
              <span className="truncate text-foreground/90">{p.name}</span>
              <span className="numeric text-ink-faint text-[0.65rem] font-semibold">{p.time}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

function QuickAction({
  to,
  tone,
  icon: Icon,
  label,
}: {
  to: "/deen" | "/me" | "/budget" | "/review";
  tone: Tone;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <Link to={to} data-tone={tone} className="action-pill">
      <span className="icon-orb size-8 rounded-[0.7rem]">
        <Icon className="size-[0.95rem]" strokeWidth={2.2} />
      </span>
      {label}
    </Link>
  );
}

const VIBRANT_BAND_TONE: Record<string, Tone> = {
  now: "task",
  next: "prayer",
  today: "kids",
  later: "self",
  behind: "habit",
};

/** Category → life-area voice. Colour always means the same thing. */
const TONE_BY_CATEGORY: Record<string, Tone> = {
  prayer: "prayer",
  hifz: "prayer",
  ramadan: "prayer",
  reminder: "task",
  task: "task",
  event: "kids",
  kids: "kids",
  meal: "meal",
  grocery: "grocery",
  habit: "habit",
  health: "self",
  checkin: "self",
  money: "money",
  budget: "money",
};

const ICON_BY_TONE: Record<Tone, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  prayer: Moon,
  task: CheckCircle2,
  meal: UtensilsCrossed,
  kids: CalendarDays,
  grocery: ShoppingBasket,
  habit: Sparkles,
  money: Wallet,
  self: HeartPulse,
};

function VibrantThreadCard({
  item,
  index,
  lead,
}: {
  item: DailyThreadItem;
  index: number;
  lead: boolean;
}) {
  const tone: Tone = TONE_BY_CATEGORY[item.category] ?? "task";
  const Icon = ICON_BY_TONE[tone];

  return (
    <Tile
      tone={tone}
      {...(item.to ? { to: item.to } : {})}
      index={index}
      quiet={item.done}
      className={`flex items-start gap-3 ${lead ? "sm:col-span-2 sm:p-5" : ""} ${
        item.done ? "opacity-70" : ""
      }`}
    >
      <IconChip icon={Icon} solid={lead && !item.done} float={lead && !item.done} />
      <span className="min-w-0 flex-1">
        <span className="eyebrow block" style={{ color: "var(--tone)" }}>
          {item.label}
        </span>
        <span
          className={`mt-1 block ${lead ? "thread-lead" : "text-[1rem] font-semibold"} ${
            item.done ? "text-ink-faint line-through decoration-1" : "text-foreground"
          }`}
        >
          {item.value}
        </span>
        {item.detail && (
          <span className="text-ink-soft numeric mt-1 block text-[0.78rem] font-medium">
            {item.detail}
          </span>
        )}
      </span>
      {item.active && !item.done && (
        <span className="chip shrink-0">
          <span className="breathe size-1.5 rounded-full bg-current" aria-hidden />
          {item.priority <= 2 ? "Now" : "Soon"}
        </span>
      )}
    </Tile>
  );
}

function HomePage() {
  useFamilyMigration();
  const [tab, setTab] = useTab("today");
  return (
    <Shell space="home">
      <div className="mb-8">
        <SubTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === "today" && <Today />}
      {tab === "tasks" && <Tasks />}
      {tab === "meals" && <Meals />}
      {tab === "grocery" && <GroceryList />}
      {tab === "kids" && <Kids />}
      {tab === "routines" && <Routines />}
      {tab === "deeds" && <Deeds />}
      {tab === "calendar" && <UnifiedCalendar />}
      {tab === "notes" && <Notes />}
      {tab === "reminders" && <Reminders />}
    </Shell>
  );
}
