import type { components } from '#open-fetch-schemas/api';
import type { MangaFacets } from '~/utils/mangaFilter';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];

/**
 * Library index for filtering: writers, artists, publishers, genres and content rating for every manga.
 * Gathered in the background from Tranga (tags, authors) plus the extra details the Tranga API stores
 * (GET /v2/ExtraMetadata). For manga the API has no details for (or with an older API), MangaDex and
 * MangaUpdates are asked from the browser instead, politely (MangaUpdates one request per second).
 * Kept in this browser's localStorage for a week; filters work on whatever is indexed so far.
 */

const STORAGE_KEY = 'tranga-library-index-v1';
const ENABLED_KEY = 'tranga-library-index-enabled';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WORKERS = 3;

const facets = reactive(new Map<string, MangaFacets>());
const progress = reactive({ total: 0, done: 0, running: false });
let loaded = false;
let runId = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function loadStored() {
    if (loaded || typeof window === 'undefined') return;
    loaded = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, MangaFacets>)) facets.set(k, v);
    } catch {
        /* storage unavailable or corrupt: start fresh */
    }
}

function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(facets)));
        } catch {
            /* quota / private mode: index just won't persist */
        }
    }, 1000);
}

/** Re-index when missing/incomplete, over a week old, or when the API has stored newer details */
const isStale = (f: MangaFacets | undefined, storedAt?: string) =>
    !f || !f.complete || Date.now() - f.at > MAX_AGE_MS || (!!storedAt && Date.parse(storedAt) > f.at);

export function useLibraryIndex() {
    const { $api } = useNuxtApp();
    const server = useServerExtraMetadata();
    loadStored();

    /** Whether indexing has been switched on in this browser (by opening the filters once) */
    function isEnabled(): boolean {
        try {
            return localStorage.getItem(ENABLED_KEY) === '1';
        } catch {
            return false;
        }
    }

    async function indexOne(m: MinimalManga) {
        let full: Manga | undefined;
        try {
            full = (await $api('/v2/Manga/{MangaId}', { path: { MangaId: m.key } })) as Manga;
        } catch {
            /* Tranga unreachable: keep what we have, retry next time */
        }
        const previous = facets.get(m.key);
        const fromTranga: MangaFacets = {
            writers: mergeNames((full?.authors ?? []).map((a) => a.name)),
            artists: previous?.artists ?? [],
            publishers: previous?.publishers ?? [],
            genres: mergeNames(full?.tags, previous?.genres),
            rating: previous?.rating,
            complete: false,
            at: Date.now(),
        };
        facets.set(m.key, fromTranga); // usable straight away, refined below

        // Details stored by the Tranga API: no need to ask MangaUpdates/MangaDex
        const stored = server.entries.get(m.key);
        if (stored) {
            const mu = combinedSeriesInfo(stored.data);
            facets.set(m.key, {
                writers: mu?.writers.length ? mu.writers : fromTranga.writers,
                artists: mu?.artists ?? [],
                publishers: mergeNames(mu?.originalPublishers, mu?.englishPublishers),
                genres: mergeNames(fromTranga.genres, mu?.genres),
                rating: stored.data.contentRating ?? undefined,
                complete: !!full,
                at: Date.now(),
            });
            save();
            return;
        }

        const mangaDexId = mangaDexIdFromConnectors(m.mangaConnectorIds);
        const [md, mu] = await Promise.all([
            mangaDexId ? fetchMangaDexContentRating(mangaDexId) : Promise.resolve(undefined),
            fetchMangaUpdatesInfo(
                m.key,
                { links: full?.links, titles: [m.name, ...(full?.altTitles ?? []).map((t) => t.title)] },
                { releases: false, background: true }
            ),
        ]);

        facets.set(m.key, {
            writers: mu?.writers.length ? mu.writers : fromTranga.writers,
            artists: mu?.artists ?? [],
            publishers: mergeNames(mu?.originalPublishers, mu?.englishPublishers),
            genres: mergeNames(fromTranga.genres, mu?.genres),
            rating: md?.level ?? contentRatingFromGenres(mu?.genres)?.level ?? fromTranga.rating,
            complete: !!full,
            at: Date.now(),
        });
        save();
    }

    /** Index every manga that isn't indexed yet (or is over a week old). Safe to call repeatedly. */
    async function build(manga: MinimalManga[]) {
        try {
            localStorage.setItem(ENABLED_KEY, '1');
        } catch {
            /* ignore */
        }
        const id = ++runId;
        await server.load();
        if (id !== runId) return;
        const keys = new Set(manga.map((m) => m.key));
        for (const k of [...facets.keys()]) if (!keys.has(k)) facets.delete(k); // deleted manga

        const todo = manga.filter((m) => isStale(facets.get(m.key), server.entries.get(m.key)?.fetchedAt));
        progress.total = manga.length;
        progress.done = manga.length - todo.length;
        progress.running = todo.length > 0;

        let next = 0;
        const worker = async () => {
            while (next < todo.length && id === runId) {
                const m = todo[next++]!;
                await indexOne(m);
                if (id === runId) progress.done++;
            }
        };
        await Promise.all(Array.from({ length: WORKERS }, worker));
        if (id === runId) progress.running = false;
        save();
    }

    /** Values for the autocomplete lists, from everything indexed so far */
    const options = computed(() => {
        const all = [...facets.values()];
        return {
            writers: distinctSorted(all.map((f) => f.writers)),
            artists: distinctSorted(all.map((f) => f.artists)),
            publishers: distinctSorted(all.map((f) => f.publishers)),
            genres: distinctSorted(all.map((f) => f.genres)),
        };
    });

    return { facets, progress, options, build, isEnabled };
}
