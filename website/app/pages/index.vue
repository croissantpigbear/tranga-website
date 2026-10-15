<template>
    <LoadingPage :loading="status === 'pending'">
        <div
            class="sticky top-(--ui-header-height) z-20 flex flex-row flex-wrap justify-between items-center gap-2 min-md:mx-4 max-md:mx-0 mt-2 py-2 bg-default/90 backdrop-blur">
            <div v-if="!selecting" class="flex flex-row items-center gap-2">
                <p class="text-muted text-sm">
                    <template v-if="filtering">{{ sortedManga.length }} of {{ manga?.length ?? 0 }} manga</template>
                    <template v-else>{{ manga?.length ?? 0 }} manga</template>
                </p>
            </div>
            <div v-else class="flex flex-row items-center gap-2">
                <p class="text-sm font-medium">{{ selected.length }} selected</p>
                <UButton size="sm" variant="ghost" color="neutral" @click="toggleAll">
                    {{ allSelected ? 'Select none' : 'Select all' }}
                </UButton>
            </div>
            <div class="flex flex-row items-center gap-2">
                <UButton
                    size="sm"
                    :variant="filterOpen || filtering ? 'soft' : 'outline'"
                    :color="filtering ? 'primary' : 'neutral'"
                    icon="i-lucide-filter"
                    :disabled="!manga?.length"
                    @click="filterOpen = !filterOpen">
                    Filter<span v-if="filtering"> ({{ activeFilterCount(filter) }})</span>
                </UButton>
                <template v-if="selecting">
                    <UButton
                        size="sm"
                        color="secondary"
                        variant="soft"
                        icon="i-lucide-refresh-cw"
                        :disabled="selected.length === 0"
                        :loading="bulkRefreshing"
                        @click="refreshSelected">
                        Refresh
                    </UButton>
                    <UButton size="sm" color="error" icon="i-lucide-trash-2" :disabled="selected.length === 0" @click="confirmOpen = true">
                        Delete
                    </UButton>
                    <UButton size="sm" variant="outline" color="neutral" @click="exitSelect">Cancel</UButton>
                </template>
                <UButton
                    v-else
                    size="sm"
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-list-checks"
                    :disabled="!manga?.length"
                    @click="selecting = true">
                    Select
                </UButton>
                <MangaViewToggle />
            </div>
        </div>
        <MangaFilterPanel
            v-if="filterOpen"
            v-model="filter"
            :options="libraryIndex.options.value"
            :progress="libraryIndex.progress"
            class="min-md:mx-4 max-md:mx-0 mt-2 mr-7" />
        <div v-if="filtering && sortedManga.length === 0" class="flex flex-col items-center gap-2 py-16 text-muted text-sm">
            <UIcon name="i-lucide-filter-x" class="size-8 text-dimmed" />
            <p>No manga match these filters.</p>
            <p v-if="libraryIndex.progress.running" class="text-xs">Still indexing details — more may appear.</p>
            <UButton size="sm" variant="outline" color="neutral" @click="Object.assign(filter, emptyMangaFilter())">Clear filters</UButton>
        </div>
        <MangaCardList
            v-model:selected="selected"
            :manga="sortedManga"
            :selectable="selecting"
            alpha-anchors
            class="min-md:mx-4 max-md:mx-0 mt-2 pr-7"
            @click="(m) => navigateTo(`/manga/${m.key}`)" />
        <AlphabetNav v-if="sortedManga.length" :letters="letters" @jump="jumpToLetter" />
        <MangaDeleteModal v-model:open="confirmOpen" :manga="selectedManga" @deleted="onDeleted" />
    </LoadingPage>
</template>

<script setup lang="ts">
import type { AlphaLetter } from '~/utils/alphaIndex';
import type { MangaFilter } from '~/utils/mangaFilter';

const { data: manga, refresh, status } = await useApi('/v2/Manga', { key: FetchKeys.Manga.All, lazy: true, server: false });
onMounted(() => refresh());

// Filters (kept while navigating within this visit). Status works instantly; the rest uses the library index.
const filter = useState<MangaFilter>('manga-filter', emptyMangaFilter);
const filterOpen = useState('manga-filter-open', () => false);
const filtering = computed(() => activeFilterCount(filter.value) > 0);
const libraryIndex = useLibraryIndex();

// Index details in the background once filters have been used in this browser (and after that, for new manga)
watch(
    [manga, filterOpen],
    ([list, open]) => {
        if (list?.length && (open || libraryIndex.isEnabled())) libraryIndex.build(list);
    },
    { immediate: true }
);

const filteredManga = computed(() =>
    filtering.value
        ? (manga.value ?? []).filter((m) => mangaMatchesFilter(m, libraryIndex.facets.get(m.key), filter.value))
        : (manga.value ?? [])
);

// A–Z order, with a jump bar on the right
const sortedManga = computed(() => [...filteredManga.value].sort(compareByTitle));
const letters = computed(() => new Set(sortedManga.value.map((m) => alphaLetterOf(m.name))));
function jumpToLetter(letter: AlphaLetter) {
    document.getElementById(alphaAnchorId(letter))?.scrollIntoView({ block: 'start' });
}

// Multi-select (for bulk delete)
const selecting = ref(false);
const selected = ref<string[]>([]);
const confirmOpen = ref(false);

const selectedManga = computed(() => {
    const keys = new Set(selected.value);
    return (manga.value ?? []).filter((m) => keys.has(m.key));
});
// "Select all" means all manga currently shown (i.e. matching the filters)
const allSelected = computed(
    () => sortedManga.value.length > 0 && sortedManga.value.every((m) => selected.value.includes(m.key))
);

function toggleAll() {
    selected.value = allSelected.value ? [] : sortedManga.value.map((m) => m.key);
}
function exitSelect() {
    selecting.value = false;
    selected.value = [];
}
const { refreshManga } = useMangaRefresh();
const bulkRefreshing = ref(false);
async function refreshSelected() {
    bulkRefreshing.value = true;
    try {
        await refreshManga(selectedManga.value);
    } finally {
        bulkRefreshing.value = false;
    }
}

function onDeleted(keys: string[]) {
    const gone = new Set(keys);
    selected.value = selected.value.filter((k) => !gone.has(k));
    if (selected.value.length === 0) selecting.value = false;
}

// Esc leaves select mode (unless the confirm dialog is open)
function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selecting.value && !confirmOpen.value) exitSelect();
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

useHead({ title: 'Tranga' });
</script>
