<template>
    <TrangaPage>
        <template #title>
            <p class="text-2xl font-semibold">Add manga</p>
        </template>
        <div class="max-w-6xl mx-auto w-full flex flex-col gap-4 pb-10">
            <UAlert
                v-if="importInto"
                color="info"
                variant="subtle"
                icon="i-lucide-folder-input"
                :title="`Importing the folder “${importInto.folder}”`"
                description="Add the series that matches it: Tranga saves into that folder, and the chapters already in it count as downloaded."
                :actions="[{ label: 'Cancel import', color: 'neutral', variant: 'outline', onClick: cancelImport }]" />

            <!-- Search box -->
            <UCard>
                <form class="flex flex-col gap-3" @submit.prevent="performSearch()">
                    <div class="flex flex-row gap-2">
                        <UInput
                            ref="input"
                            v-model="query"
                            class="grow"
                            size="lg"
                            icon="i-lucide-search"
                            placeholder="Title, or a link to the manga (MangaDex, WeebCentral, …)"
                            autofocus
                            :disabled="busy"
                            :ui="{ trailing: 'pe-1' }">
                            <template v-if="query" #trailing>
                                <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" aria-label="Clear" @click="clearQuery" />
                            </template>
                        </UInput>
                        <UButton type="submit" size="lg" icon="i-lucide-search" :loading="busy" :disabled="!query?.trim()">Search</UButton>
                    </div>

                    <div class="flex flex-row flex-wrap items-center gap-1.5">
                        <span class="text-sm text-muted mr-1">Search on</span>
                        <UButton
                            v-for="c in siteButtons"
                            :key="c.key"
                            size="sm"
                            :color="selectedSite === c.name ? 'primary' : 'neutral'"
                            :variant="selectedSite === c.name ? 'solid' : 'outline'"
                            :disabled="busy || isUrl"
                            @click="selectedSite = c.name">
                            <template #leading>
                                <UIcon v-if="c.name === 'Global'" name="i-lucide-globe" class="size-4" />
                                <FallbackImage v-else :src="c.iconUrl" :alt="''" class="size-4 rounded-sm" />
                            </template>
                            {{ c.name === 'Global' ? 'All sites' : c.name }}
                        </UButton>
                        <span v-if="isUrl" class="text-xs text-muted ml-1">Link detected: the site is picked automatically.</span>
                        <span class="grow" />
                        <UButton size="xs" variant="link" color="neutral" icon="i-lucide-puzzle" to="/fmd-modules?return=/search">Site missing?</UButton>
                    </div>

                    <div v-if="recent.length && !busy" class="flex flex-row flex-wrap items-center gap-1.5">
                        <span class="text-xs text-dimmed mr-1">Recent</span>
                        <UBadge
                            v-for="r in recent"
                            :key="r.query"
                            variant="soft"
                            color="neutral"
                            class="cursor-pointer hover:bg-accented gap-1"
                            @click="runRecent(r)">
                            {{ r.query }}
                            <span v-if="r.site !== 'Global'" class="text-dimmed">· {{ r.site }}</span>
                            <UIcon name="i-lucide-x" class="size-3 text-dimmed hover:text-default" @click.stop="removeRecent(r.query)" />
                        </UBadge>
                        <UButton size="xs" variant="link" color="neutral" @click="clearRecent">Clear</UButton>
                    </div>
                </form>
            </UCard>

            <!-- Searching -->
            <div v-if="busy" class="flex flex-col items-center gap-2 py-10 text-muted">
                <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
                <p>
                    {{ isUrl ? 'Fetching the manga from the link' : `Searching ${selectedSite === 'Global' ? 'all sites' : selectedSite}` }}… {{ elapsed }}s
                </p>
                <p v-if="elapsed > 15" class="text-xs">Some sites are slow to answer; "All sites" waits for the slowest one.</p>
            </div>

            <!-- Problems -->
            <div v-else-if="error" class="rounded-lg bg-error/10 text-error px-4 py-3 flex flex-row flex-wrap items-center gap-3">
                <UIcon name="i-lucide-circle-x" class="size-5 shrink-0" />
                <p class="grow">{{ error }}</p>
                <UButton v-if="lastSearch && lastSearch.site !== 'Global' && !lastSearch.isUrl" size="sm" variant="soft" @click="retryOnAllSites">Try all sites</UButton>
                <UButton v-else-if="lastSearch" size="sm" variant="soft" @click="performSearch(lastSearch.query, lastSearch.site)">Try again</UButton>
            </div>
            <div v-else-if="lastSearch && !results.length" class="flex flex-col items-center gap-2 py-10 text-muted">
                <UIcon name="i-lucide-search-x" class="size-8" />
                <p>
                    Nothing found {{ lastSearch.isUrl ? 'at' : lastSearch.site === 'Global' ? 'on any site for' : `on ${lastSearch.site} for` }}
                    <span class="text-default">“{{ lastSearch.query }}”</span>.
                </p>
                <p class="text-xs">Try a shorter title, the original (romanised) title, or paste a link to the manga.</p>
                <UButton v-if="!lastSearch.isUrl && lastSearch.site !== 'Global'" size="sm" variant="soft" @click="retryOnAllSites">Try all sites</UButton>
            </div>

            <!-- Results -->
            <template v-else-if="results.length">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <p class="text-lg grow">
                        {{ visibleResults.length }} result{{ visibleResults.length === 1 ? '' : 's' }} for
                        <span class="text-primary">“{{ lastSearch?.query }}”</span>
                        <span v-if="lastSearch && !lastSearch.isUrl && lastSearch.site !== 'Global'" class="text-muted text-base"> on {{ lastSearch.site }}</span>
                    </p>
                    <USelect v-model="sort" :items="SORTS" value-key="value" size="sm" class="w-40" />
                    <USwitch v-if="siteCounts.length > 1" v-model="groupBySite" size="sm" label="Group by site" />
                    <UButton
                        size="sm"
                        :variant="selecting ? 'solid' : 'outline'"
                        :color="selecting ? 'primary' : 'neutral'"
                        icon="i-lucide-list-checks"
                        @click="toggleSelecting">
                        {{ selecting ? 'Done' : 'Select' }}
                    </UButton>
                </div>

                <!-- Site filter -->
                <div v-if="siteCounts.length > 1" class="flex flex-row flex-wrap gap-1.5">
                    <UButton
                        v-for="s in siteCounts"
                        :key="s.site"
                        size="xs"
                        :variant="siteFilter.has(s.site) ? 'solid' : 'soft'"
                        :color="siteFilter.has(s.site) ? 'primary' : 'neutral'"
                        @click="toggleSiteFilter(s.site)">
                        {{ s.site }}
                        <UBadge size="sm" variant="subtle" color="neutral">{{ s.count }}</UBadge>
                    </UButton>
                    <UButton v-if="siteFilter.size" size="xs" variant="link" color="neutral" @click="siteFilter.clear()">Show all sites</UButton>
                </div>

                <!-- Bulk add bar -->
                <div
                    v-if="selecting"
                    class="sticky top-0 z-20 rounded-lg bg-elevated border border-default px-3 py-2 flex flex-row flex-wrap items-center gap-2">
                    <span class="text-sm grow">{{ selected.length }} selected</span>
                    <UButton size="sm" variant="ghost" color="neutral" @click="selectAllAddable">Select all</UButton>
                    <UButton size="sm" variant="ghost" color="neutral" :disabled="!selected.length" @click="selected = []">Clear</UButton>
                    <UButton size="sm" icon="i-lucide-plus" :disabled="!selected.length" @click="openAdd(selectedManga)">Add selected</UButton>
                </div>

                <section v-for="group in groups" :key="group.label" class="flex flex-col gap-1">
                    <h3 v-if="group.label" class="text-xs font-semibold uppercase tracking-wide text-dimmed px-1 pt-2">
                        {{ group.label }} · {{ group.items.length }}
                    </h3>
                    <div class="flex flex-col divide-y divide-default">
                        <SearchResultRow
                            v-for="m in group.items"
                            :key="`${group.label}-${m.key}`"
                            :result="m"
                            :in-library="isInLibrary(m)"
                            :just-added="added.includes(m.key)"
                            :duplicate-of="duplicateOf(m)"
                            :selectable="selecting"
                            :selected="selected.includes(m.key)"
                            @toggle="toggleSelected(m.key)"
                            @add="openAdd([m])"
                            @titles="(t) => (resultTitles[m.key] = t)" />
                    </div>
                </section>

                <p class="text-xs text-muted flex flex-row items-center gap-2 pt-2">
                    <USwitch v-model="cleanup" size="xs" />
                    When I leave this page, remove search results I didn't add from Tranga's database
                    <UTooltip text="Every search result is stored in Tranga. This keeps the database (and Settings → Stats) tidy. Manga you add or already have are never removed.">
                        <UIcon name="i-lucide-info" class="size-3.5" />
                    </UTooltip>
                </p>
            </template>

            <!-- First visit -->
            <div v-else class="text-sm text-muted flex flex-col gap-1 px-1">
                <p>Search by title on one site or all of them, or paste a link to a manga page to add it directly.</p>
                <p>Tip: titles often match better in their original (romanised Japanese) form, e.g. “Shingeki no Kyojin”.</p>
            </div>
        </div>

        <SearchAddMangaModal v-model:open="addOpen" :manga="addTargets" :import-into="importInto" @added="onAdded" />
    </TrangaPage>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type MinimalManga = components['schemas']['MinimalManga'];

const { $api } = useNuxtApp();
const api = useTrangaApi();

const { data: connectors } = useApi('/v2/MangaConnector', { key: FetchKeys.MangaConnector.All, server: false });
const { data: library, refresh: refreshLibrary } = useApi('/v2/Manga', { key: FetchKeys.Manga.All, server: false });

// --- Importing a library folder (from the Import page) ---
const route = useRoute();
const router = useRouter();
const toast = useToast();
const importInto = computed(() =>
    typeof route.query.importFolder === 'string' && typeof route.query.importLibrary === 'string' && route.query.importFolder
        ? { libraryId: route.query.importLibrary, folder: route.query.importFolder }
        : undefined
);
function cancelImport() {
    const { importFolder: _f, importLibrary: _l, ...rest } = route.query;
    router.replace({ query: rest });
}
onMounted(() => {
    // Opened with ?q=… (e.g. from the Import page): search straight away, on every site
    if (typeof route.query.q === 'string' && route.query.q.trim()) {
        query.value = route.query.q;
        selectedSite.value = 'Global';
        performSearch(route.query.q, 'Global');
    }
});

// --- Search box ---
const query = useState<string>('search-query', () => '');
const selectedSite = useState<string>('search-site', () => 'Global');
const isUrl = computed(() => looksLikeUrl(query.value ?? ''));
const siteButtons = computed(() => {
    const list = (connectors.value ?? []).filter((c) => c.enabled);
    return [...list.filter((c) => c.name === 'Global'), ...list.filter((c) => c.name !== 'Global')];
});
watch(connectors, () => {
    if (connectors.value && !siteButtons.value.some((c) => c.name === selectedSite.value)) selectedSite.value = siteButtons.value[0]?.name ?? 'Global';
});

const input = ref<{ inputRef?: HTMLInputElement }>();
function clearQuery() {
    query.value = '';
    nextTick(() => input.value?.inputRef?.focus());
}

const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();
function runRecent(r: { query: string; site: string }) {
    query.value = r.query;
    if (siteButtons.value.some((c) => c.name === r.site)) selectedSite.value = r.site;
    performSearch();
}

// --- Searching ---
interface LastSearch {
    query: string;
    site: string;
    isUrl: boolean;
}
const results = useState<MinimalManga[]>('search-results', () => []);
const lastSearch = useState<LastSearch | null>('search-last', () => null);
const error = ref<string>();
const busy = ref(false);
const elapsed = ref(0);
let elapsedTimer: ReturnType<typeof setInterval> | undefined;

/** Manga that only exist because we searched (candidates for clean-up) and manga that existed before */
const created = useState<string[]>('search-created', () => []);
const added = useState<string[]>('search-added', () => []);

async function performSearch(q = query.value, site = selectedSite.value) {
    const text = q?.trim();
    if (!text || busy.value) return;
    const url = looksLikeUrl(text);
    busy.value = true;
    error.value = undefined;
    elapsed.value = 0;
    elapsedTimer = setInterval(() => elapsed.value++, 1000);
    selected.value = [];
    siteFilter.clear();
    try {
        // Note what's already in Tranga, so clean-up never removes it
        const before = new Set((await $api('/v2/Manga').catch(() => [] as MinimalManga[])).map((m) => m.key));
        let found: MinimalManga[];
        if (url) {
            found = [await $api('/v2/Search', { query: { url: JSON.stringify(text.startsWith('www.') ? `https://${text}` : text) } })];
        } else {
            found = await $api('/v2/Search/{MangaConnectorName}/{Query}', { path: { MangaConnectorName: site, Query: text } });
        }
        // De-duplicate (a manga found on two sites can come back twice)
        results.value = [...new Map(found.filter(Boolean).map((m) => [m.key, m])).values()];
        lastSearch.value = { query: text, site: url ? 'link' : site, isUrl: url };
        for (const m of results.value) if (!before.has(m.key) && !created.value.includes(m.key)) created.value.push(m.key);
        if (!url) addRecent(text, site);
    } catch (e) {
        results.value = [];
        lastSearch.value = { query: text, site: url ? 'link' : site, isUrl: url };
        error.value = describeError(e, url, site);
    } finally {
        clearInterval(elapsedTimer);
        busy.value = false;
        refreshLibrary();
    }
}

function describeError(e: unknown, url: boolean, site: string): string {
    const status = api.statusOf(e);
    const siteName = site === 'Global' ? 'the sites' : site;
    if (url) {
        if (status === 404) return "Couldn't get a manga from that link. Check it opens a manga's page (not a chapter), and that the site is one Tranga supports.";
        return `Couldn't read that link (${api.messageOf(e)}).`;
    }
    if (status === 412) return `${site} is turned off in Tranga.`;
    if (status === 404) return `Tranga doesn't know a site called ${site}.`;
    if (status === 504 || status === 502) return `${siteName} took too long to answer. Try again, or try another site.`;
    if (status && status >= 500) return `${siteName} returned an error (${status}). It may be down or blocking requests; check Activity → Logs for details.`;
    if (!status) return "Couldn't reach the Tranga API. Is it running?";
    return api.messageOf(e);
}

function retryOnAllSites() {
    if (!lastSearch.value) return;
    selectedSite.value = 'Global';
    performSearch(lastSearch.value.query, 'Global');
}

// --- Library / duplicates ---
const libraryManga = computed(() => (library.value ?? []).filter((m) => m.mangaConnectorIds.some((id) => id.useForDownload)));
const libraryKeys = computed(() => new Set(libraryManga.value.map((m) => m.key)));
const isInLibrary = (m: MinimalManga) => libraryKeys.value.has(m.key) || m.mangaConnectorIds.some((id) => id.useForDownload);
const resultTitles = reactive<Record<string, string[]>>({});
function duplicateOf(m: MinimalManga): { key: string; name: string } | undefined {
    const titles = resultTitles[m.key] ?? [m.name];
    const tags = editionTags(m.name);
    const match = libraryManga.value.find(
        (l) =>
            l.key !== m.key &&
            sameTitle([l.name], titles) &&
            // "Title" vs "Title [R18]": different editions are different series
            editionTags(l.name) === tags &&
            // a different page on the same website is a different series
            !m.mangaConnectorIds.some((mid) =>
                l.mangaConnectorIds.some((lid) => lid.mangaConnectorName === mid.mangaConnectorName && lid.websiteUrl !== mid.websiteUrl)
            )
    );
    return match ? { key: match.key, name: match.name } : undefined;
}

// --- Sorting, filtering, grouping ---
const SORTS = [
    { value: 'relevance', label: 'Best match' },
    { value: 'title', label: 'Title A–Z' },
    { value: 'site', label: 'As found' },
];
const sort = ref('relevance');
const groupBySite = ref(false);
const siteFilter = reactive(new Set<string>());
const toggleSiteFilter = (s: string) => (siteFilter.has(s) ? siteFilter.delete(s) : siteFilter.add(s));

const sitesOf = (m: MinimalManga) => m.mangaConnectorIds.map((id) => id.mangaConnectorName);
const siteCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const m of results.value) for (const s of new Set(sitesOf(m))) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts].map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count);
});

const visibleResults = computed(() => {
    let list = results.value.filter((m) => !siteFilter.size || sitesOf(m).some((s) => siteFilter.has(s)));
    const q = lastSearch.value?.query ?? '';
    if (sort.value === 'relevance') {
        const score = new Map(list.map((m) => [m.key, relevance(q, resultTitles[m.key] ?? [m.name])]));
        list = [...list].sort((a, b) => score.get(b.key)! - score.get(a.key)!);
    } else if (sort.value === 'title') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
});
const groups = computed(() => {
    if (!groupBySite.value) return [{ label: '', items: visibleResults.value }];
    return siteCounts.value
        .filter((s) => !siteFilter.size || siteFilter.has(s.site))
        .map((s) => ({ label: s.site, items: visibleResults.value.filter((m) => sitesOf(m).includes(s.site)) }))
        .filter((g) => g.items.length);
});

// --- Selecting & adding ---
const selecting = ref(false);
const selected = ref<string[]>([]);
const selectedManga = computed(() => results.value.filter((m) => selected.value.includes(m.key)));
function toggleSelecting() {
    selecting.value = !selecting.value;
    selected.value = [];
}
function toggleSelected(key: string) {
    selected.value = selected.value.includes(key) ? selected.value.filter((k) => k !== key) : [...selected.value, key];
}
const selectAllAddable = () => (selected.value = visibleResults.value.filter((m) => !isInLibrary(m)).map((m) => m.key));

const addOpen = ref(false);
const addTargets = ref<MinimalManga[]>([]);
function openAdd(list: MinimalManga[]) {
    addTargets.value = list;
    addOpen.value = true;
}
async function onAdded(keys: string[]) {
    if (importInto.value) {
        toast.add({
            title: `Imported “${importInto.value.folder}”`,
            description: 'Chapters already in the folder are recognised once Tranga has read the series from the website.',
            color: 'success',
            icon: 'i-lucide-folder-check',
        });
        const back = typeof route.query.return === 'string' ? route.query.return : '/import';
        added.value = [...new Set([...added.value, ...keys])];
        await navigateTo(back);
        return;
    }
    added.value = [...new Set([...added.value, ...keys])];
    selected.value = selected.value.filter((k) => !keys.includes(k));
    if (selecting.value && !selected.value.length) selecting.value = false;
    await refreshLibrary();
    // Show the new source state (Downloading) on the results
    const fresh = new Map((library.value ?? []).map((m) => [m.key, m]));
    results.value = results.value.map((m) => fresh.get(m.key) ?? m);
}

// --- Clean-up of search results that weren't added ---
const CLEANUP_KEY = 'tranga-search-cleanup';
const cleanup = ref(true);
onMounted(() => {
    try {
        cleanup.value = localStorage.getItem(CLEANUP_KEY) !== 'false';
    } catch {
        /* ignore */
    }
});
watch(cleanup, (v) => {
    try {
        localStorage.setItem(CLEANUP_KEY, String(v));
    } catch {
        /* ignore */
    }
});

async function cleanUpResults() {
    const candidates = created.value.filter((k) => !added.value.includes(k));
    created.value = [];
    added.value = [];
    results.value = [];
    lastSearch.value = null;
    for (const key of candidates) {
        try {
            // Only if it's still not being downloaded (it may have been added from its own page)
            const m = await $api('/v2/Manga/{MangaId}', { path: { MangaId: key } });
            if (m.mangaConnectorIds.some((id) => id.useForDownload) || m.fileLibraryId) continue;
            await $api('/v2/Manga/{MangaId}', { method: 'DELETE', path: { MangaId: key } });
        } catch {
            /* already gone */
        }
    }
    if (candidates.length) refreshNuxtData(FetchKeys.Manga.All);
}

// Opening a result's page keeps everything (you'll come back); going anywhere else tidies up
onBeforeRouteLeave((to) => {
    if (to.path.startsWith('/manga/')) return;
    if (cleanup.value && created.value.length) cleanUpResults();
});

useHead({ title: 'Add manga' });
</script>
