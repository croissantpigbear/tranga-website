<template>
    <div v-if="activeView === 'overview'" class="flex flex-col divide-y divide-default">
        <MangaOverviewRow
            v-for="(m, i) in manga"
            :key="m.key"
            :manga="m"
            :selectable="selectable"
            :selected="selectedSet.has(m.key)"
            :id="anchorIds.get(m.key)"
            :class="anchorIds.has(m.key) && anchorScrollMargin"
            @click="(_, e) => onItemClick(m, i, e)" />
    </div>
    <div
        v-else
        class="grid min-sm:grid-cols-[repeat(auto-fill,_minmax(var(--mangacover-width),_1fr))] max-sm:grid-cols-[repeat(auto-fill,_minmax(var(--mangacover-width-sm),_1fr))] gap-4">
        <MangaCard
            v-for="(m, i) in manga"
            :key="m.key"
            :manga="m"
            :selectable="selectable"
            :selected="selectedSet.has(m.key)"
            :id="anchorIds.get(m.key)"
            :class="['cursor-pointer', anchorIds.has(m.key) && anchorScrollMargin]"
            @click="(e: MouseEvent) => onItemClick(m, i, e)" />
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
import type { MangaView } from '~/composables/useMangaView';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];

const emit = defineEmits<{ (e: 'click', manga: MinimalManga | Manga): void }>();
// `view` forces a layout; without it the list follows the user's saved preference (see MangaViewToggle).
// `selectable` turns clicks into selection toggles (Shift+click selects a range); keys go to v-model:selected.
// `alphaAnchors` puts an id on the first manga of each letter, for the A–Z jump bar (list must be sorted by title)
const props = defineProps<{ manga?: (MinimalManga | Manga)[]; view?: MangaView; selectable?: boolean; alphaAnchors?: boolean }>();

// Leave room for the sticky header + toolbar when jumping to an anchor
const anchorScrollMargin = 'scroll-mt-[calc(var(--ui-header-height)+4.5rem)]';
const anchorIds = computed(() => {
    const ids = new Map<string, string>();
    if (!props.alphaAnchors) return ids;
    const seen = new Set<string>();
    for (const m of props.manga ?? []) {
        const letter = alphaLetterOf(m.name);
        if (seen.has(letter)) continue;
        seen.add(letter);
        ids.set(m.key, alphaAnchorId(letter));
    }
    return ids;
});
const selected = defineModel<string[]>('selected', { default: () => [] });

const savedView = useMangaView();
const activeView = computed<MangaView>(() => props.view ?? savedView.value ?? 'grid');

const selectedSet = computed(() => new Set(selected.value));
let lastClickedIndex = -1;
watch(
    () => props.selectable,
    () => (lastClickedIndex = -1)
);

function onItemClick(m: MinimalManga | Manga, index: number, event?: MouseEvent | KeyboardEvent) {
    if (!props.selectable) {
        emit('click', m);
        return;
    }
    const keys = new Set(selected.value);
    const select = !keys.has(m.key);
    if (event?.shiftKey && lastClickedIndex >= 0 && props.manga) {
        const [from, to] = [Math.min(lastClickedIndex, index), Math.max(lastClickedIndex, index)];
        for (const item of props.manga.slice(from, to + 1)) {
            if (select) keys.add(item.key);
            else keys.delete(item.key);
        }
    } else if (select) keys.add(m.key);
    else keys.delete(m.key);
    lastClickedIndex = index;
    selected.value = [...keys];
}
</script>
