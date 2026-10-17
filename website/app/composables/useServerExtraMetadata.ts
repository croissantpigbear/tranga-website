import type { MangaUpdatesInfo } from './useMangaUpdates';
import type { ContentRatingLevel } from './useContentRating';

/**
 * Extra details (MangaUpdates info, content rating) that the Tranga API stores once per manga
 * (GET /v2/ExtraMetadata, added in a newer API). When available, the website uses these instead of
 * asking MangaUpdates/MangaDex itself; with an older API it falls back to doing that in the browser.
 */
export interface ServerExtraMetadata {
    mangaId: string;
    fetchedAt: string;
    data: {
        mangaUpdates?: Omit<MangaUpdatesInfo, 'latestRelease'> | null;
        contentRating?: ContentRatingLevel | null;
        contentRatingSource?: 'MangaDex' | 'MangaUpdates genres' | 'AniList' | null;
        mangaDexId?: string | null;
        aniList?: AniListInfo | null;
    };
}

/** Series info from AniList, stored by the Tranga API (fills gaps MangaUpdates leaves) */
export interface AniListInfo {
    id: number;
    url: string;
    matchedBy: 'link' | 'title';
    titleRomaji?: string;
    titleEnglish?: string;
    titleNative?: string;
    synonyms: string[];
    description?: string;
    format?: string;
    status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
    startYear?: number;
    endYear?: number;
    chapters?: number;
    volumes?: number;
    countryOfOrigin?: string;
    isAdult?: boolean;
    /** 0–100 */
    averageScore?: number;
    genres: string[];
    tags: string[];
    writers: string[];
    artists: string[];
}

const ANILIST_STATUS: Record<string, string> = {
    FINISHED: 'Complete',
    RELEASING: 'Ongoing',
    HIATUS: 'Hiatus',
    CANCELLED: 'Cancelled',
    NOT_YET_RELEASED: 'Not yet released',
};

/** AniList info in the same shape as MangaUpdates info, so the rest of the website can show it */
function fromAniList(al: AniListInfo): MangaUpdatesInfo {
    const statusWord = al.status ? ANILIST_STATUS[al.status] : undefined;
    const start = al.startYear ? String(al.startYear) : undefined;
    const end = al.endYear ? String(al.endYear) : undefined;
    return {
        seriesId: al.id,
        url: al.url,
        title: al.titleEnglish ?? al.titleRomaji ?? al.titleNative ?? '',
        matchedBy: al.matchedBy,
        year: start && end && end !== start ? `${start}-${end}` : start,
        startYear: start,
        endYear: end,
        status: statusWord,
        statusWord,
        volumes: al.volumes ?? undefined,
        completed: al.status ? al.status === 'FINISHED' : undefined,
        rating: al.averageScore ? al.averageScore / 10 : undefined,
        genres: al.genres ?? [],
        associated: [al.titleEnglish, al.titleRomaji, al.titleNative, ...(al.synonyms ?? [])].filter((t): t is string => !!t),
        writers: al.writers ?? [],
        artists: al.artists ?? [],
        originalPublishers: [],
        englishPublishers: [],
        publications: [],
        source: 'AniList',
        sources: [{ name: 'AniList', url: al.url, matchedBy: al.matchedBy }],
    };
}

/**
 * Series details from everything the API stored: MangaUpdates first, with AniList filling what MangaUpdates
 * doesn't have (or replacing it entirely when MangaUpdates had no match). Null when neither matched.
 */
export function combinedSeriesInfo(data: ServerExtraMetadata['data'] | undefined): MangaUpdatesInfo | null {
    const mu = data?.mangaUpdates ? ({ ...data.mangaUpdates } as MangaUpdatesInfo) : null;
    const al = data?.aniList ? fromAniList(data.aniList) : null;
    if (!mu) return al;
    const muSource = { name: 'MangaUpdates', url: mu.url, matchedBy: mu.matchedBy };
    if (!al) return { ...mu, source: 'MangaUpdates', sources: [muSource] };
    const seen = new Set(mu.associated.map((t) => t.toLowerCase()));
    return {
        ...mu,
        year: mu.year ?? al.year,
        startYear: mu.startYear ?? al.startYear,
        endYear: mu.endYear ?? al.endYear,
        status: mu.status ?? al.status,
        statusWord: mu.statusWord ?? al.statusWord,
        volumes: mu.volumes ?? al.volumes,
        completed: mu.completed ?? al.completed,
        rating: mu.rating ?? al.rating,
        genres: mu.genres.length ? mu.genres : al.genres,
        writers: mu.writers.length ? mu.writers : al.writers,
        artists: mu.artists.length ? mu.artists : al.artists,
        associated: [...mu.associated, ...al.associated.filter((t) => !seen.has(t.toLowerCase()))],
        source: 'MangaUpdates and AniList',
        sources: [muSource, ...al.sources!],
    };
}

const entries = reactive(new Map<string, ServerExtraMetadata>());
/** supported: undefined until the first request answers */
const state = reactive<{ supported?: boolean; loadedAt: number }>({ loadedAt: 0 });
let inFlight: Promise<void> | undefined;
const RELOAD_AFTER_MS = 60_000;

function httpStatus(e: unknown): number | undefined {
    const err = e as { status?: number; statusCode?: number; response?: { status?: number } };
    return err?.response?.status ?? err?.status ?? err?.statusCode;
}

export function useServerExtraMetadata() {
    const config = useRuntimeConfig();
    const base = `${config.public.openFetch.api.baseURL}v2/ExtraMetadata`;

    /** Loads all stored details in one request (shared by every row; reloaded at most once a minute unless forced) */
    function load(force = false): Promise<void> {
        if (state.supported === false) return Promise.resolve();
        if (inFlight) return inFlight;
        if (!force && state.loadedAt && Date.now() - state.loadedAt < RELOAD_AFTER_MS) return Promise.resolve();
        inFlight = (async () => {
            try {
                const list = await $fetch<ServerExtraMetadata[]>(base);
                entries.clear();
                for (const e of list ?? []) entries.set(e.mangaId, e);
                state.supported = true;
                state.loadedAt = Date.now();
            } catch (e) {
                const status = httpStatus(e);
                if (status === 404 || status === 405) state.supported = false; // older API without this endpoint
            } finally {
                inFlight = undefined;
            }
        })();
        return inFlight;
    }

    /** Ask the API to re-fetch one manga's details (e.g. from the Refresh button) */
    async function refetch(mangaKey: string): Promise<boolean> {
        if (state.supported === false) return false;
        try {
            await $fetch(`${base}/${encodeURIComponent(mangaKey)}/Refresh`, { method: 'POST' });
            return true;
        } catch {
            return false;
        }
    }

    return { entries, state, load, refetch };
}
