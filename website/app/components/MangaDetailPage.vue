<template>
    <TrangaPage v-bind="$props">
        <template #left>
            <div class="flex flex-col gap-3">
                <MangaCover v-if="manga" :manga="manga" class="self-center" />
                <USkeleton v-else class="w-[240px] h-[350px] self-center" />

                <!-- Title, subtitle, credits -->
                <div v-if="manga" class="flex flex-col gap-1">
                    <p class="font-semibold text-xl leading-tight">
                        {{ manga.name }}
                        <MangaconnectorIcon v-for="m in manga.mangaConnectorIds" v-bind="m" :key="m.key" />
                    </p>
                    <p v-if="subtitle" class="text-toned text-sm">{{ subtitle }}</p>
                    <p v-for="c in credits" :key="c.label" class="text-sm">
                        <span class="text-dimmed">{{ c.label }}</span> {{ c.value }}
                    </p>
                </div>
                <USkeleton v-else as="p" class="h-20 w-full" />

                <!-- Status, rating, facts -->
                <div v-if="manga" class="flex flex-row flex-wrap items-center gap-1.5">
                    <MangaReleaseStatusBadge :status="manga.releaseStatus" />
                    <UTooltip v-if="contentRating" :text="contentRating.description">
                        <UBadge variant="subtle" :color="contentRating.color" icon="i-lucide-shield">{{ contentRating.label }}</UBadge>
                    </UTooltip>
                </div>
                <dl v-if="facts.length" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <template v-for="f in facts" :key="f.label">
                        <dt class="text-dimmed flex flex-row items-center gap-1.5">
                            <UIcon :name="f.icon" class="size-4" />
                            {{ f.label }}
                        </dt>
                        <dd>{{ f.value }}</dd>
                    </template>
                </dl>
                <a
                    v-if="mangaUpdates"
                    :href="mangaUpdates.url"
                    target="_blank"
                    rel="noopener"
                    class="text-xs text-dimmed hover:text-primary flex flex-row items-center gap-1 w-fit">
                    <UIcon name="i-lucide-external-link" class="size-3.5" />
                    Info from MangaUpdates{{ mangaUpdates.matchedBy === 'title' ? ' (matched by title — check it\'s the right series)' : '' }}
                </a>

                <!-- Read in Komga / Kavita -->
                <div v-if="manga && readLinks.length" class="flex flex-row flex-wrap gap-2">
                    <UButton
                        v-for="l in readLinks"
                        :key="l.url"
                        :to="l.url"
                        target="_blank"
                        external
                        size="sm"
                        variant="soft"
                        color="secondary"
                        icon="i-lucide-book-open-text"
                        trailing-icon="i-lucide-external-link">
                        {{ l.label }}
                    </UButton>
                </div>

                <!-- Authors, tags, links -->
                <div v-if="manga" class="flex flex-col gap-2">
                    <div v-if="manga.authors.length" class="flex flex-row flex-wrap items-center gap-1">
                        <span class="text-xs text-dimmed mr-1">Authors</span>
                        <UBadge v-for="author in manga.authors" :key="author.key" variant="outline" color="neutral">
                            <NuxtLink :to="`/manga/author/${author.key}?return=${$route.fullPath}`">{{ author.name }}</NuxtLink>
                        </UBadge>
                    </div>
                    <div v-if="manga.tags.length || extraGenres.length" class="flex flex-row flex-wrap items-center gap-1">
                        <span class="text-xs text-dimmed mr-1">Genres &amp; tags</span>
                        <UBadge v-for="tag in manga.tags" :key="tag" variant="outline" color="primary">
                            <NuxtLink :to="`/manga/tag/${tag}?return=${$route.fullPath}`">{{ tag }}</NuxtLink>
                        </UBadge>
                        <UTooltip v-for="g in extraGenres" :key="g" text="Genre from MangaUpdates">
                            <UBadge variant="soft" color="neutral">{{ g }}</UBadge>
                        </UTooltip>
                    </div>
                    <div v-if="manga.links.length" class="flex flex-row flex-wrap items-center gap-1">
                        <span class="text-xs text-dimmed mr-1">Links</span>
                        <NuxtLink v-for="link in manga.links" :key="link.key" :to="link.url" external no-prefetch target="_blank">
                            <UBadge variant="outline" color="secondary" trailing-icon="i-lucide-external-link">
                                {{ linkProviderLabel(link.provider, link.url) }}
                            </UBadge>
                        </NuxtLink>
                    </div>
                </div>
                <USkeleton v-else class="w-full h-lh" />

                <MDC v-if="manga" :value="manga.description" class="min-h-lh grow" />
                <USkeleton v-else class="w-full h-30" />
            </div>
        </template>
        <template #actions>
            <slot name="actions" />
        </template>
        <slot />
    </TrangaPage>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
import TrangaPage, { type PageProps } from '~/components/TrangaPage.vue';
type Manga = components['schemas']['Manga'];

export interface MangaDetailPageProps extends PageProps {
    manga?: Manga;
}

const props = defineProps<MangaDetailPageProps>();

// Same extra details as the overview list (stored by the API, or looked up if needed)
const mangaRef = computed(() => props.manga ?? { key: '', name: '', mangaConnectorIds: [] });
const ready = computed(() => !!props.manga);
const { details, mangaUpdates, contentRating } = useMangaOverviewDetails(mangaRef, ready);

const subtitle = computed(() => {
    if (details.value?.altTitles.length) return details.value.altTitles.join(' · ');
    const name = props.manga?.name.trim().toLowerCase();
    return mangaUpdates.value?.associated.find((t) => /[a-z]/i.test(t) && t.trim().toLowerCase() !== name) ?? '';
});
const credits = computed(() => mangaCredits(mangaUpdates.value, props.manga?.authors.map((a) => a.name) ?? []));

const facts = computed(() => {
    const mu = mangaUpdates.value;
    const out: { label: string; value: string; icon: string }[] = [];
    if (mu?.startYear) out.push({ label: 'Published', value: mu.endYear ? `${mu.startYear} – ${mu.endYear}` : mu.startYear, icon: 'i-lucide-calendar' });
    else if (props.manga?.year) out.push({ label: 'Started', value: String(props.manga.year), icon: 'i-lucide-calendar' });
    const status = mangaUpdatesStatusText(mu);
    if (status) out.push({ label: mu?.volumes ? 'Volumes' : 'Status', value: status, icon: 'i-lucide-library' });
    if (mu?.rating)
        out.push({
            label: 'Rating',
            value: `${mu.rating.toFixed(2)} / 10${mu.ratingVotes ? ` (${mu.ratingVotes.toLocaleString()} votes)` : ''}`,
            icon: 'i-lucide-star',
        });
    if (props.manga?.originalLanguage) out.push({ label: 'Language', value: props.manga.originalLanguage.toUpperCase(), icon: 'i-lucide-languages' });
    return out;
});

// MangaUpdates genres that aren't already among Tranga's tags
const extraGenres = computed(() => {
    const tags = new Set((props.manga?.tags ?? []).map((t) => t.toLowerCase()));
    return (mangaUpdates.value?.genres ?? []).filter((g) => !tags.has(g.toLowerCase()));
});

// "Read in Komga" / "Open Kavita" for connected library servers
const { data: libraryConnectors } = useApi('/v2/LibraryConnector', { key: FetchKeys.Libraries.All, lazy: true, server: false });
const readLinks = computed(() =>
    (libraryConnectors.value ?? []).map((c) => {
        const base = c.baseUrl.replace(/\/+$/, '');
        return c.type === 'Komga'
            ? { label: 'Find in Komga', url: `${base}/search?q=${encodeURIComponent(props.manga?.name ?? '')}` }
            : { label: `Open ${c.type}`, url: base };
    })
);
</script>
