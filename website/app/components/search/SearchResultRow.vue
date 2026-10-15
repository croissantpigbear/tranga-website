<template>
    <div
        ref="root"
        :class="[
            'relative flex flex-row gap-4 p-3 rounded-lg transition-colors',
            selected ? 'bg-primary/10 ring-1 ring-primary/60' : 'hover:bg-elevated/60',
            selectable && !inLibrary && 'cursor-pointer select-none',
        ]"
        @click="selectable && !inLibrary && emit('toggle')">
        <div v-if="selectable" class="shrink-0 pt-1">
            <UCheckbox :model-value="selected" :disabled="inLibrary" :aria-label="`Select ${result.name}`" class="pointer-events-none" tabindex="-1" />
        </div>
        <div class="shrink-0 w-24 max-sm:w-16 rounded-md overflow-clip shadow-md self-start">
            <FallbackImage :src="coverUrl" :alt="`${result.name} cover`" class="w-full aspect-[2/3] object-cover bg-elevated" />
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 grow">
            <div class="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <h3 class="text-xl max-sm:text-base font-medium leading-tight">{{ result.name }}</h3>
                <UBadge v-if="inLibrary" color="success" variant="subtle" icon="i-lucide-library-big">In your library</UBadge>
                <UBadge v-else-if="justAdded" color="success" variant="subtle" icon="i-lucide-check">Added</UBadge>
            </div>
            <p v-if="subtitle" class="text-sm text-toned truncate" :title="subtitle">{{ subtitle }}</p>
            <p v-if="credits.length || year" class="text-xs text-muted truncate">
                <template v-for="(c, i) in credits" :key="c.label">
                    <span v-if="i > 0" class="text-dimmed"> · </span><span class="text-dimmed">{{ c.label }} </span>{{ c.value }}
                </template>
                <template v-if="year"><span v-if="credits.length" class="text-dimmed"> · </span>{{ year }}</template>
            </p>
            <p class="text-sm text-muted line-clamp-3">{{ synopsis || 'No description.' }}</p>
            <div class="flex flex-row flex-wrap items-center gap-1">
                <MangaReleaseStatusBadge :status="result.releaseStatus" size="sm" />
                <UBadge v-if="contentRating" size="sm" variant="subtle" :color="contentRating.color" icon="i-lucide-shield">{{ contentRating.label }}</UBadge>
                <UBadge v-if="mangaUpdates?.rating" size="sm" variant="soft" color="neutral" icon="i-lucide-star">
                    {{ mangaUpdates.rating.toFixed(1) }}
                </UBadge>
                <UBadge v-for="g in (mangaUpdates?.genres ?? []).slice(0, 5)" :key="g" size="sm" variant="soft" color="neutral">{{ g }}</UBadge>
            </div>
            <div
                v-if="duplicateOf && !inLibrary"
                class="text-xs rounded-md bg-warning/10 text-warning px-2 py-1.5 flex flex-row flex-wrap items-center gap-1 w-fit"
                @click.stop>
                <UIcon name="i-lucide-copy" class="size-3.5" />
                You already have
                <NuxtLink :to="`/manga/${duplicateOf.key}?return=${encodeURIComponent($route.fullPath)}`" class="underline font-medium">{{ duplicateOf.name }}</NuxtLink>
                — probably the same series from another site. Add it only if it's different; otherwise use <b>Merge</b> on that series.
            </div>
        </div>

        <div class="shrink-0 flex flex-col items-end gap-2 max-md:absolute max-md:top-2 max-md:right-2" @click.stop>
            <div class="flex flex-row items-center gap-1 -m-1">
                <span class="text-xs text-dimmed max-md:hidden mr-1">{{ sources.length > 1 ? 'Found on' : 'From' }}</span>
                <MangaconnectorIcon v-for="m in sources" v-bind="m" :key="m.key" />
            </div>
            <UButton
                v-if="inLibrary"
                size="sm"
                variant="soft"
                color="success"
                icon="i-lucide-arrow-right"
                :to="`/manga/${result.key}?return=${encodeURIComponent($route.fullPath)}`">
                Open
            </UButton>
            <template v-else-if="!selectable">
                <UButton size="sm" icon="i-lucide-plus" :disabled="justAdded" @click="emit('add')">{{ justAdded ? 'Added' : 'Add' }}</UButton>
                <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-info"
                    :to="`/manga/${result.key}?return=${encodeURIComponent($route.fullPath)}`">
                    Details
                </UButton>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type MinimalManga = components['schemas']['MinimalManga'];

const props = defineProps<{
    result: MinimalManga;
    inLibrary?: boolean;
    justAdded?: boolean;
    duplicateOf?: { key: string; name: string };
    selectable?: boolean;
    selected?: boolean;
}>();
const emit = defineEmits<{ (e: 'add'): void; (e: 'toggle'): void; (e: 'titles', titles: string[]): void }>();

const config = useRuntimeConfig();
const coverUrl = computed(() => `${config.public.openFetch.api.baseURL}v2/Manga/${props.result.key}/Cover/Medium`);
const synopsis = computed(() => plainTextDescription(props.result.description));
const sources = computed(() => [...props.result.mangaConnectorIds].sort((a, b) => a.mangaConnectorName.localeCompare(b.mangaConnectorName)));

// Details load when the row scrolls into view
const root = ref<HTMLElement>();
const visible = ref(false);
let observer: IntersectionObserver | undefined;
onMounted(() => {
    if (!('IntersectionObserver' in window)) {
        visible.value = true;
        return;
    }
    observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
            visible.value = true;
            observer?.disconnect();
        }
    }, { rootMargin: '200px 0px' });
    if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const { details, mangaUpdates, contentRating } = useSearchResultDetails(toRef(() => props.result), visible);
watch(details, (d) => d && emit('titles', d.allTitles));

const subtitle = computed(() => details.value?.altTitles.join(' · ') ?? '');
const credits = computed(() => mangaCredits(mangaUpdates.value, details.value?.authors ?? []).slice(0, 2));
const year = computed(() => mangaUpdates.value?.year ?? (details.value?.year ? String(details.value.year) : undefined));
</script>
