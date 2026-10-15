<template>
    <SettingsSection
        title="Reader metadata"
        icon="i-lucide-file-code-2"
        description="The ComicInfo.xml file Tranga puts inside every downloaded chapter, which Kavita, Komga and comic readers use.">
        <p v-if="status === null" class="text-sm text-warning">This needs a newer Tranga API (the ComicInfo update).</p>
        <USkeleton v-else-if="!status" class="h-24 w-full" />
        <template v-else>
            <div
                v-if="!status.enabled"
                class="text-sm rounded-md bg-warning/10 text-warning px-3 py-2 flex items-start gap-2">
                <UIcon name="i-lucide-triangle-alert" class="size-4 mt-0.5 shrink-0" />
                <span>
                    Turned off: the API container has <code>CREATE_COMICINFO_XML=false</code>. Remove that setting (or set it to
                    <code>true</code>) in your compose file and restart to turn it on.
                </span>
            </div>

            <div class="text-sm flex flex-col gap-1.5">
                <p class="font-medium">Each chapter gets:</p>
                <ul class="grid grid-cols-1 min-md:grid-cols-2 gap-x-6 gap-y-1 text-muted">
                    <li v-for="i in INCLUDED" :key="i" class="flex items-start gap-1.5">
                        <UIcon name="i-lucide-check" class="size-4 mt-px text-success shrink-0" />{{ i }}
                    </li>
                </ul>
                <p class="text-xs text-muted mt-1">
                    Details from MangaUpdates are only included once Tranga has fetched them. If they arrive after chapters were downloaded,
                    those chapters are updated automatically. To check a series, open it and click <b>Reader metadata</b>.
                </p>
            </div>

            <div class="rounded-lg bg-elevated p-3 flex flex-row flex-wrap items-center gap-3">
                <div class="grow min-w-60">
                    <p class="font-medium">Update all downloaded chapters</p>
                    <p class="text-sm text-muted">
                        Rewrites the ComicInfo.xml in every chapter you've already downloaded, including ones downloaded before this
                        update (which only have the series summary and author). The pictures aren't touched.
                    </p>
                </div>
                <UButton
                    variant="soft"
                    icon="i-lucide-file-pen-line"
                    :disabled="!status.enabled || status.running"
                    :loading="status.running"
                    @click="confirmOpen = true">
                    {{ status.running ? 'Updating…' : 'Update all' }}
                </UButton>
            </div>

            <div v-if="status.running || status.finishedUtc" class="flex flex-col gap-1.5">
                <UProgress v-if="status.running" :model-value="status.done + status.failed" :max="Math.max(status.total, 1)" />
                <p class="text-sm text-muted">
                    <template v-if="status.running">
                        {{ status.done + status.failed }} of {{ status.total }} chapters done…
                    </template>
                    <template v-else>
                        Last full update {{ formatDate(status.finishedUtc!) }}: {{ status.done }} chapters updated<template v-if="status.failed"
                            >, <span class="text-warning">{{ status.failed }} skipped (file missing or damaged)</span></template
                        >.
                    </template>
                </p>
            </div>
        </template>

        <ConfirmDialog
            v-model:open="confirmOpen"
            title="Update all downloaded chapters?"
            confirm-label="Update all"
            color="primary"
            icon="i-lucide-file-pen-line"
            :action="rewriteAll">
            <p>
                Tranga rewrites the metadata file inside every downloaded chapter. It runs in the background and may take a while for a big
                library. Afterwards Kavita/Komga are asked to rescan.
            </p>
            <p class="text-sm text-muted mt-2">
                If Kavita doesn't pick up the changes, run <b>Scan Library</b> on that library in Kavita (or "Refresh metadata" on a
                series).
            </p>
        </ConfirmDialog>
    </SettingsSection>
</template>

<script setup lang="ts">
interface Status {
    enabled: boolean;
    running: boolean;
    total: number;
    done: number;
    failed: number;
    finishedUtc: string | null;
}

const api = useTrangaApi();
/** undefined = loading, null = API doesn't have it */
const status = ref<Status | null>();
const confirmOpen = ref(false);

const INCLUDED = [
    'Series name and English title',
    'Chapter number, volume and title',
    'Summary',
    'Writer and artist',
    'Publisher and magazine',
    'Genres and tags',
    'Age rating (from MangaDex / MangaUpdates)',
    'Community rating (MangaUpdates)',
    'Reading direction (right-to-left for Japanese manga)',
    'Year, language and page count',
    'Total chapters when the series has finished',
    'Links to MangaUpdates and the source websites',
];

let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
    clearTimeout(timer);
    try {
        status.value = await api.call<Status>('v2/ComicInfo/Status');
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) status.value = null;
        return;
    }
    if (status.value?.running) timer = setTimeout(load, 2000);
}
onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));

async function rewriteAll() {
    try {
        await api.call('v2/ComicInfo/Rewrite', { method: 'POST' });
    } catch (e) {
        if (api.statusOf(e) !== 409) throw new Error(api.messageOf(e)); // 409 = already running
    }
    await load();
    // The worker may take a moment to register as running
    if (!status.value?.running) timer = setTimeout(load, 1500);
}

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>
