import type { components } from '#open-fetch-schemas/api';
import type { MangaUpdatesInfo } from './useMangaUpdates';
import type { ContentRating } from './useContentRating';
type Manga = components['schemas']['Manga'];

/**
 * Extra details for a search result (alt titles, authors, year from Tranga; writer, genres, rating from MangaUpdates),
 * loaded once the result scrolls into view. MangaUpdates lookups go through the shared, rate-limited queue.
 */
export interface SearchResultDetails {
    full?: Manga;
    altTitles: string[];
    allTitles: string[];
    authors: string[];
    year?: number | null;
}

const cache = new Map<string, Promise<Manga | undefined>>();
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= 4) await new Promise<void>((r) => waiting.push(r));
    active++;
    try {
        return await fn();
    } finally {
        active--;
        waiting.shift()?.();
    }
}

export function useSearchResultDetails(manga: Readonly<Ref<{ key: string; name: string; mangaConnectorIds: { mangaConnectorName: string; websiteUrl?: string | null }[] }>>, visible: Readonly<Ref<boolean>>) {
    const { $api } = useNuxtApp();
    const details = ref<SearchResultDetails>();
    const mangaUpdates = ref<MangaUpdatesInfo | null>();
    const mangaDexRating = ref<ContentRating>();
    const contentRating = computed(() => mangaDexRating.value ?? contentRatingFromGenres(mangaUpdates.value?.genres));

    async function load() {
        const key = manga.value.key;
        let p = cache.get(key);
        if (!p) {
            p = limited(() => $api('/v2/Manga/{MangaId}', { path: { MangaId: key } }) as Promise<Manga>).catch(() => undefined);
            cache.set(key, p);
        }
        const full = await p;
        if (manga.value.key !== key) return;
        details.value = {
            full,
            altTitles: pickAltTitles(full?.altTitles, manga.value.name, 2),
            allTitles: [manga.value.name, ...(full?.altTitles ?? []).map((t) => t.title)],
            authors: (full?.authors ?? []).map((a) => a.name).filter(Boolean),
            year: full?.year,
        };
        // MangaUpdates (series info only; no release search) and the MangaDex rating
        fetchMangaUpdatesInfo(key, { links: full?.links, titles: details.value.allTitles }, { releases: false }).then((mu) => {
            if (manga.value.key === key) mangaUpdates.value = mu;
        });
        const mdId = mangaDexIdFromConnectors(manga.value.mangaConnectorIds);
        if (mdId)
            fetchMangaDexContentRating(mdId).then((r) => {
                if (manga.value.key === key) mangaDexRating.value = r;
            });
    }

    watch(
        [visible, () => manga.value.key],
        ([v]) => {
            if (v) load();
        },
        { immediate: true }
    );

    return { details, mangaUpdates, contentRating };
}
