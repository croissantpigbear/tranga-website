<template>
    <div
        ref="root"
        :role="selectable ? 'checkbox' : 'link'"
        :aria-checked="selectable ? selected : undefined"
        tabindex="0"
        :class="[
            'group relative flex flex-row gap-4 p-3 rounded-lg cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-primary',
            selected ? 'bg-primary/10 ring-1 ring-primary/60' : 'hover:bg-elevated/70',
            selectable && 'select-none',
        ]"
        @click="(e: MouseEvent) => $emit('click', manga, e)"
        @keydown.enter="(e: KeyboardEvent) => $emit('click', manga, e)"
        @keydown.space.prevent="(e: KeyboardEvent) => selectable && $emit('click', manga, e)">
        <!-- Refresh from source (hidden while selecting) -->
        <div v-if="!selectable" class="absolute top-2 right-2 z-10" @click.stop @keydown.enter.stop @keydown.space.stop>
            <UTooltip :text="canRefresh ? 'Check the website for new chapters now' : 'Not set to download from any website'">
                <UButton
                    icon="i-lucide-refresh-cw"
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    :aria-label="`Refresh ${manga.name}`"
                    :disabled="!canRefresh"
                    :loading="isRefreshing(manga.key)"
                    @click="refreshManga([manga])">
                    <span class="max-xl:hidden">Check now</span>
                </UButton>
            </UTooltip>
        </div>
        <!-- Selection checkbox (select mode only) -->
        <div v-if="selectable" class="shrink-0 flex items-start pt-1">
            <UCheckbox :model-value="selected" :aria-label="`Select ${manga.name}`" class="pointer-events-none" tabindex="-1" />
        </div>
        <!-- Poster with release-status accent bar -->
        <div class="shrink-0 flex flex-col w-(--overview-cover-width) max-sm:w-(--overview-cover-width-sm) rounded-md overflow-clip shadow-md">
            <FallbackImage :src="coverUrl" :alt="`${manga.name} cover`" class="w-full aspect-[2/3] object-cover bg-elevated" />
            <div :class="['h-1.5 w-full', status.barClass]" />
        </div>

        <!-- Title + synopsis -->
        <div class="flex flex-col gap-2 min-w-0 grow max-md:pr-8">
            <div class="flex flex-col gap-0.5 min-w-0">
                <h2 class="text-3xl max-sm:text-xl font-light leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {{ manga.name }}
                </h2>
                <p v-if="subtitle" class="text-base max-sm:text-sm text-toned truncate" :title="subtitle">
                    {{ subtitle }}
                </p>
                <p v-if="credits.length" class="text-sm max-sm:text-xs text-muted truncate mt-0.5" :title="creditsTitle">
                    <template v-for="(c, i) in credits" :key="c.label">
                        <span v-if="i > 0" class="text-dimmed"> · </span>
                        <span class="text-dimmed">{{ c.label }} </span>{{ c.value }}
                    </template>
                </p>
            </div>
            <p class="text-sm text-muted leading-relaxed line-clamp-4 max-sm:line-clamp-3">
                {{ synopsis || 'No description available.' }}
            </p>
            <div v-if="contentRating || mangaUpdates?.genres.length" class="flex flex-row flex-wrap items-center gap-1">
                <UTooltip v-if="contentRating" :text="contentRating.description">
                    <UBadge size="sm" variant="subtle" :color="contentRating.color" icon="i-lucide-shield">{{ contentRating.label }}</UBadge>
                </UTooltip>
                <UBadge v-for="g in mangaUpdates?.genres.slice(0, 6) ?? []" :key="g" size="sm" variant="soft" color="neutral">{{ g }}</UBadge>
            </div>
            <!-- Compact metadata on narrow screens -->
            <div
                :class="['min-md:hidden flex flex-row flex-wrap items-center gap-1 mt-auto', selectable && 'pointer-events-none']"
                @click.stop
                @keydown.enter.stop>
                <MangaReleaseStatusBadge :status="manga.releaseStatus" size="sm" />
                <MangaconnectorIcon v-for="m in manga.mangaConnectorIds" v-bind="m" :key="m.key" />
            </div>
            <ul v-if="compactFacts.length" class="min-md:hidden flex flex-row flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <li v-for="f in compactFacts" :key="f.label" class="flex flex-row items-center gap-1" :title="f.title">
                    <UIcon :name="f.icon" class="size-3.5 text-dimmed shrink-0" />
                    <span>{{ f.value }}</span>
                </li>
            </ul>
            <a
                v-if="mangaUpdates"
                :href="mangaUpdates.url"
                target="_blank"
                rel="noopener"
                :class="['min-md:hidden flex flex-row items-center gap-1 text-xs text-dimmed w-fit', selectable && 'pointer-events-none']"
                :title="mangaUpdatesTitle"
                @click.stop
                @keydown.enter.stop>
                <UIcon name="i-lucide-external-link" class="size-3.5" />
                Info from MangaUpdates<span v-if="mangaUpdates.matchedBy === 'title'">*</span>
            </a>
        </div>

        <!-- Metadata column on wide screens -->
        <div class="max-md:hidden shrink-0 w-64 min-2xl:w-[30rem] flex flex-col gap-3 pt-12">
            <div class="flex flex-col min-2xl:flex-row min-2xl:items-center gap-3 min-2xl:gap-6">
                <div class="flex flex-row items-center gap-2">
                    <UIcon name="i-lucide-activity" class="text-dimmed size-4" />
                    <MangaReleaseStatusBadge :status="manga.releaseStatus" />
                </div>
                <div :class="['flex flex-row items-center gap-2', selectable && 'pointer-events-none']" @click.stop @keydown.enter.stop>
                    <UIcon name="i-lucide-globe" class="text-dimmed size-4 shrink-0" />
                    <div class="flex flex-row flex-wrap -m-1">
                        <MangaconnectorIcon v-for="m in manga.mangaConnectorIds" v-bind="m" :key="m.key" />
                    </div>
                </div>
            </div>
            <template v-if="loading">
                <USkeleton v-for="n in 7" :key="n" class="h-4 w-40" />
            </template>
            <dl v-else class="grid grid-cols-1 min-2xl:grid-cols-2 min-2xl:grid-rows-4 min-2xl:grid-flow-col gap-x-6 gap-y-2 text-sm">
                <div v-for="f in facts" :key="f.label" class="flex flex-row items-start gap-2" :title="f.title">
                    <UIcon :name="f.icon" class="text-dimmed size-4 shrink-0 mt-0.5" />
                    <dt class="sr-only">{{ f.label }}</dt>
                    <dd class="min-w-0">
                        <span class="text-dimmed">{{ f.label }}</span>
                        <span :class="['block truncate', f.missing ? 'text-dimmed' : 'text-default']">{{ f.value }}</span>
                    </dd>
                </div>
            </dl>
            <a
                v-if="mangaUpdates"
                :href="mangaUpdates.url"
                target="_blank"
                rel="noopener"
                :class="['flex flex-row items-center gap-1 text-xs text-dimmed hover:text-primary w-fit', selectable && 'pointer-events-none']"
                :title="mangaUpdatesTitle"
                @click.stop
                @keydown.enter.stop>
                <UIcon name="i-lucide-external-link" class="size-3.5" />
                Info from MangaUpdates<span v-if="mangaUpdates.matchedBy === 'title'">*</span>
            </a>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
import type { MangaOverviewDetails } from '~/composables/useMangaOverviewDetails';
import type { MangaUpdatesInfo } from '~/composables/useMangaUpdates';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];

const props = defineProps<{ manga: Manga | MinimalManga; selectable?: boolean; selected?: boolean }>();
defineEmits<{ (e: 'click', manga: MinimalManga | Manga, event: MouseEvent | KeyboardEvent): void }>();

const config = useRuntimeConfig();
const coverUrl = computed(() => `${config.public.openFetch.api.baseURL}v2/Manga/${props.manga.key}/Cover/Medium`);
const status = computed(() => releaseStatusInfo(props.manga.releaseStatus));
const synopsis = computed(() => plainTextDescription(props.manga.description));

// Extra details (alt titles, chapters, dates) are loaded lazily once the row scrolls into view
const root = ref<HTMLElement>();
const visible = ref(false);
let observer: IntersectionObserver | undefined;
onMounted(() => {
    if (!('IntersectionObserver' in window)) {
        visible.value = true;
        return;
    }
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                visible.value = true;
                observer?.disconnect();
            }
        },
        { rootMargin: '300px 0px' }
    );
    if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const { details, loading, mangaUpdates, contentRating } = useMangaOverviewDetails(toRef(props, 'manga'), visible);

// "Story X · Art Y · Publisher Z" — from MangaUpdates, falling back to the authors Tranga stored
const credits = computed(() => mangaCredits(mangaUpdates.value, details.value?.authors ?? []));
const creditsTitle = computed(() => {
    const text = credits.value.map((c) => `${c.label} ${c.value}`).join('\n');
    const pubs = mangaUpdates.value?.publications ?? [];
    return pubs.length > 1 ? `${text}\nAlso runs in: ${pubs.slice(1).join(', ')}` : text;
});

const mangaUpdatesTitle = computed(() =>
    mangaUpdates.value?.matchedBy === 'title'
        ? `Matched by title to "${mangaUpdates.value.title}" — open to check it's the right series`
        : `MangaUpdates: ${mangaUpdates.value?.title ?? ''}`
);

// Tranga's alternative titles first; fall back to readable (Latin-script) ones from MangaUpdates
const subtitle = computed(() => {
    if (details.value?.altTitles.length) return details.value.altTitles.join(' · ');
    const name = props.manga.name.trim().toLowerCase();
    const alt = mangaUpdates.value?.associated.find((t) => /[a-z]/i.test(t) && t.trim().toLowerCase() !== name);
    return alt ?? '';
});

function formatReleaseDate(date?: string): string | undefined {
    if (!date) return undefined;
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const { refreshManga, isRefreshing } = useMangaRefresh();
const canRefresh = computed(() => props.manga.mangaConnectorIds.some((id) => id.useForDownload));

interface Fact {
    label: string;
    icon: string;
    value: string;
    title?: string;
    /** No data: shown dimmed as "N/A" so every row has the same fields in the same place */
    missing?: boolean;
}

const NA = 'N/A';
const na = (label: string, icon: string, title?: string): Fact => ({ label, icon, value: NA, missing: true, title });

const chapterNumber = (s?: string | number | null) => {
    const n = typeof s === 'number' ? s : parseFloat(String(s ?? '').replace(/^.*?(\d+(\.\d+)?).*$/, '$1'));
    return Number.isFinite(n) ? n : undefined;
};

/** "11 · Complete", "None yet · Ongoing", "Ongoing" — from MangaUpdates */
function volumesFact(mu: MangaUpdatesInfo | null | undefined): Fact {
    const label = 'Volumes';
    const icon = 'i-lucide-library';
    if (!mu || (mu.volumes === undefined && !mu.statusWord)) return na(label, icon, 'Not known (no MangaUpdates info)');
    const vols = mu.volumes === undefined ? undefined : mu.volumes === 0 ? 'None yet' : String(mu.volumes);
    return { label, icon, value: [vols, mu.statusWord].filter(Boolean).join(' · '), title: mu.status };
}

/** A chapter MangaUpdates knows about that Tranga doesn't have yet (plus its release date, if known) */
function newerOnMangaUpdatesFact(d: MangaOverviewDetails, mu: MangaUpdatesInfo | null | undefined): Fact {
    const label = 'Newer on MangaUpdates';
    const icon = 'i-lucide-calendar-clock';
    if (!mu) return na(label, icon, 'No MangaUpdates info');
    const release = mu.latestRelease;
    const muChapter = chapterNumber(release?.chapter) ?? mu.latestChapter;
    if (muChapter === undefined) return na(label, icon, "MangaUpdates doesn't list chapters for this series");
    const trangaChapter = chapterNumber(d.latestChapter?.chapterNumber);
    if (trangaChapter !== undefined && muChapter <= trangaChapter)
        return { label, icon, value: 'Up to date', title: `MangaUpdates' latest is Ch. ${muChapter}` };

    const chapterText = release?.chapter
        ? [release.volume && `Vol. ${release.volume}`, `Ch. ${release.chapter}`].filter(Boolean).join(' ')
        : `Ch. ${muChapter}`;
    return {
        label,
        icon,
        value: [chapterText, formatReleaseDate(release?.date)].filter(Boolean).join(' · '),
        title: release?.groups.length ? `Released by ${release.groups.join(', ')} (MangaUpdates)` : 'From MangaUpdates',
    };
}

/** "2008 – 2019", "2024 – ongoing" */
function publishedFact(d: MangaOverviewDetails, mu: MangaUpdatesInfo | null | undefined): Fact {
    const label = 'Published';
    const icon = 'i-lucide-calendar';
    const start = mu?.startYear ?? (d.year ? String(d.year) : undefined);
    if (!start) return na(label, icon);
    const stillRunning = props.manga.releaseStatus === 'Continuing' || props.manga.releaseStatus === 'OnHiatus';
    const end = mu?.endYear ?? (stillRunning ? 'ongoing' : NA);
    return { label, icon, value: `${start} – ${end}` };
}

// Always the same fields in the same order (N/A when unknown), so rows line up
const facts = computed<Fact[]>(() => {
    const d = details.value;
    if (!d) return [];
    const mu = mangaUpdates.value;
    return [
        d.chapterCount !== undefined
            ? {
                  label: 'Chapters',
                  icon: 'i-lucide-book-open',
                  value: d.downloadedCount !== undefined ? `${d.chapterCount} · ${d.downloadedCount} downloaded` : String(d.chapterCount),
              }
            : na('Chapters', 'i-lucide-book-open'),
        d.latestChapter
            ? { label: 'Latest chapter', icon: 'i-lucide-sparkles', value: formatChapter(d.latestChapter)! }
            : na('Latest chapter', 'i-lucide-sparkles'),
        d.lastDownloaded
            ? {
                  label: 'Last downloaded',
                  icon: 'i-lucide-download',
                  value: [formatChapter(d.lastDownloaded), formatDownloadDate(d.lastDownloadedAt)].filter(Boolean).join(' · '),
                  title: d.lastDownloadedAt ? new Date(d.lastDownloadedAt).toLocaleString() : undefined,
              }
            : d.downloadedCount === 0
              ? { label: 'Last downloaded', icon: 'i-lucide-download', value: 'Nothing yet' }
              : na('Last downloaded', 'i-lucide-download'),
        newerOnMangaUpdatesFact(d, mu),
        volumesFact(mu),
        publishedFact(d, mu),
        mu?.rating
            ? {
                  label: 'Rating',
                  icon: 'i-lucide-star',
                  value: `${mu.rating.toFixed(2)} / 10${mu.ratingVotes ? ` · ${mu.ratingVotes.toLocaleString()} votes` : ''}`,
              }
            : na('Rating', 'i-lucide-star', mu ? 'No rating on MangaUpdates yet' : 'No MangaUpdates info'),
    ];
});
/** Narrow screens: skip the N/A ones to save space */
const compactFacts = computed(() => facts.value.filter((f) => !f.missing));
</script>
