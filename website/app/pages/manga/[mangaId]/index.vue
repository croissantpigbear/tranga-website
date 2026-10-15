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
                            @library-changed="refreshNuxtData(FetchKeys.Manga.Id(mangaId))" />
                    </UFormField>
                    <UFormField v-if="manga" label="Download from" class="mt-3">
                        <div class="flex flex-col gap-2">
                            <div
                                v-for="source in sortedSources"
                                :key="source.key"
                                class="bg-elevated px-2 py-1 rounded-lg flex flex-row items-center gap-2">
                                <MangaconnectorIcon v-bind="source" />
                                <span class="text-sm grow truncate">{{ source.mangaConnectorName }}</span>
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
                        </div>
                    </UFormField>
                </UCard>
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

// Shared by the summary and the chapter list (sizes, delete chapter file, next check)
const chapterFiles = useChapterFiles(mangaId);
onMounted(() => chapterFiles.load());

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
