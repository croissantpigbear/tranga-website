<template>
    <UCard
        :ui="{ body: 'p-0 sm:p-0', root: 'overflow-visible' }"
        :class="[
            'relative max-sm:w-[var(--mangacover-width-sm)] max-sm:h-[var(--mangacover-height-sm)] w-(--mangacover-width) h-(--mangacover-height) mt-4 mr-4',
            selected && 'ring-3 ring-primary',
            selectable && 'select-none',
        ]">
        <MangaCover :manga="manga" blur />
        <div v-if="selectable" class="absolute top-2 left-2 z-10 rounded-md bg-default/80 p-1 shadow">
            <UCheckbox :model-value="selected" :aria-label="`Select ${manga.name}`" class="pointer-events-none" tabindex="-1" />
        </div>
        <div :class="['absolute -top-4 -right-4 flex flex-col bg-pink rounded-full', selectable && 'pointer-events-none']">
            <MangaconnectorIcon v-for="m in manga.mangaConnectorIds" v-bind="m" :key="m.key" />
        </div>
    </UCard>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
import type { PageCardProps } from '#ui/components/PageCard.vue';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];

defineProps<MangaCardProps>();

export interface MangaCardProps extends /* @vue-ignore */ PageCardProps {
    manga: Manga | MinimalManga;
    selectable?: boolean;
    selected?: boolean;
}
</script>
