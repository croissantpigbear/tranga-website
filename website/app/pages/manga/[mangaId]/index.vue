<template>
    <MangaDetailPage :manga="manga">
        <div class="grid gap-3 max-xl:grid-flow-row-dense min-2xl:grid-cols-[70%_auto] min-xl:grid-cols-[60%_auto] relative min-xl:h-full">
            <div class="flex flex-col gap-2 min-xl:h-full min-xl:overflow-y-scroll min-w-0">
                <ChapterSummary :manga-id="mangaId" :manga="manga" :chapter-files="chapterFiles" />
                <ChaptersList :manga-id="mangaId" :chapter-files="chapterFiles" />
            </div>
            <div class="flex flex-col gap-2">
                <UCard :class="[flashDownloading ? 'animate-[flash_0.75s_ease_0.5s]' : '']">
                    <template #header>
                        <h1 class="font-semibold">Download</h1>
                        <p class="text-xs text-muted mt-0.5">Where chapters are saved, and which websites to download them from.</p>
                    </template>
                    <UFormField label="Save to library">
                        <LibrarySelect
                            :manga-id="mangaId"
                            :library-id="manga?.fileLibraryId"
                            class="w-full"
                            @library-changed="refreshNuxtData(FetchKeys.Manga.Id(mangaId)).then(() => seriesFolder?.load())" />
                    </UFormField>
                    <UFormField v-if="manga" label="Download from" class="mt-3">
                        <div class="flex flex-col gap-2">
                            <div
                                v-for="source in sortedSources"
                                :key="source.key"
                                class="bg-elevated px-2 py-1 rounded-lg flex flex-row items-center gap-2">
                                <MangaconnectorIcon v-bind="source" />
                                <span class="text-sm grow truncate">{{ source.mangaConnectorName }}</span>
                                <UTooltip
                                    v-if="downloadingFromCount > 1 && source.useForDownload"
                                    :text="
                                        preferred === source.mangaConnectorName
                                            ? 'Preferred: chapters come from here when this website has them. Click to clear.'
                                            : 'Make this the preferred website: chapters come from here when it has them, the others fill gaps'
                                    ">
                                    <UButton
                                        size="sm"
                                        :variant="preferred === source.mangaConnectorName ? 'soft' : 'ghost'"
                                        :color="preferred === source.mangaConnectorName ? 'warning' : 'neutral'"
                                        :icon="preferred === source.mangaConnectorName ? 'i-lucide-star' : 'i-lucide-star-off'"
                                        :aria-label="`Prefer ${source.mangaConnectorName}`"
                                        loading-auto
                                        @click="setPreferred(preferred === source.mangaConnectorName ? null : source.mangaConnectorName)" />
                                </UTooltip>
                                <UButton
                                    size="sm"
                                    :variant="source.useForDownload ? 'soft' : 'outline'"
                                    :color="source.useForDownload ? 'success' : 'neutral'"
                                    :icon="source.useForDownload ? 'i-lucide-cloud-check' : 'i-lucide-cloud-off'"
                                    :disabled="!manga?.fileLibraryId"
                                    loading-auto
                                    @click="setRequestedFrom(source.mangaConnectorName, !source.useForDownload)">
                                    {{ source.useForDownload ? 'Downloading' : 'Not downloading' }}
                                </UButton>
                            </div>
                            <p v-if="!manga.fileLibraryId" class="text-xs text-warning">Choose a library first.</p>
                            <p v-else class="text-xs text-muted">Click to switch downloading from a website on or off.</p>
                            <p v-if="downloadingFromCount > 1" class="text-xs text-muted">
                                Each chapter downloads once:
                                <template v-if="preferred">from {{ preferred }} when it has it, otherwise from the others.</template>
                                <template v-else>star a website to choose where chapters come from first.</template>
                            </p>
                        </div>
                    </UFormField>
                    <UFormField
                        v-if="manga"
                        label="Start from chapter"
                        class="mt-3"
                        :description="
                            savedStart > 0
                                ? `Chapters before ${savedStart} aren't downloaded automatically (you can still pick them in the list).`
                                : 'Every chapter is downloaded. Set a number to skip the ones before it.'
                        ">
                        <div class="flex flex-row items-center gap-2">
                            <UInputNumber v-model="startFrom" :min="0" :step="1" placeholder="First chapter" class="w-40" />
                            <UButton
                                size="sm"
                                variant="soft"
                                icon="i-lucide-save"
                                :disabled="(startFrom ?? 0) === savedStart"
                                loading-auto
                                @click="saveStartFrom">
                                Save
                            </UButton>
                            <UButton v-if="savedStart > 0" size="sm" variant="ghost" color="neutral" loading-auto @click="saveStartFrom(0)">
                                Download all
                            </UButton>
                        </div>
                    </UFormField>
                </UCard>
                <SeriesFolder ref="seriesFolder" :manga-id="mangaId" />
                <MangaMetadataFetcherTable :manga-id="mangaId" />
            </div>
        </div>
        <MangaDeleteModal v-model:open="deleteOpen" :manga="manga ? [manga] : []" @deleted="onDeleted" />
        <ComicInfoModal v-model:open="comicInfoOpen" :manga-id="mangaId" :files="chapterFiles.files.value" />
        <template #actions>
            <UButton
                icon="i-lucide-brick-wall-shield"
                :to="`/actions?mangaId=${mangaId}&return=${$route.fullPath}`"
                variant="soft"
                color="secondary">
                <span class="max-sm:hidden">Activity</span>
            </UButton>
            <UTooltip text="Combine this entry with a duplicate of the same manga">
                <UButton icon="i-lucide-merge" :to="`/manga/${manga?.key}/merge?return=${$route.fullPath}`" variant="soft" color="secondary">
                    <span class="max-sm:hidden">Merge</span>
                </UButton>
            </UTooltip>
            <UTooltip :text="canRefreshFromSource ? 'Check the website for new chapters now' : 'Not set to download from any website'">
                <UButton
                    variant="soft"
                    color="primary"
                    icon="i-lucide-refresh-cw"
                    :disabled="!canRefreshFromSource"
                    :loading="!!manga && isRefreshing(manga.key)"
                    @click="checkNow">
                    <span class="max-sm:hidden">Check for new chapters</span>
                </UButton>
            </UTooltip>
            <UTooltip v-if="chapterFiles.supported.value !== false" text="The metadata inside downloaded chapters, used by Kavita/Komga">
                <UButton variant="soft" color="secondary" icon="i-lucide-file-code-2" :disabled="!manga" @click="comicInfoOpen = true">
                    <span class="max-sm:hidden">Reader metadata</span>
                </UButton>
            </UTooltip>
            <UButton variant="soft" color="error" icon="i-lucide-trash-2" :disabled="!manga" @click="deleteOpen = true">
                <span class="max-sm:hidden">Delete series</span>
            </UButton>
        </template>
    </MangaDetailPage>
</template>

<script setup lang="ts">
import MangaDetailPage from '~/components/MangaDetailPage.vue';
const { $api } = useNuxtApp();
const route = useRoute();
const mangaId = route.params.mangaId as string;

const flashDownloading = route.hash.substring(1) == 'download';

const { data: manga } = await useApi('/v2/Manga/{MangaId}', {
    path: { MangaId: mangaId },
    key: FetchKeys.Manga.Id(mangaId),
    onResponseError: (e) => {
        console.error(e);
        navigateTo('/');
    },
    lazy: true,
    server: false,
});

const sortedSources = computed(() =>
    [...(manga.value?.mangaConnectorIds ?? [])].sort((a, b) => (a.mangaConnectorName < b.mangaConnectorName ? -1 : 1))
);

const setRequestedFrom = async (MangaConnectorName: string, IsRequested: boolean) => {
    await $api('/v2/Manga/{MangaId}/DownloadFrom/{MangaConnectorName}/{IsRequested}', {
        method: 'PATCH',
        path: { MangaId: mangaId, MangaConnectorName: MangaConnectorName, IsRequested: IsRequested },
    });
    await refreshNuxtData(FetchKeys.Manga.Id(mangaId));
};

const api = useTrangaApi();
const toast = useToast();

// Preferred website, for a series downloading from more than one
const downloadingFromCount = computed(() => (manga.value?.mangaConnectorIds ?? []).filter((id) => id.useForDownload).length);
const preferred = ref<string | null>(null);
async function loadPreferred() {
    try {
        const p = await api.call<{ preferredWebsite: string | null }>(`v2/SeriesPreferences/${encodeURIComponent(mangaId)}`);
        preferred.value = p.preferredWebsite;
    } catch {
        preferred.value = null; // older API
    }
}
async function setPreferred(website: string | null) {
    try {
        const p = await api.call<{ preferredWebsite: string | null }>(`v2/SeriesPreferences/${encodeURIComponent(mangaId)}`, {
            method: 'PUT',
            body: { preferredWebsite: website },
        });
        preferred.value = p.preferredWebsite;
    } catch (e) {
        toast.add({ title: "Couldn't change the preferred website", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    }
}
onMounted(loadPreferred);

// Start from chapter (chapters before it aren't downloaded automatically)
const savedStart = computed(() => manga.value?.ignoreChaptersBefore ?? 0);
const startFrom = ref<number | null>(null);
watch(savedStart, (v) => (startFrom.value = v > 0 ? v : null), { immediate: true });
async function saveStartFrom(value?: number | MouseEvent) {
    const n = typeof value === 'number' ? value : Math.max(0, startFrom.value ?? 0);
    try {
        await api.call(`v2/Chapters/IgnoreBefore/${encodeURIComponent(mangaId)}`, { method: 'PATCH', body: n });
        await refreshNuxtData([FetchKeys.Manga.Id(mangaId), FetchKeys.Chapters.All]);
        toast.add({
            title: n > 0 ? `Starting from chapter ${n}` : 'Downloading every chapter',
            description: n > 0 ? 'Earlier chapters that weren\'t downloaded yet are no longer selected.' : 'Earlier chapters are selected again.',
            color: 'success',
            icon: 'i-lucide-check',
        });
    } catch (e) {
        toast.add({ title: "Couldn't save", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    }
}

const seriesFolder = ref<{ load: () => Promise<void> }>();

// Shared by the summary and the chapter list (sizes, delete chapter file, next check)
const chapterFiles = useChapterFiles(mangaId);
onMounted(() => chapterFiles.load());
// The folder's file list follows downloads, deletes and re-downloads
watch(() => chapterFiles.files.value, () => seriesFolder.value?.load());

const { refreshManga, isRefreshing } = useMangaRefresh();
const canRefreshFromSource = computed(() => !!manga.value?.mangaConnectorIds.some((id) => id.useForDownload));
async function checkNow() {
    if (!manga.value) return;
    await refreshManga([manga.value]);
    await refreshNuxtData([FetchKeys.Manga.Id(mangaId), FetchKeys.Metadata.Manga(mangaId), FetchKeys.Chapters.All]);
    chapterFiles.load();
}

const deleteOpen = ref(false);
const comicInfoOpen = ref(false);
function onDeleted() {
    navigateTo('/');
}

useHead({ title: computed(() => manga.value?.name ?? 'Manga') });
</script>
