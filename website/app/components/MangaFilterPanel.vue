<template>
    <div class="rounded-lg border border-default bg-elevated/40 p-3 flex flex-col gap-3">
        <div class="grid grid-cols-1 min-sm:grid-cols-2 min-xl:grid-cols-3 gap-3">
            <UFormField label="Status" hint="any of">
                <USelectMenu
                    v-model="filter.statuses"
                    :items="statusItems"
                    value-key="value"
                    multiple
                    :search-input="false"
                    placeholder="Any status"
                    icon="i-lucide-activity"
                    class="w-full" />
            </UFormField>
            <UFormField label="Age rating" hint="any of">
                <USelectMenu
                    v-model="filter.ratings"
                    :items="ratingItems"
                    value-key="value"
                    multiple
                    :search-input="false"
                    placeholder="Any rating"
                    icon="i-lucide-shield"
                    class="w-full" />
            </UFormField>
            <UFormField label="Genres" hint="must have all">
                <UInputMenu
                    v-model="filter.genres"
                    :items="options.genres"
                    multiple
                    placeholder="Type a genre, e.g. com…"
                    icon="i-lucide-tags"
                    class="w-full" />
            </UFormField>
            <UFormField label="Writer" hint="any of">
                <UInputMenu
                    v-model="filter.writers"
                    :items="options.writers"
                    multiple
                    placeholder="Type a name…"
                    icon="i-lucide-pen-line"
                    class="w-full" />
            </UFormField>
            <UFormField label="Artist" hint="any of">
                <UInputMenu
                    v-model="filter.artists"
                    :items="options.artists"
                    multiple
                    placeholder="Type a name…"
                    icon="i-lucide-palette"
                    class="w-full" />
            </UFormField>
            <UFormField label="Publisher" hint="any of">
                <UInputMenu
                    v-model="filter.publishers"
                    :items="options.publishers"
                    multiple
                    placeholder="Type a publisher…"
                    icon="i-lucide-building-2"
                    class="w-full" />
            </UFormField>
        </div>

        <div class="flex flex-row flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <div v-if="progress.running" class="flex flex-row items-center gap-2 grow min-w-48">
                <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin shrink-0" />
                <span class="shrink-0">Indexing details {{ progress.done }} / {{ progress.total }}</span>
                <div class="h-1.5 grow max-w-64 rounded-full bg-default overflow-hidden">
                    <div class="h-full bg-primary transition-[width]" :style="{ width: `${percent}%` }" />
                </div>
                <span class="max-sm:hidden">— filters cover what's indexed so far</span>
            </div>
            <span v-else-if="progress.total">Details indexed for {{ progress.total }} manga (refreshed weekly)</span>
            <span v-else />
            <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                :disabled="activeFilterCount(filter) === 0"
                @click="Object.assign(filter, emptyMangaFilter())">
                Clear filters
            </UButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { MangaFilter, RatingFilterValue } from '~/utils/mangaFilter';

const filter = defineModel<MangaFilter>({ required: true });
const props = defineProps<{
    options: { writers: string[]; artists: string[]; publishers: string[]; genres: string[] };
    progress: { total: number; done: number; running: boolean };
}>();

const percent = computed(() => (props.progress.total ? Math.round((props.progress.done / props.progress.total) * 100) : 0));

const statusItems = (['Continuing', 'Completed', 'OnHiatus', 'Cancelled', 'Unreleased'] as const).map((value) => ({
    value,
    label: releaseStatusInfo(value).label,
    icon: releaseStatusInfo(value).icon,
}));

const ratingItems: { value: RatingFilterValue; label: string }[] = [
    { value: 'safe', label: 'Safe' },
    { value: 'suggestive', label: 'Suggestive' },
    { value: 'erotica', label: 'Erotica (18+)' },
    { value: 'pornographic', label: 'Explicit (18+)' },
    { value: 'unknown', label: 'Unknown' },
];
</script>
