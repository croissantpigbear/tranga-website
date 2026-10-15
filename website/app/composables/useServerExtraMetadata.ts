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
        contentRatingSource?: 'MangaDex' | 'MangaUpdates genres' | null;
        mangaDexId?: string | null;
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
