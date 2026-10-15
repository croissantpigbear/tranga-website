<template>
    <ClientOnly>
        <div class="flex flex-row gap-1 p-1 rounded-lg bg-elevated w-fit">
            <UTooltip v-for="o in options" :key="o.value" :text="o.label">
                <UButton
                    :icon="o.icon"
                    :aria-label="o.label"
                    :aria-pressed="view === o.value"
                    size="sm"
                    :color="view === o.value ? 'primary' : 'neutral'"
                    :variant="view === o.value ? 'solid' : 'ghost'"
                    @click="view = o.value">
                    <span class="max-md:hidden">{{ o.short }}</span>
                </UButton>
            </UTooltip>
        </div>
    </ClientOnly>
</template>

<script setup lang="ts">
import type { MangaView } from '~/composables/useMangaView';

const view = useMangaView();

const options: { value: MangaView; label: string; short: string; icon: string }[] = [
    { value: 'grid', label: 'Poster grid', short: 'Grid', icon: 'i-lucide-layout-grid' },
    { value: 'overview', label: 'Overview list with details', short: 'List', icon: 'i-lucide-list' },
];
</script>
