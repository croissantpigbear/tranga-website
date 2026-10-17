<template>
    <UCard v-if="folder !== null">
        <template #header>
            <h1 class="font-semibold flex items-center gap-2"><UIcon name="i-lucide-folder-open" class="size-4" />Files</h1>
            <p class="text-xs text-muted mt-0.5">Where this series is saved, and what's in its folder.</p>
        </template>

        <USkeleton v-if="!folder" class="h-24 w-full" />
        <p v-else-if="!folder.fullPath" class="text-sm text-warning">No library chosen yet, so it isn't saved anywhere.</p>
        <div v-else class="flex flex-col gap-3">
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm items-start">
                <dt class="text-dimmed">Library</dt>
                <dd class="min-w-0 break-words">{{ folder.libraryName }} <span class="text-muted">({{ folder.libraryPath }})</span></dd>
                <dt class="text-dimmed">Folder name</dt>
                <dd class="min-w-0 flex items-start gap-1">
                    <span class="break-all font-mono text-xs pt-0.5">{{ folder.folderName }}</span>
                    <CopyButton :text="folder.folderName" label="Copy folder name" />
                </dd>
                <dt class="text-dimmed">Full path</dt>
                <dd class="min-w-0 flex items-start gap-1">
                    <span class="break-all font-mono text-xs pt-0.5">{{ folder.fullPath }}</span>
                    <CopyButton :text="folder.fullPath" label="Copy full path" />
                </dd>
            </dl>
            <p class="text-xs text-muted">
                This is the path inside Tranga. On your computer or server it's in the folder you connected to
                <code>{{ folder.libraryPath }}</code> (e.g. <code>~/tranga-plus/Manga</code> or <code>/mnt/user/Manga</code>).
                <NuxtLink to="/settings#naming" class="underline">Change folder names</NuxtLink>
            </p>

            <p v-if="!folder.exists" class="text-sm text-muted">The folder is created when the first chapter downloads.</p>
            <template v-else>
                <div class="flex flex-row flex-wrap items-center gap-2 text-sm">
                    <span class="grow">
                        {{ chapterFiles.length }} chapter {{ chapterFiles.length === 1 ? 'file' : 'files' }} · {{ sizeText(totalBytes) }}
                    </span>
                    <UBadge v-if="unknown.length" color="warning" variant="subtle" icon="i-lucide-file-question">
                        {{ unknown.length }} not matched to a chapter
                    </UBadge>
                </div>
                <ul v-if="folder.files.length" class="flex flex-col divide-y divide-default rounded-md border border-default text-xs">
                    <li v-for="f in shownFiles" :key="f.fileName" class="flex flex-row items-center gap-2 px-2 py-1.5 min-w-0">
                        <UIcon
                            :name="f.chapterId ? 'i-lucide-file-check' : f.isChapterArchive ? 'i-lucide-file-question' : 'i-lucide-file'"
                            :class="['size-4 shrink-0', f.chapterId ? 'text-success' : f.isChapterArchive ? 'text-warning' : 'text-dimmed']" />
                        <span class="font-mono break-all grow min-w-0" :title="f.fileName">{{ f.fileName }}</span>
                        <span v-if="f.chapterNumber" class="shrink-0 text-muted">Ch. {{ f.chapterNumber }}</span>
                        <span class="shrink-0 text-dimmed tabular-nums">{{ sizeText(f.sizeBytes) }}</span>
                    </li>
                </ul>
                <UButton v-if="folder.files.length > LIMIT" size="xs" variant="link" color="neutral" class="self-start" @click="showAll = !showAll">
                    {{ showAll ? 'Show fewer' : `Show all ${folder.files.length} files` }}
                </UButton>
                <p v-if="unknown.length" class="text-xs text-muted">
                    <UIcon name="i-lucide-file-question" class="size-3.5 text-warning align-text-bottom" /> Chapter files Tranga didn't download
                    or can't match (e.g. from another downloader, or a renamed file). They're left alone.
                </p>
            </template>
        </div>
    </UCard>
</template>

<script setup lang="ts">
interface FolderFile {
    fileName: string;
    sizeBytes: number;
    modifiedUtc: string;
    chapterId?: string | null;
    chapterNumber?: string | null;
    isChapterArchive: boolean;
}
interface SeriesFolder {
    libraryName?: string | null;
    libraryPath?: string | null;
    folderName: string;
    fullPath?: string | null;
    exists: boolean;
    files: FolderFile[];
}

const props = defineProps<{ mangaId: string }>();
const api = useTrangaApi();
const LIMIT = 8;

/** undefined while loading, null with an older API (card hidden) */
const folder = ref<SeriesFolder | null>();
const showAll = ref(false);

async function load() {
    try {
        folder.value = await api.call<SeriesFolder>(`v2/ChapterFiles/Manga/${encodeURIComponent(props.mangaId)}/Folder`);
    } catch (e) {
        const status = api.statusOf(e);
        if (status === 405 || (status === 404 && !(e as { data?: unknown }).data)) folder.value = null;
    }
}
onMounted(load);
defineExpose({ load });

const chapterFiles = computed(() => folder.value?.files.filter((f) => f.isChapterArchive) ?? []);
const unknown = computed(() => chapterFiles.value.filter((f) => !f.chapterId));
const totalBytes = computed(() => chapterFiles.value.reduce((s, f) => s + f.sizeBytes, 0));
const shownFiles = computed(() => (showAll.value ? folder.value?.files : folder.value?.files.slice(0, LIMIT)) ?? []);

function sizeText(n: number): string {
    return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.ceil(n / 1024))} KB`;
}
</script>
