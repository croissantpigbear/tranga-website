<template>
    <div class="w-full pt-2">
        <!-- Filters -->
        <div class="flex flex-row flex-wrap gap-2 items-end mb-2">
            <UFormField label="Title" class="grow min-w-40">
                <UInput v-model="filter.name" placeholder="Search chapter titles" icon="i-lucide-search" class="w-full">
                    <template v-if="filter.name" #trailing>
                        <UButton icon="i-lucide-x" size="xs" variant="link" color="neutral" aria-label="Clear" @click="filter.name = undefined" />
                    </template>
                </UInput>
            </UFormField>
            <UFormField label="Volume">
                <UInput v-model="volumeText" placeholder="Any" inputmode="numeric" class="w-24">
                    <template v-if="volumeText" #trailing>
                        <UButton icon="i-lucide-x" size="xs" variant="link" color="neutral" aria-label="Clear" @click="volumeText = ''" />
                    </template>
                </UInput>
            </UFormField>
            <UFormField label="Chapter">
                <UInput v-model="filter.chapterNumber" placeholder="Any" class="w-24">
                    <template v-if="filter.chapterNumber" #trailing>
                        <UButton
                            icon="i-lucide-x"
                            size="xs"
                            variant="link"
                            color="neutral"
                            aria-label="Clear"
                            @click="filter.chapterNumber = undefined" />
                    </template>
                </UInput>
            </UFormField>
            <UFormField label="Show">
                <UFieldGroup>
                    <UButton
                        v-for="o in downloadedOptions"
                        :key="o.label"
                        size="md"
                        :variant="filter.downloaded === o.value ? 'solid' : 'outline'"
                        :color="filter.downloaded === o.value ? 'primary' : 'neutral'"
                        @click="filter.downloaded = o.value">
                        {{ o.label }}
                    </UButton>
                </UFieldGroup>
            </UFormField>
        </div>
        <div class="flex flex-row flex-wrap items-center justify-between gap-2 mb-2">
            <p class="text-dimmed text-sm">{{ data?.totalCount ?? 0 }} chapters{{ filtering ? ' match' : '' }}</p>
            <UPagination
                :default-page="pagination.pageIndex + 1"
                :items-per-page="pagination.pageSize"
                :total="data?.totalCount ?? 0"
                @update:page="(p) => (pagination.pageIndex = p - 1)" />
        </div>

        <!-- Chapters -->
        <UPageList class="gap-2 px-[1px] py-[1px]">
            <UPageCard
                v-for="chapter in data?.data"
                :id="chapter.key"
                :key="chapter.key"
                orientation="horizontal"
                :ui="{ container: 'p-2 sm:p-2' }"
                :class="[$route.hash.substring(1) == chapter.key ? 'animate-[flash_0.75s_ease_0.5s]' : '']">
                <template #title>
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <p class="text-secondary">
                            <span v-if="chapter.volume" class="mr-1">Vol. {{ chapter.volume }}</span>
                            <span class="inline">Ch. {{ chapter.chapterNumber }}</span>
                        </p>
                        <UBadge
                            size="sm"
                            variant="subtle"
                            :color="chapter.downloaded ? 'success' : isWaiting(chapter) ? 'info' : 'neutral'"
                            :icon="chapter.downloaded ? 'i-lucide-circle-check' : isWaiting(chapter) ? 'i-lucide-hourglass' : 'i-lucide-cloud-off'">
                            {{ chapter.downloaded ? 'Downloaded' : isWaiting(chapter) ? 'Waiting to download' : 'Not selected' }}
                        </UBadge>
                    </div>
                    <p v-if="chapter.title && chapter.title !== `Ch. ${chapter.chapterNumber}`" class="text-primary text-sm">{{ chapter.title }}</p>
                </template>
                <template #description>
                    <p v-if="fileOf(chapter)" class="text-xs">
                        {{ formatBytes(fileOf(chapter)!.sizeBytes) }} · downloaded
                        <span :title="new Date(fileOf(chapter)!.modifiedUtc).toLocaleString()">
                            {{ formatDownloadDate(fileOf(chapter)!.modifiedUtc) }}
                        </span>
                        <span class="text-dimmed"> · {{ fileOf(chapter)!.fileName }}</span>
                    </p>
                    <p v-else-if="chapter.fileName" class="text-xs text-dimmed">{{ chapter.fileName }}</p>
                </template>
                <template #default>
                    <div class="flex flex-row flex-wrap gap-2 w-full items-center min-xl:justify-end">
                        <div
                            v-for="source in sortedSources(chapter)"
                            :key="source.key"
                            class="bg-elevated px-1.5 py-1 rounded-lg flex items-center gap-1.5">
                            <MangaconnectorIcon v-bind="source" />
                            <UTooltip :text="source.useForDownload ? 'Click to stop downloading this chapter' : 'Click to download this chapter'">
                                <UButton
                                    size="xs"
                                    :variant="source.useForDownload ? 'soft' : 'outline'"
                                    :color="source.useForDownload ? 'success' : 'neutral'"
                                    :icon="source.useForDownload ? 'i-lucide-cloud-check' : 'i-lucide-cloud-download'"
                                    loading-auto
                                    @click="setDownload(chapter.key, source.mangaConnectorName, !source.useForDownload)">
                                    {{ source.useForDownload ? 'Downloading' : 'Download' }}
                                </UButton>
                            </UTooltip>
                        </div>
                        <UButton
                            v-if="chapter.downloaded && chapterFiles?.supported.value"
                            size="xs"
                            variant="soft"
                            color="error"
                            icon="i-lucide-trash-2"
                            @click="askDelete(chapter)">
                            Delete file
                        </UButton>
                    </div>
                </template>
            </UPageCard>
        </UPageList>

        <ConfirmDialog
            v-model:open="deleteOpen"
            :title="`Delete ${deleteTarget ? chapterLabel(deleteTarget) : 'chapter'}?`"
            confirm-label="Delete file"
            :action="confirmDelete">
            <p>
                This deletes the downloaded file
                <span v-if="deleteTarget && fileOf(deleteTarget)" class="font-medium"
                    >({{ fileOf(deleteTarget)!.fileName }}, {{ formatBytes(fileOf(deleteTarget)!.sizeBytes) }})</span
                >
                from your library folder.
            </p>
            <p class="text-muted">
                The chapter stays in the list but won't be downloaded again. Click "Download" next to it later if you want it back.
            </p>
            <p v-if="deleteError" class="text-error">{{ deleteError }}</p>
        </ConfirmDialog>
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type ChapterFilterRecord = components['schemas']['ChapterFilterRecord'];
type Chapter = components['schemas']['Chapter'];

const filter = ref<Partial<ChapterFilterRecord>>({});
const pagination = ref({ pageIndex: 0, pageSize: 10 });

export interface ChaptersListProps {
    mangaId: string;
    /** From useChapterFiles: file sizes/dates and single-chapter delete (newer API) */
    chapterFiles?: ReturnType<typeof useChapterFiles>;
}
const props = defineProps<ChaptersListProps>();
const { $api } = useNuxtApp();

const downloadedOptions: { label: string; value: boolean | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Downloaded', value: true },
    { label: 'Not downloaded', value: false },
];

// Volume is a number in the API filter; keep the text box simple
const volumeText = computed({
    get: () => (filter.value.volumeNumber === undefined || filter.value.volumeNumber === null ? '' : String(filter.value.volumeNumber)),
    set: (v: string) => {
        const n = parseInt(v, 10);
        filter.value.volumeNumber = v.trim() === '' || Number.isNaN(n) ? undefined : n;
    },
});
const filtering = computed(() => Object.values(filter.value).some((v) => v !== undefined && v !== ''));
watch(filter, () => (pagination.value.pageIndex = 0), { deep: true });

const { data, refresh } = useAsyncData(
    FetchKeys.Chapters.All,
    () =>
        $api('/v2/Chapters/Manga/{MangaId}', {
            method: 'POST',
            query: { page: pagination.value.pageIndex + 1, pageSize: pagination.value.pageSize },
            path: { MangaId: props.mangaId },
            body: filter.value,
        }),
    { watch: [pagination.value, filter.value], lazy: true, server: false }
);

const sortedSources = (c: Chapter) => [...c.mangaConnectorIds].sort((a, b) => (a.mangaConnectorName < b.mangaConnectorName ? -1 : 1));
const isWaiting = (c: Chapter) => !c.downloaded && c.mangaConnectorIds.some((id) => id.useForDownload);
const fileOf = (c: Chapter) => props.chapterFiles?.files.value.get(c.key);
const chapterLabel = (c: Chapter) => `${c.volume ? `Vol. ${c.volume} ` : ''}Ch. ${c.chapterNumber}`;

const setDownload = async (chapterId: string, mangaConnector: string, requested: boolean) => {
    await $api('/v2/Chapters/{ChapterId}/DownloadFrom/{MangaConnectorName}/{IsRequested}', {
        method: 'PATCH',
        path: { ChapterId: chapterId, MangaConnectorName: mangaConnector, IsRequested: requested },
    });
    await refresh();
    props.chapterFiles?.load();
};

// Delete a single chapter's file
const deleteOpen = ref(false);
const deleteTarget = ref<Chapter>();
const deleteError = ref('');
function askDelete(c: Chapter) {
    deleteTarget.value = c;
    deleteError.value = '';
    deleteOpen.value = true;
}
async function confirmDelete() {
    if (!deleteTarget.value || !props.chapterFiles) return;
    try {
        await props.chapterFiles.deleteFile(deleteTarget.value.key);
    } catch (e) {
        deleteError.value = `Couldn't delete the file: ${(e as { data?: string })?.data ?? (e as Error).message}`;
        throw e; // keep the dialog open
    }
    await refresh();
}
</script>
