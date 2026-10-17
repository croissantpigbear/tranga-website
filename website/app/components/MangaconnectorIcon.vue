<template>
    <div class="w-6 h-6 inline-block align-middle m-1">
        <NuxtLink :href="props.websiteUrl ?? ''" target="_blank" external no-prefetch>
            <UTooltip :text="`${siteName} · ${props.useForDownload ? 'downloading' : 'not downloading'} — click to open the website`">
                <img
                    v-if="iconUrl && !failed"
                    :src="iconUrl"
                    :alt="siteName"
                    loading="lazy"
                    decoding="async"
                    :class="['w-6 h-6 rounded-full object-cover bg-elevated outline-2 -outline-offset-1', outline]"
                    @error="failed = true" />
                <!-- No icon: the site's initials -->
                <span
                    v-else
                    :class="[
                        'w-6 h-6 rounded-full bg-elevated outline-2 -outline-offset-1 flex items-center justify-center',
                        'text-[9px] font-semibold leading-none text-default select-none',
                        outline,
                    ]"
                    :aria-label="siteName">
                    {{ initials }}
                </span>
            </UTooltip>
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type MangaMangaConnectorId = components['schemas']['MangaMangaConnectorId'];
type ChapterMangaConnectorId = components['schemas']['ChapterMangaConnectorId'];

const props = defineProps<MangaMangaConnectorId | ChapterMangaConnectorId>();
const config = useRuntimeConfig();

const { data: mangaConnector } = await useApi('/v2/MangaConnector/{MangaConnectorName}', {
    path: { MangaConnectorName: props.mangaConnectorName },
    key: FetchKeys.MangaConnector.Id(props.mangaConnectorName),
    server: false,
});

const failed = ref(false);
const siteName = computed(() => mangaConnector.value?.name ?? props.mangaConnectorName);
/** Websites added from FMD2 modules have their icon served by the Tranga API ("/v2/…") */
const iconUrl = computed(() => {
    const url = mangaConnector.value?.iconUrl;
    if (!url) return undefined;
    return url.startsWith('/v2/') ? `${config.public.openFetch.api.baseURL}${url.slice(1)}` : url;
});
watch(iconUrl, () => (failed.value = false));
const outline = computed(() => (props.useForDownload ? 'outline-green-500' : 'outline-red-500'));

/** "MangaFire" → "MF", "Asura Scans" → "AS", "mangadex" → "MA" */
const initials = computed(() => {
    const name = siteName.value.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length > 1) return (words[0]![0]! + words[1]![0]!).toUpperCase();
    const capitals = name.match(/\p{Lu}/gu);
    if (capitals && capitals.length >= 2) return (capitals[0]! + capitals[1]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
});
</script>
