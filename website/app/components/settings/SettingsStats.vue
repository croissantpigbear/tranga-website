<template>
    <SettingsSection title="Stats" icon="i-lucide-chart-no-axes-column" description="An overview of your library.">
        <div class="grid grid-cols-2 min-md:grid-cols-4 gap-3">
            <div v-for="t in tiles" :key="t.label" class="rounded-lg bg-elevated p-3 flex flex-col gap-0.5">
                <span class="text-xs text-muted flex items-center gap-1"><UIcon :name="t.icon" class="size-3.5" />{{ t.label }}</span>
                <span class="text-2xl font-semibold tabular-nums">{{ t.value }}</span>
                <span v-if="t.sub" class="text-xs text-dimmed">{{ t.sub }}</span>
            </div>
        </div>
    </SettingsSection>
</template>

<script setup lang="ts">
const api = useTrangaApi();
const { data: stats } = useApi('/v2/Stats', { key: 'settings-stats', server: false });
const { data: manga } = useApi('/v2/Manga', { key: FetchKeys.Manga.All, server: false });

// Newer-API extras (each silently absent with an older API)
const disk = ref<{ totalBytes: number; fileCount: number; mangaCount: number }>();
const schedule = ref<{ nextChapterCheckUtc: string; intervalHours: number }>();
const server = useServerExtraMetadata();
onMounted(async () => {
    api.call<typeof disk.value>('v2/ChapterFiles/Summary').then((d) => (disk.value = d)).catch(() => {});
    api.call<typeof schedule.value>('v2/ChapterFiles/Schedule').then((s) => (schedule.value = s)).catch(() => {});
    server.load(true);
});

const fmt = (n?: number | null) => (n === undefined || n === null ? '–' : n.toLocaleString());
const libraryCount = computed(() => manga.value?.filter((m) => m.mangaConnectorIds.some((id) => id.useForDownload)).length);
const storedDetails = computed(() => {
    if (!server.state.supported || !manga.value) return undefined;
    const library = new Set(manga.value.filter((m) => m.mangaConnectorIds.some((id) => id.useForDownload)).map((m) => m.key));
    return [...server.entries.keys()].filter((k) => library.has(k)).length;
});
const nextCheck = computed(() => {
    if (!schedule.value) return undefined;
    const minutes = Math.round((new Date(schedule.value.nextChapterCheckUtc).getTime() - Date.now()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return minutes <= 1 ? 'any moment' : minutes < 90 ? rtf.format(minutes, 'minute') : rtf.format(Math.round(minutes / 60), 'hour');
});

const tiles = computed(() => {
    const s = stats.value;
    const out: { label: string; value: string; sub?: string; icon: string }[] = [
        {
            label: 'Manga downloading',
            value: fmt(libraryCount.value),
            sub: s ? `${fmt(s.numberManga)} in database` : undefined,
            icon: 'i-lucide-book-copy',
        },
        {
            label: 'Chapters downloaded',
            value: fmt(s?.downloadedChapters),
            sub: s ? `of ${fmt(s.numberChapters)} known` : undefined,
            icon: 'i-lucide-download',
        },
        { label: 'Chapters not on disk', value: fmt(s?.missingChapters), sub: 'includes ones not selected for download', icon: 'i-lucide-circle-alert' },
    ];
    if (disk.value) out.push({ label: 'Disk used', value: formatBytes(disk.value.totalBytes), sub: `${fmt(disk.value.fileCount)} chapter files`, icon: 'i-lucide-hard-drive' });
    if (storedDetails.value !== undefined && libraryCount.value !== undefined)
        out.push({
            label: 'Extra details stored',
            value: `${fmt(storedDetails.value)} / ${fmt(libraryCount.value)}`,
            sub: storedDetails.value < libraryCount.value ? 'rest is fetched in the background' : 'all done',
            icon: 'i-lucide-database',
        });
    if (nextCheck.value)
        out.push({
            label: 'Next chapter check',
            value: nextCheck.value,
            sub: `every ${Math.round(schedule.value!.intervalHours)} h`,
            icon: 'i-lucide-clock',
        });
    out.push(
        { label: 'Authors', value: fmt(s?.numberAuthors), icon: 'i-lucide-pen-line' },
        { label: 'Tags', value: fmt(s?.numberTags), icon: 'i-lucide-tags' },
        { label: 'Notifications sent', value: fmt(s?.sentNotifications), icon: 'i-lucide-bell' },
        { label: 'Activity entries', value: fmt(s?.actionsTaken), icon: 'i-lucide-list' }
    );
    return out;
});
</script>
