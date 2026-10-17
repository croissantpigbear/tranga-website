<template>
    <TrangaPage>
        <template #title>
            <p class="text-2xl font-semibold max-sm:text-xl">Release calendar</p>
        </template>
        <template #actions>
            <UButton icon="i-lucide-chevron-left" variant="outline" color="neutral" aria-label="Previous month" @click="move(-1)" />
            <UButton variant="outline" color="neutral" class="max-sm:hidden" :disabled="isThisMonth" @click="goToday">Today</UButton>
            <UButton icon="i-lucide-chevron-right" variant="outline" color="neutral" aria-label="Next month" @click="move(1)" />
        </template>

        <div class="flex flex-col gap-4 pb-10 max-w-7xl mx-auto w-full">
            <div class="flex flex-row flex-wrap items-baseline justify-between gap-2">
                <h2 class="text-xl font-semibold">{{ monthLabel }}</h2>
                <p class="text-xs text-muted">
                    Dates are when Tranga found a new chapter (it checks every few hours). Chapters downloaded when you added a series aren't
                    counted.
                </p>
            </div>

            <UAlert
                v-if="unsupported"
                color="warning"
                variant="subtle"
                icon="i-lucide-triangle-alert"
                title="Your Tranga API doesn't have the calendar yet"
                description="Update the tranga-api container to the latest image." />

            <div v-else class="grid gap-4 min-lg:grid-cols-[1fr_20rem]">
                <!-- Month grid (phones: list of days with releases) -->
                <div>
                    <div class="max-sm:hidden grid grid-cols-7 gap-1 text-xs text-dimmed mb-1">
                        <span v-for="d in weekdays" :key="d" class="px-1">{{ d }}</span>
                    </div>
                    <div class="max-sm:hidden grid grid-cols-7 gap-1">
                        <button
                            v-for="cell in cells"
                            :key="cell.key"
                            type="button"
                            :disabled="!cell.date"
                            :class="[
                                'min-h-24 rounded-md p-1.5 text-left flex flex-col gap-1 border transition-colors',
                                !cell.date ? 'border-transparent' : 'border-default hover:border-primary',
                                cell.date === selected ? 'border-primary bg-primary/10' : cell.date ? 'bg-elevated' : '',
                            ]"
                            @click="cell.date && (selected = cell.date)">
                            <template v-if="cell.date">
                                <span :class="['text-xs', cell.date === todayKey ? 'text-primary font-bold' : 'text-muted']">{{ cell.day }}</span>
                                <span
                                    v-for="r in (byDate.get(cell.date) ?? []).slice(0, 3)"
                                    :key="r.mangaId"
                                    class="text-xs truncate rounded bg-success/15 text-success px-1"
                                    :title="`${r.mangaName}: ${chaptersText(r.chapters)}`">
                                    {{ r.mangaName }}
                                </span>
                                <span v-if="(byDate.get(cell.date)?.length ?? 0) > 3" class="text-xs text-muted">
                                    +{{ byDate.get(cell.date)!.length - 3 }} more
                                </span>
                                <span
                                    v-for="e in (expectedByDate.get(cell.date) ?? []).slice(0, 2)"
                                    :key="`e-${e.mangaId}`"
                                    class="text-xs truncate rounded border border-dashed border-info/60 text-info px-1"
                                    :title="`${e.mangaName}: expected (about every ${e.everyDays} days)`">
                                    {{ e.mangaName }}
                                </span>
                            </template>
                        </button>
                    </div>

                    <!-- Selected day, or (phones) every day with releases -->
                    <div class="mt-4 flex flex-col gap-3">
                        <template v-if="loading">
                            <USkeleton v-for="i in 3" :key="i" class="h-14 w-full" />
                        </template>
                        <template v-else>
                            <section v-for="day in listedDays" :key="day.date" class="flex flex-col gap-1.5">
                                <h3 class="text-sm font-semibold">{{ longDate(day.date) }}</h3>
                                <NuxtLink
                                    v-for="r in day.releases"
                                    :key="r.mangaId"
                                    :to="`/manga/${r.mangaId}?return=/calendar`"
                                    class="flex flex-row items-center gap-3 rounded-lg bg-elevated p-2 hover:ring-1 hover:ring-primary">
                                    <UIcon name="i-lucide-book-plus" class="size-5 text-success shrink-0" />
                                    <span class="grow min-w-0">
                                        <span class="block truncate font-medium">{{ r.mangaName }}</span>
                                        <span class="block text-xs text-muted">{{ chaptersText(r.chapters) }}</span>
                                    </span>
                                </NuxtLink>
                                <p v-if="!day.releases.length" class="text-sm text-muted">No new chapters this day.</p>
                            </section>
                            <p v-if="!listedDays.length" class="text-sm text-muted">No new chapters in {{ monthLabel }} yet.</p>
                        </template>
                    </div>
                </div>

                <!-- Expected -->
                <UCard :ui="{ body: 'p-3 sm:p-3' }">
                    <template #header>
                        <p class="font-semibold flex items-center gap-2"><UIcon name="i-lucide-calendar-clock" class="size-4" />Expected</p>
                        <p class="text-xs text-muted mt-0.5">From how often each series has released. A guess, not a schedule.</p>
                    </template>
                    <div class="flex flex-col gap-2">
                        <NuxtLink
                            v-for="e in data?.expected ?? []"
                            :key="e.mangaId"
                            :to="`/manga/${e.mangaId}?return=/calendar`"
                            class="flex flex-col rounded-md px-2 py-1.5 hover:bg-elevated">
                            <span class="truncate text-sm font-medium">{{ e.mangaName }}</span>
                            <span :class="['text-xs', overdue(e) ? 'text-warning' : 'text-muted']">
                                {{ overdue(e) ? 'Due since' : 'Around' }} {{ shortDate(e.nextUtc) }} · about every {{ e.everyDays }}
                                {{ e.everyDays === 1 ? 'day' : 'days' }}
                            </span>
                        </NuxtLink>
                        <p v-if="!loading && !data?.expected.length" class="text-sm text-muted">
                            Nothing expected. Estimates need at least three releases of a series.
                        </p>
                    </div>
                </UCard>
            </div>
        </div>
    </TrangaPage>
</template>

<script setup lang="ts">
interface Release {
    mangaId: string;
    mangaName: string;
    chapters: string[];
    firstUtc: string;
}
interface Expected {
    mangaId: string;
    mangaName: string;
    everyDays: number;
    lastUtc: string;
    nextUtc: string;
    releases: number;
}
interface CalendarData {
    days: { date: string; releases: Release[] }[];
    expected: Expected[];
}

const api = useTrangaApi();
const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const data = ref<CalendarData>();
const loading = ref(true);
const unsupported = ref(false);
const selected = ref<string>();

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = keyOf(now);
const isThisMonth = computed(() => year.value === now.getFullYear() && month.value === now.getMonth() + 1);

async function load() {
    loading.value = true;
    try {
        data.value = await api.call<CalendarData>('v2/Calendar', { query: { year: String(year.value), month: String(month.value) } });
        unsupported.value = false;
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) unsupported.value = true;
        data.value = { days: [], expected: [] };
    } finally {
        loading.value = false;
    }
}
watch([year, month], () => {
    selected.value = isThisMonth.value ? todayKey : undefined;
    load();
});
onMounted(() => {
    selected.value = todayKey;
    load();
});

function move(by: number) {
    const d = new Date(year.value, month.value - 1 + by, 1);
    year.value = d.getFullYear();
    month.value = d.getMonth() + 1;
}
function goToday() {
    year.value = now.getFullYear();
    month.value = now.getMonth() + 1;
}

const monthLabel = computed(() => new Date(year.value, month.value - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
// Monday first
const weekdays = computed(() => [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })));
const cells = computed(() => {
    const first = new Date(year.value, month.value - 1, 1);
    const blanks = (first.getDay() + 6) % 7;
    const days = new Date(year.value, month.value, 0).getDate();
    const out: { key: string; date?: string; day?: number }[] = [];
    for (let i = 0; i < blanks; i++) out.push({ key: `b${i}` });
    for (let d = 1; d <= days; d++) {
        const date = keyOf(new Date(year.value, month.value - 1, d));
        out.push({ key: date, date, day: d });
    }
    return out;
});

const byDate = computed(() => new Map((data.value?.days ?? []).map((d) => [d.date, d.releases])));
const expectedByDate = computed(() => {
    const map = new Map<string, Expected[]>();
    for (const e of data.value?.expected ?? []) {
        const k = keyOf(new Date(e.nextUtc));
        map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
});

// Wide screens: the selected day; phones: every day with releases, newest first
const isPhone = ref(false);
onMounted(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    isPhone.value = mq.matches;
    mq.addEventListener('change', (e) => (isPhone.value = e.matches));
});
const listedDays = computed(() => {
    if (isPhone.value) return [...(data.value?.days ?? [])].reverse();
    if (!selected.value) return [];
    return [{ date: selected.value, releases: byDate.value.get(selected.value) ?? [] }];
});

function chaptersText(chapters: string[]): string {
    if (!chapters.length) return 'New chapter';
    if (chapters.length === 1) return `Ch. ${chapters[0]}`;
    return `Ch. ${chapters[0]}–${chapters[chapters.length - 1]} (${chapters.length} chapters)`;
}
const longDate = (k: string) =>
    new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const overdue = (e: Expected) => new Date(e.nextUtc).getTime() < Date.now();

useHead({ title: 'Release calendar' });
</script>
