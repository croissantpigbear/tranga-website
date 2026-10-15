<template>
    <div class="flex flex-col gap-3">
        <!-- Filters -->
        <div class="flex flex-row flex-wrap items-end gap-2">
            <UFormField label="When">
                <UFieldGroup>
                    <UButton
                        v-for="r in RANGES"
                        :key="r.value"
                        size="sm"
                        :color="range === r.value ? 'primary' : 'neutral'"
                        :variant="range === r.value ? 'solid' : 'outline'"
                        @click="range = r.value">
                        {{ r.label }}
                    </UButton>
                </UFieldGroup>
            </UFormField>
            <template v-if="range === 'custom'">
                <UFormField label="From"><UInput v-model="customStart" type="datetime-local" size="sm" /></UFormField>
                <UFormField label="To"><UInput v-model="customEnd" type="datetime-local" size="sm" /></UFormField>
            </template>
            <UFormField label="Manga">
                <USelectMenu
                    v-model="mangaId"
                    :items="mangaItems"
                    value-key="value"
                    placeholder="All manga"
                    :search-input="{ placeholder: 'Search…' }"
                    size="sm"
                    class="w-64" />
            </UFormField>
            <UFormField label="Type">
                <USelectMenu v-model="action" :items="typeItems" value-key="value" size="sm" class="w-52" />
            </UFormField>
            <UButton
                v-if="mangaId || action !== ALL || range !== '24h'"
                size="sm"
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                @click="resetFilters">
                Clear filters
            </UButton>
            <span class="grow" />
            <USwitch v-model="autoRefresh" size="sm" label="Auto-refresh" />
        </div>

        <!-- Counts per type (click to filter) -->
        <div class="flex flex-row flex-wrap gap-1.5">
            <UButton
                v-for="t in typeCounts"
                :key="t.type"
                size="xs"
                :variant="action === t.type ? 'solid' : 'soft'"
                :color="action === t.type ? 'primary' : 'neutral'"
                :icon="ACTION_INFO[t.type]?.icon ?? 'i-lucide-circle'"
                :disabled="t.count === 0"
                @click="action = action === t.type ? ALL : t.type">
                {{ ACTION_INFO[t.type]?.plural ?? t.type }}
                <UBadge size="sm" variant="subtle" :color="action === t.type ? 'neutral' : 'primary'">{{ t.count }}</UBadge>
            </UButton>
        </div>

        <!-- List grouped by day -->
        <div v-if="status === 'pending' && !rows.length" class="flex flex-col gap-2">
            <USkeleton v-for="n in 6" :key="n" class="h-14 w-full" />
        </div>
        <div v-else-if="!rows.length" class="py-16 flex flex-col items-center gap-2 text-muted">
            <UIcon name="i-lucide-inbox" class="size-8" />
            <p>Nothing happened in this period{{ mangaId || action !== ALL ? ' (with these filters)' : '' }}.</p>
            <UButton v-if="range !== 'all'" size="sm" variant="soft" @click="range = 'all'">Show all time</UButton>
        </div>
        <div v-else class="flex flex-col gap-4">
            <section v-for="group in groups" :key="group.label" class="flex flex-col">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed px-2 pb-1 sticky top-0 bg-default z-10">
                    {{ group.label }}
                </h3>
                <div class="flex flex-col divide-y divide-default rounded-lg border border-default overflow-clip">
                    <div v-for="row in group.rows" :key="row.key" class="flex flex-col">
                        <button
                            type="button"
                            class="flex flex-row items-center gap-3 px-3 py-2 text-left hover:bg-elevated/60 transition-colors"
                            @click="toggle(row.key)">
                            <div :class="['size-8 rounded-full flex items-center justify-center shrink-0', info(row).bg]">
                                <UIcon :name="info(row).icon" :class="['size-4', info(row).fg]" />
                            </div>
                            <img
                                v-if="row.mangaId && mangaName(row.mangaId)"
                                :src="coverUrl(row.mangaId)"
                                alt=""
                                loading="lazy"
                                class="w-7 h-10 object-cover rounded-sm shrink-0 bg-elevated max-sm:hidden" />
                            <div class="flex flex-col min-w-0 grow">
                                <p class="text-sm truncate">
                                    <span class="font-medium">{{ headline(row) }}</span>
                                    <template v-if="row.mangaId">
                                        <span class="text-dimmed"> · </span>
                                        <NuxtLink
                                            :to="`/manga/${row.mangaId}?return=${encodeURIComponent($route.fullPath)}`"
                                            class="text-primary hover:underline"
                                            @click.stop>
                                            {{ mangaName(row.mangaId) ?? 'Removed manga' }}
                                        </NuxtLink>
                                    </template>
                                </p>
                                <p v-if="subline(row)" class="text-xs text-muted truncate" :title="subline(row)">{{ subline(row) }}</p>
                            </div>
                            <span class="text-xs text-muted shrink-0 text-right" :title="new Date(row.performedAt).toLocaleString()">
                                {{ timeLabel(row.performedAt) }}
                            </span>
                            <UIcon
                                name="i-lucide-chevron-down"
                                :class="['size-4 text-dimmed shrink-0 transition-transform', expanded.has(row.key) && 'rotate-180']" />
                        </button>
                        <dl
                            v-if="expanded.has(row.key)"
                            class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs px-14 pb-3 pt-1 bg-elevated/40">
                            <template v-for="d in detailRows(row)" :key="d[0]">
                                <dt class="text-dimmed">{{ d[0] }}</dt>
                                <dd class="break-all font-mono">{{ d[1] }}</dd>
                            </template>
                        </dl>
                    </div>
                </div>
            </section>
        </div>

        <!-- Paging -->
        <div v-if="(data?.totalCount ?? 0) > 0" class="flex flex-row flex-wrap items-center justify-center gap-3 pt-2">
            <span class="text-sm text-muted">{{ data?.totalCount }} {{ data?.totalCount === 1 ? 'entry' : 'entries' }}</span>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="data?.totalCount ?? 0" size="sm" />
            <USelect v-model="pageSize" :items="[25, 50, 100]" size="sm" class="w-24" />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
import { formatChapter } from '~/composables/useMangaOverviewDetails';
type ActionRecord = components['schemas']['ActionRecord'];
type Chapter = components['schemas']['Chapter'];

const props = defineProps<{ initialMangaId?: string }>();
const { $api } = useNuxtApp();
const config = useRuntimeConfig();

const ALL = '__all';
const RANGES = [
    { value: '1h', label: 'Last hour', ms: 3600e3 },
    { value: '24h', label: '24 hours', ms: 86400e3 },
    { value: '7d', label: '7 days', ms: 7 * 86400e3 },
    { value: '30d', label: '30 days', ms: 30 * 86400e3 },
    { value: 'all', label: 'All time', ms: 0 },
    { value: 'custom', label: 'Custom', ms: 0 },
] as const;
type Range = (typeof RANGES)[number]['value'];

interface ActionInfo {
    label: string;
    plural: string;
    icon: string;
    bg: string;
    fg: string;
}
const ACTION_INFO: Record<string, ActionInfo> = {
    ChapterDownloaded: { label: 'Downloaded', plural: 'Downloads', icon: 'i-lucide-download', bg: 'bg-success/15', fg: 'text-success' },
    ChaptersRetrieved: { label: 'Checked for new chapters', plural: 'Chapter checks', icon: 'i-lucide-list-checks', bg: 'bg-info/15', fg: 'text-info' },
    CoverDownloaded: { label: 'Downloaded cover', plural: 'Covers', icon: 'i-lucide-image', bg: 'bg-secondary/15', fg: 'text-secondary' },
    MetadataUpdated: { label: 'Updated metadata', plural: 'Metadata updates', icon: 'i-lucide-tags', bg: 'bg-primary/15', fg: 'text-primary' },
    DataMoved: { label: 'Moved files', plural: 'File moves', icon: 'i-lucide-folder-input', bg: 'bg-warning/15', fg: 'text-warning' },
    LibraryMoved: { label: 'Moved to another library', plural: 'Library moves', icon: 'i-lucide-library-big', bg: 'bg-warning/15', fg: 'text-warning' },
    Startup: { label: 'Tranga started', plural: 'Startups', icon: 'i-lucide-power', bg: 'bg-neutral-500/15', fg: 'text-muted' },
};
const UNKNOWN: ActionInfo = { label: '', plural: '', icon: 'i-lucide-circle', bg: 'bg-elevated', fg: 'text-muted' };
const info = (row: ActionRecord) => ACTION_INFO[row.action] ?? { ...UNKNOWN, label: row.action.split(/(?=[A-Z])/).join(' ') };

// Filters
const range = ref<Range>('24h');
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
const customStart = ref(toLocalInput(new Date(Date.now() - 86400e3)));
const customEnd = ref(toLocalInput(new Date()));
const mangaId = ref<string>(props.initialMangaId ?? ''); // '' = all
const action = ref<string>(ALL);
const page = ref(1);
const pageSize = ref(25);
const autoRefresh = ref(false);

function resetFilters() {
    range.value = '24h';
    mangaId.value = '';
    action.value = ALL;
}

/** Filter body for /v2/Actions/Filter (times as UTC) */
function filterBody(type?: string) {
    let start: Date;
    let end = new Date();
    if (range.value === 'custom') {
        start = new Date(customStart.value);
        end = new Date(customEnd.value);
    } else {
        const r = RANGES.find((x) => x.value === range.value)!;
        start = r.ms ? new Date(Date.now() - r.ms) : new Date(0);
    }
    return {
        start: start.toISOString(),
        end: end.toISOString(),
        mangaId: mangaId.value || undefined,
        action: type ?? (action.value === ALL ? undefined : action.value),
    };
}

const { data: manga } = useApi('/v2/Manga', { key: FetchKeys.Manga.All, server: false });
const mangaNames = computed(() => new Map((manga.value ?? []).map((m) => [m.key, m.name])));
const mangaName = (id: string) => mangaNames.value.get(id);
const mangaItems = computed(() => [
    { value: '', label: 'All manga' },
    ...[...(manga.value ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.key, label: m.name })),
]);
const coverUrl = (id: string) => `${config.public.openFetch.api.baseURL}v2/Manga/${id}/Cover/Small`;

const { data: types } = useApi('/v2/Actions/Types', { key: FetchKeys.Actions.Types, server: false });
const typeItems = computed(() => [
    { value: ALL, label: 'All types' },
    ...(types.value ?? []).map((t) => ({ value: t as string, label: ACTION_INFO[t]?.plural ?? t })),
]);

// Rows
const { data, status, refresh } = useAsyncData(
    'activity-history',
    () =>
        $api('/v2/Actions/Filter', {
            method: 'POST',
            body: filterBody() as never,
            query: { page: page.value, pageSize: pageSize.value },
        }),
    { lazy: true, server: false }
);
const rows = computed(() => data.value?.data ?? []);

// Counts per type for the same period/manga
const typeCounts = ref<{ type: string; count: number }[]>([]);
async function loadCounts() {
    const list = types.value ?? [];
    const counts = await Promise.all(
        list.map((t) =>
            $api('/v2/Actions/Filter', { method: 'POST', body: filterBody(t) as never, query: { page: 1, pageSize: 1 } })
                .then((r) => ({ type: t as string, count: r.totalCount }))
                .catch(() => ({ type: t as string, count: 0 }))
        )
    );
    typeCounts.value = counts.filter((c) => c.count > 0 || c.type === action.value);
}

async function reload(resetPage = true) {
    if (resetPage && page.value !== 1) {
        page.value = 1; // watcher reloads
        return;
    }
    await Promise.all([refresh(), loadCounts()]);
}
watch([range, customStart, customEnd, mangaId, action, pageSize], () => reload());
watch(page, () => refresh());
watch(types, () => loadCounts());
onMounted(() => loadCounts());

let timer: ReturnType<typeof setInterval> | undefined;
watch(
    autoRefresh,
    (on) => {
        clearInterval(timer);
        if (on) timer = setInterval(() => reload(false), 30e3);
    },
    { immediate: true }
);
onBeforeUnmount(() => clearInterval(timer));
defineExpose({ reload: () => reload(false) });

// Chapter details for the rows on screen
const chapters = reactive(new Map<string, Chapter | null>());
watch(
    rows,
    (list) => {
        for (const r of list) {
            if (!r.chapterId || chapters.has(r.chapterId)) continue;
            chapters.set(r.chapterId, null);
            $api('/v2/Chapters/{ChapterId}', { path: { ChapterId: r.chapterId } })
                .then((c) => chapters.set(r.chapterId!, c))
                .catch(() => {});
        }
    },
    { immediate: true }
);

function headline(row: ActionRecord): string {
    const i = info(row);
    if (row.action === 'ChapterDownloaded') {
        const c = row.chapterId ? chapters.get(row.chapterId) : undefined;
        return c ? `Downloaded ${formatChapter(c)}` : 'Downloaded a chapter';
    }
    if (row.action === 'MetadataUpdated' && row.metadataFetcher) return `Updated metadata from ${row.metadataFetcher}`;
    return i.label;
}
function subline(row: ActionRecord): string | undefined {
    const c = row.chapterId ? chapters.get(row.chapterId) : undefined;
    if (row.action === 'ChapterDownloaded') return [c?.title, c?.fileName].filter(Boolean).join(' · ') || undefined;
    if (row.action === 'CoverDownloaded') return row.filename ?? undefined;
    if (row.action === 'DataMoved') return row.from && row.to ? `${row.from} → ${row.to}` : undefined;
    return undefined;
}
function detailRows(row: ActionRecord): [string, string][] {
    const c = row.chapterId ? chapters.get(row.chapterId) : undefined;
    const out: [string, string][] = [
        ['When', `${new Date(row.performedAt).toLocaleString()} (${row.performedAt} UTC)`],
        ['Type', row.action],
    ];
    if (row.mangaId) out.push(['Manga', `${mangaName(row.mangaId) ?? 'Removed'} (${row.mangaId})`]);
    if (row.chapterId) out.push(['Chapter', `${c ? formatChapter(c) : ''} (${row.chapterId})`.trim()]);
    if (c?.title) out.push(['Chapter title', c.title]);
    if (c?.fileName) out.push(['File', c.fileName]);
    if (c) out.push(['Still on disk', c.downloaded ? 'Yes' : 'No']);
    if (row.filename) out.push(['File', row.filename]);
    if (row.from) out.push(['From', row.from]);
    if (row.to) out.push(['To', row.to]);
    if (row.metadataFetcher) out.push(['Metadata source', row.metadataFetcher]);
    out.push(['Entry id', row.key]);
    return out;
}

const expanded = reactive(new Set<string>());
const toggle = (key: string) => (expanded.has(key) ? expanded.delete(key) : expanded.add(key));

// Group by day: Today / Yesterday / date
const groups = computed(() => {
    const out: { label: string; rows: ActionRecord[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400e3).toDateString();
    for (const r of rows.value) {
        const d = new Date(r.performedAt);
        const ds = d.toDateString();
        const label =
            ds === today ? 'Today' : ds === yesterday ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const last = out[out.length - 1];
        if (last?.label === label) last.rows.push(r);
        else out.push({ label, rows: [r] });
    }
    return out;
});

function timeLabel(iso: string): string {
    const d = new Date(iso);
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const mins = Math.round((Date.now() - d.getTime()) / 60e3);
    if (mins < 1) return `just now · ${time}`;
    if (mins < 60) return `${mins} min ago · ${time}`;
    return time;
}
</script>
