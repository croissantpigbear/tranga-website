<template>
    <UBadge :color="info.color" :icon="info.icon" variant="subtle" :size="size">{{ info.label }}</UBadge>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type MangaReleaseStatus = components['schemas']['MangaReleaseStatus'];

const props = withDefaults(defineProps<{ status?: MangaReleaseStatus | null; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });

const info = computed(() => releaseStatusInfo(props.status));
</script>
