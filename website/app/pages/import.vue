<template>
    <TrangaPage>
        <template #title>
            <p class="text-2xl font-semibold max-sm:text-xl">Import existing folders</p>
        </template>
        <div class="flex flex-col gap-4 pb-10 max-w-4xl mx-auto w-full">
            <UCard>
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-muted">
                        Series folders in your library that Tranga doesn't know about (from before Tranga, another downloader, or a lost
                        database). Find the series for a folder and add it: Tranga keeps saving into that folder, and chapters already there
                        count as downloaded, so only missing ones are downloaded.
                    </p>
                    <UFormField label="Library">
                        <USelectMenu v-model="libraryId" :items="libraryItems" value-key="value" class="w-full max-w-md" icon="i-lucide-library-big" />
                    </UFormField>
                </div>
            </UCard>

            <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-x" :title="error" />
            <UAlert
                v-else-if="scan && !scan.folderFound"
                color="warning"
                variant="subtle"
                icon="i-lucide-folder-x"
                :title="`Tranga can't read ${scan.basePath}`"
                description="Check the library's folder is mounted into the tranga-api container." />

            <template v-if="loading">
                <USkeleton v-for="i in 4" :key="i" class="h-16 w-full" />
            </template>
            <template v-else-if="scan?.folderFound">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <p class="text-sm text-muted grow">
                        {{ scan.folders.length }} {{ scan.folders.length === 1 ? 'folder' : 'folders' }} not in Tranga
                        <template v-if="filter && shown.length !== scan.folders.length">· {{ shown.length }} shown</template>
                    </p>
                    <UInput v-model="filter" placeholder="Filter folders" icon="i-lucide-search" size="sm" class="w-56 max-sm:w-full" />
                    <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-refresh-cw" @click="load">Scan again</UButton>
                </div>
                <div class="flex flex-col divide-y divide-default rounded-lg border border-default">
                    <div v-for="f in shown" :key="f.folderName" class="flex flex-row flex-wrap items-center gap-3 p-3">
                        <UIcon name="i-lucide-folder" class="size-5 text-primary shrink-0" />
                        <div class="grow min-w-0 basis-60">
                            <p class="font-medium break-words">{{ f.folderName }}</p>
                            <p class="text-xs text-muted">
                                {{ f.chapterFiles }} {{ f.chapterFiles === 1 ? 'file' : 'files' }} · {{ sizeText(f.sizeBytes) }}
                                <template v-if="f.firstChapter"> · Ch. {{ f.firstChapter }}{{ f.lastChapter !== f.firstChapter ? `–${f.lastChapter}` : '' }}</template>
                            </p>
                        </div>
                        <UButton size="sm" icon="i-lucide-search" :to="findLink(f.folderName)">Find series</UButton>
                    </div>
                    <p v-if="!shown.length" class="p-4 text-sm text-muted">
                        {{ scan.folders.length ? 'No folders match.' : 'Every folder with chapter files is already in Tranga.' }}
                    </p>
                </div>
            </template>
        </div>
    </TrangaPage>
</template>

<script setup lang="ts">
interface ImportFolder {
    folderName: string;
    chapterFiles: number;
    sizeBytes: number;
    firstChapter?: string | null;
    lastChapter?: string | null;
}
interface ImportScan {
    libraryName: string;
    basePath: string;
    folderFound: boolean;
    folders: ImportFolder[];
}

const route = useRoute();
const router = useRouter();
const api = useTrangaApi();
const { data: libraries } = useApi('/v2/FileLibrary', { key: FetchKeys.FileLibraries, server: false });
const libraryItems = computed(() => (libraries.value ?? []).map((l) => ({ value: l.key, label: `${l.libraryName} (${l.basePath})` })));
const libraryId = ref<string | undefined>(route.query.library as string | undefined);
watch(libraries, (libs) => {
    if (!libraryId.value && libs?.length) libraryId.value = libs[0]!.key;
});

const scan = ref<ImportScan>();
const loading = ref(false);
const error = ref('');
const filter = ref('');

async function load() {
    if (!libraryId.value) return;
    loading.value = true;
    error.value = '';
    try {
        scan.value = await api.call<ImportScan>(`v2/LibraryImport/${encodeURIComponent(libraryId.value)}`);
    } catch (e) {
        scan.value = undefined;
        error.value =
            api.statusOf(e) === 405 || (api.statusOf(e) === 404 && !(e as { data?: unknown }).data)
                ? 'Your Tranga API is too old for importing; update the tranga-api container.'
                : `Couldn't read the library: ${api.messageOf(e)}`;
    } finally {
        loading.value = false;
    }
}
watch(libraryId, (id) => {
    router.replace({ query: { ...route.query, library: id } });
    load();
});
onMounted(load);

const shown = computed(() => {
    const q = filter.value.trim().toLowerCase();
    return (scan.value?.folders ?? []).filter((f) => !q || f.folderName.toLowerCase().includes(q));
});

/** Search for the folder's series; adding it from the results links the folder */
function findLink(folder: string): string {
    // "Title (2019) [Group]" → "Title"
    const q = folder.replace(/[[(][^\])]*[\])]/g, ' ').replace(/\s+/g, ' ').trim() || folder;
    const params = new URLSearchParams({
        q,
        importLibrary: libraryId.value ?? '',
        importFolder: folder,
        return: `/import?library=${libraryId.value ?? ''}`,
    });
    return `/search?${params.toString()}`;
}

function sizeText(n: number): string {
    return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

useHead({ title: 'Import existing folders' });
</script>
