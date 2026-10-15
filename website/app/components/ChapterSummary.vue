<template>
    <UCard :ui="{ body: 'p-3 sm:p-3' }">
        <div v-if="total === undefined" class="flex flex-col gap-2">
            <USkeleton class="h-4 w-48" />
            <USkeleton class="h-2 w-full" />
        </div>
        <div v-else class="flex flex-col gap-2 text-sm">
            <div class="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p>
                    <span class="font-semibold">{{ downloadedCount }} of {{ total }}</span>
                    chapters downloaded
                    <span v-if="chapterFiles.totalBytes.value !== undefined" class="text-muted">
                        · {{ formatBytes(chapterFiles.totalBytes.value) }} on disk
                    </span>
                </p>
                <p v-if="nextCheckText" class="text-xs text-muted flex flex-row items-center gap-1">
                    <UIcon name="i-lucide-clock" class="size-3.5" />
                    {{ nextCheckText }}
                </p>
            </div>
            <div
                class="h-2 w-full rounded-full bg-elevated overflow-hidden"
                role="progressbar"
                :aria-valuenow="downloadedCount"
                :aria-valuemax="total">
                <div class="h-full bg-success transition-[width]" :style="{ width: `${percent}%` }" />
            </div>
            <ul v-if="notes.length" class="flex flex-col gap-1 text-xs">
                <li v-for="n in notes" :key="n.label" class="flex flex-row items-start gap-1.5" :class="n.class">
                    <UIcon :name="n.icon" class="size-3.5 mt-px shrink-0" />
                    <span><span class="font-medium">{{ n.label }}:</span> {{ n.text }}</span>
                </li>
            </ul>
        </div>
    </UCard>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type Manga = components['schemas']['Manga'];
type Chapter = components['schemas']['Chapter'];

const props = defineProps<{ mangaId: string; manga?: Manga | null; chapterFiles: ReturnType<typeof useChapterFiles> }>();
const { $api } = useNuxtApp();

// All chapters (not just the current page of the list) for the totals and gap check
const { data: chapters, refresh } = useAsyncData(
    `ChapterSummary/${props.mangaId}`,
    () =>
        $api('/v2/Chapters/Manga/{MangaId}', {
            method: 'POST',
            path: { MangaId: props.mangaId },
            query: { page: 1, pageSize: 100000 },
            body: {},
        }),
    { lazy: true, server: false }
);
// Re-count after a chapter file is deleted / the list is refreshed
watch(() => props.chapterFiles.files.value, () => refresh());

const list = computed<Chapter[]>(() => chapters.value?.data ?? []);
const total = computed(() => (chapters.value ? (chapters.value.totalCount ?? list.value.length) : undefined));
const downloadedCount = computed(() => list.value.filter((c) => c.downloaded).length);
const percent = computed(() => (total.value ? Math.round((downloadedCount.value / total.value) * 100) : 0));

const toNumbers = (cs: Chapter[]) => cs.map((c) => parseFloat(c.chapterNumber)).filter(Number.isFinite);

const notes = computed(() => {
    const out: { label: string; text: string; icon: string; class: string }[] = [];
    const notDownloaded = list.value.filter((c) => !c.downloaded);
    const waiting = notDownloaded.filter((c) => c.mangaConnectorIds.some((id) => id.useForDownload));
    const skipped = notDownloaded.filter((c) => !c.mangaConnectorIds.some((id) => id.useForDownload));
    if (waiting.length)
        out.push({
            label: 'Waiting to download',
            text: formatChapterRanges(toNumbers(waiting)),
            icon: 'i-lucide-hourglass',
            class: 'text-info',
        });
    if (skipped.length)
        out.push({
            label: 'Not selected for download',
            text: formatChapterRanges(toNumbers(skipped)),
            icon: 'i-lucide-cloud-off',
            class: 'text-muted',
        });
    const gaps = chapterNumberGaps(list.value.map((c) => c.chapterNumber));
    if (gaps.length)
        out.push({
            label: 'Missing from the source',
            text: `${formatChapterRanges(gaps)} (not offered by the website${gaps.length >= 50 ? '; first 50 shown' : ''})`,
            icon: 'i-lucide-triangle-alert',
            class: 'text-warning',
        });
    return out;
});

const nextCheckText = computed(() => {
    const next = props.chapterFiles.nextCheck.value;
    const downloading = props.manga?.mangaConnectorIds.some((id) => id.useForDownload);
    if (!next || !downloading) return '';
    const minutes = Math.round((next.at.getTime() - Date.now()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const when = minutes <= 1 ? 'any moment now' : minutes < 90 ? rtf.format(minutes, 'minute') : rtf.format(Math.round(minutes / 60), 'hour');
    const every = next.intervalHours === 1 ? 'every hour' : `every ${Math.round(next.intervalHours)} hours`;
    return `Next check for new chapters ${when} (${every})`;
});
</script>
