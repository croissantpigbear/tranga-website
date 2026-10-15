import type { components } from '#open-fetch-schemas/api';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];
type RefreshableManga = Pick<MinimalManga | Manga, 'key' | 'name' | 'mangaConnectorIds'>;

/** Keys of manga currently being refreshed (drives the spinning icons) */
const refreshing = reactive(new Set<string>());

/**
 * Bumped whenever a manga was refreshed, so the overview rows re-fetch their details.
 * Kept per key so only the affected rows reload.
 */
export const mangaDetailsVersion = reactive(new Map<string, number>());
function bumpDetails(key: string) {
    mangaDetailsVersion.set(key, (mangaDetailsVersion.get(key) ?? 0) + 1);
}

/** The chapter check runs in the background on the server, so look again after it has had time to finish. */
const RECHECK_AFTER_MS = 45_000;

export interface RefreshResult {
    started: string[];
    skipped: string[];
    failed: string[];
    /** True if the API has no refresh endpoint and the older re-mark method was used */
    usedFallback: boolean;
}

/**
 * Whether the API has POST /v2/Manga/{id}/Refresh (added in a newer Tranga API).
 * undefined until the first refresh finds out.
 */
let apiHasRefreshEndpoint: boolean | undefined;

function httpStatus(e: unknown): number | undefined {
    const err = e as { status?: number; statusCode?: number; response?: { status?: number } };
    return err?.response?.status ?? err?.status ?? err?.statusCode;
}

/**
 * "Refresh" a manga: check its sources for new chapters now (instead of waiting for the periodic check),
 * refresh the cover, and update metadata from linked providers (e.g. MyAnimeList).
 * - Newer API: POST /v2/Manga/{id}/Refresh — doesn't change which chapters are marked for download.
 * - Older API: falls back to re-marking each source for download (PATCH /v2/Manga/{id}/DownloadFrom/{connector}/true),
 *   which also queues the check but re-marks every chapter from that source for download.
 * Manga that aren't set to download from any source are skipped.
 */
export function useMangaRefresh() {
    const { $api } = useNuxtApp();
    const toast = useToast();
    const server = useServerExtraMetadata();

    const isRefreshing = (key: string) => refreshing.has(key);

    async function refreshOne(m: RefreshableManga): Promise<'started' | 'skipped' | 'failed'> {
        const sources = m.mangaConnectorIds.filter((id) => id.useForDownload);
        if (sources.length === 0) return 'skipped';
        refreshing.add(m.key);
        try {
            let anyStarted = false;
            if (apiHasRefreshEndpoint !== false) {
                try {
                    // Not in the published API schema yet, so called untyped
                    await ($api as unknown as (url: string, opts: object) => Promise<unknown>)(
                        `/v2/Manga/${encodeURIComponent(m.key)}/Refresh`,
                        { method: 'POST' }
                    );
                    apiHasRefreshEndpoint = true;
                    anyStarted = true;
                } catch (e) {
                    const status = httpStatus(e);
                    const body = (e as { data?: unknown })?.data;
                    if (status === 412) return 'skipped';
                    // No such route (older API): 404 without the API's "MangaId" message, or 405
                    if ((status === 404 && !body) || status === 405) apiHasRefreshEndpoint = false;
                    else if (status === 404) return 'failed';
                }
            }
            if (apiHasRefreshEndpoint === false) {
                // Older API: re-marking a source for download queues the same chapter check
                for (const source of sources) {
                    try {
                        await $api('/v2/Manga/{MangaId}/DownloadFrom/{MangaConnectorName}/{IsRequested}', {
                            method: 'PATCH',
                            path: { MangaId: m.key, MangaConnectorName: source.mangaConnectorName, IsRequested: true },
                        });
                        anyStarted = true;
                    } catch {
                        /* try the other sources */
                    }
                }
            }
            // Metadata providers are optional; ignore failures (e.g. none linked)
            try {
                const links = await $api('/v2/MetadataFetcher/Links/{MangaId}', { path: { MangaId: m.key } });
                for (const link of links ?? []) {
                    if (!link.metadataFetcherName) continue;
                    try {
                        await $api('/v2/MetadataFetcher/{MetadataFetcherName}/Update/{MangaId}', {
                            method: 'POST',
                            path: { MetadataFetcherName: link.metadataFetcherName, MangaId: m.key },
                        });
                    } catch {
                        /* ignore */
                    }
                }
            } catch {
                /* ignore */
            }
            return anyStarted ? 'started' : 'failed';
        } finally {
            refreshing.delete(m.key);
        }
    }

    async function refreshManga(list: RefreshableManga[], { notify = true } = {}): Promise<RefreshResult> {
        const result: RefreshResult = { started: [], skipped: [], failed: [], usedFallback: false };
        // One manga at a time; the server queues the actual work anyway
        for (const m of list) {
            const outcome = await refreshOne(m);
            result[outcome].push(m.name);
            if (outcome === 'started') {
                server.refetch(m.key); // re-fetch the extra details the API stores (if it supports that)
                bumpDetails(m.key);
                setTimeout(() => bumpDetails(m.key), RECHECK_AFTER_MS);
            }
        }

        result.usedFallback = apiHasRefreshEndpoint === false && result.started.length > 0;
        await refreshNuxtData([FetchKeys.Manga.All, ...list.map((m) => FetchKeys.Manga.Id(m.key))]);

        if (notify) {
            const n = (count: number) => (count === 1 ? '1 manga' : `${count} manga`);
            if (result.started.length)
                toast.add({
                    title: `Refresh started for ${n(result.started.length)}`,
                    description: result.usedFallback
                        ? 'Tranga is checking for new chapters in the background. Your Tranga API has no refresh endpoint, so the older method was used: all chapters from these sources are marked for download again.'
                        : 'Tranga is checking for new chapters in the background; new ones will download automatically.',
                    color: 'success',
                    icon: 'i-lucide-refresh-cw',
                });
            if (result.skipped.length)
                toast.add({
                    title: `Skipped ${n(result.skipped.length)} not set to download`,
                    description: result.skipped.join(', '),
                    color: 'neutral',
                    icon: 'i-lucide-cloud-off',
                });
            if (result.failed.length)
                toast.add({
                    title: `Couldn't refresh ${n(result.failed.length)}`,
                    description: result.failed.join(', '),
                    color: 'error',
                    icon: 'i-lucide-circle-x',
                });
        }
        return result;
    }

    return { refreshManga, isRefreshing };
}
