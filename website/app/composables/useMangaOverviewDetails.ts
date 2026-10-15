import type { components } from '#open-fetch-schemas/api';
import type { MangaUpdatesInfo } from './useMangaUpdates';
import type { ContentRating } from './useContentRating';
type Manga = components['schemas']['Manga'];
type Chapter = components['schemas']['Chapter'];
type AltTitle = components['schemas']['AltTitle'];
type ActionRecord = components['schemas']['ActionRecord'];

/** Extra per-manga info shown in the overview list. Each field is undefined when the API had nothing for it. */
export interface MangaOverviewDetails {
    /** Release (start) year — Tranga only stores a year, no full start/end dates */
    year?: number | null;
    /** Alternative titles for the subtitle, best first (English first) */
    altTitles: string[];
    /** Chapters Tranga knows about */
    chapterCount?: number;
    /** Chapters on disk */
    downloadedCount?: number;
    /** Highest-numbered chapter available on the source */
    latestChapter?: Chapter | null;
    /** Most recently downloaded chapter (from the actions log, falling back to the highest downloaded chapter) */
    lastDownloaded?: Chapter | null;
    /** When lastDownloaded was downloaded (from the actions log; missing if the log was cleaned up) */
    lastDownloadedAt?: string | null;
    /** Links Tranga stored for the manga (used to find it on MangaUpdates) */
    links?: { provider: string; url: string }[];
    /** Main title plus every alternative title (used for title matching on MangaUpdates) */
    allTitles?: string[];
    /** Author names Tranga stored (from the source; no writer/artist distinction) */
    authors?: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT = 4;

const cache = new Map<string, { at: number; promise: Promise<MangaOverviewDetails> }>();

// Simple concurrency limiter so a large library doesn't fire hundreds of requests at once
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
        return await fn();
    } finally {
        active--;
        waiting.shift()?.();
    }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
        return await fn();
    } catch {
        return undefined;
    }
}

/** API returns 204 (empty body) when there's nothing; normalise that to null */
function chapterOrNull(value: unknown): Chapter | null {
    return value && typeof value === 'object' && 'key' in value ? (value as Chapter) : null;
}

const isEnglish = (lang: string) => /^(en\b|en-|english)/i.test(lang);
const isRomanised = (lang: string) => /-ro$|^default$|^romaji$/i.test(lang);

/** Picks up to `max` distinct alternative titles, English first, then romanised, then anything else. */
export function pickAltTitles(altTitles: AltTitle[] | undefined, mainTitle: string, max = 2): string[] {
    if (!altTitles?.length) return [];
    const rank = (t: AltTitle) => (isEnglish(t.language) ? 0 : isRomanised(t.language) ? 1 : 2);
    const seen = new Set([mainTitle.trim().toLowerCase()]);
    const result: string[] = [];
    for (const t of [...altTitles].sort((a, b) => rank(a) - rank(b))) {
        const key = t.title.trim().toLowerCase();
        // Skip duplicates and non-Latin titles that aren't ranked (keeps the subtitle readable)
        if (!key || seen.has(key)) continue;
        // Other languages only as a fallback when there's no English/romanised title, and only if readable (Latin script)
        if (rank(t) === 2 && (result.length > 0 || !/[a-z]/i.test(t.title))) continue;
        seen.add(key);
        result.push(t.title.trim());
        if (result.length >= max) break;
    }
    return result;
}

export function useMangaOverviewDetails(
    manga: Readonly<Ref<{ key: string; name: string; mangaConnectorIds?: { mangaConnectorName: string; websiteUrl?: string | null }[] }>>,
    visible: Readonly<Ref<boolean>>
) {
    const { $api } = useNuxtApp();
    const details = ref<MangaOverviewDetails>();
    const loading = ref(false);
    /** MangaUpdates info: undefined while loading, null if not found */
    const mangaUpdates = ref<MangaUpdatesInfo | null>();
    /** Content rating from MangaDex if available (falls back to MangaUpdates genres in the UI) */
    const mangaDexRating = ref<ContentRating>();
    const contentRating = computed<ContentRating | undefined>(
        () => mangaDexRating.value ?? contentRatingFromGenres(mangaUpdates.value?.genres)
    );

    async function fetchDetails(mangaId: string, name: string): Promise<MangaOverviewDetails> {
        return limited(async () => {
            const [full, all, downloaded, latest, lastAction] = await Promise.all([
                safe(() => $api('/v2/Manga/{MangaId}', { path: { MangaId: mangaId } }) as Promise<Manga>),
                safe(() =>
                    $api('/v2/Chapters/Manga/{MangaId}', {
                        method: 'POST',
                        path: { MangaId: mangaId },
                        query: { page: 1, pageSize: 1 },
                        body: {},
                    })
                ),
                safe(() =>
                    $api('/v2/Chapters/Manga/{MangaId}', {
                        method: 'POST',
                        path: { MangaId: mangaId },
                        query: { page: 1, pageSize: 1 },
                        body: { downloaded: true },
                    })
                ),
                // Schema says this returns a number, but the API actually returns the Chapter
                safe(() => $api('/v2/Chapters/LatestAvailable/{MangaId}', { path: { MangaId: mangaId } }) as Promise<unknown>),
                // Actions are returned newest first
                safe(() =>
                    $api('/v2/Actions/Filter', {
                        method: 'POST',
                        query: { page: 1, pageSize: 1 },
                        body: { mangaId: mangaId, action: 'ChapterDownloaded' },
                    })
                ),
            ]);

            const action: ActionRecord | undefined = lastAction?.data?.[0];
            let lastDownloaded: Chapter | null | undefined;
            if (action?.chapterId) {
                lastDownloaded = chapterOrNull(
                    await safe(() => $api('/v2/Chapters/{ChapterId}', { path: { ChapterId: action.chapterId! } }))
                );
            }
            if (!lastDownloaded && (downloaded?.totalCount ?? 0) > 0) {
                lastDownloaded = chapterOrNull(await safe(() => $api('/v2/Chapters/LatestDownloaded/{MangaId}', { path: { MangaId: mangaId } })));
            }

            return {
                year: full?.year,
                altTitles: pickAltTitles(full?.altTitles, name),
                links: full?.links,
                allTitles: [name, ...(full?.altTitles ?? []).map((t) => t.title)],
                authors: (full?.authors ?? []).map((a) => a.name).filter(Boolean),
                chapterCount: all?.totalCount,
                downloadedCount: downloaded?.totalCount,
                latestChapter: latest === undefined ? undefined : chapterOrNull(latest),
                lastDownloaded: lastDownloaded ?? null,
                lastDownloadedAt: lastDownloaded && action?.chapterId === lastDownloaded.key ? action.performedAt : null,
            };
        });
    }

    async function load(force = false) {
        const { key, name } = manga.value;
        const cached = cache.get(key);
        let entry = !force && cached && Date.now() - cached.at < CACHE_TTL_MS ? cached : undefined;
        if (!entry) {
            entry = { at: Date.now(), promise: fetchDetails(key, name) };
            cache.set(key, entry);
        }
        loading.value = !details.value;
        try {
            details.value = await entry.promise;
            loadMangaUpdates(key, details.value, force);
            loadContentRating(key);
        } finally {
            loading.value = false;
        }
    }

    // Only fetch once the row has scrolled into view
    watch(
        [visible, () => manga.value.key],
        ([isVisible]) => {
            if (isVisible) load();
        },
        { immediate: true }
    );

    // Re-fetch (bypassing the cache) after this manga was refreshed — see useMangaRefresh
    watch(
        () => mangaDetailsVersion.get(manga.value.key),
        (version) => {
            if (version !== undefined) {
                cache.delete(manga.value.key);
                if (visible.value) load(true);
            }
        }
    );

    // Fetched after the Tranga details (it needs the stored links) and queued politely, so it fills in a bit later
    const server = useServerExtraMetadata();

    // Prefer details stored by the Tranga API; only look things up from the browser when it has none
    async function loadMangaUpdates(key: string, d: MangaOverviewDetails, force: boolean) {
        if (mangaUpdates.value !== undefined && !force) return;
        await server.load(force);
        const stored = server.entries.get(key);
        if (stored) {
            if (manga.value.key === key) mangaUpdates.value = (stored.data.mangaUpdates as MangaUpdatesInfo | null | undefined) ?? null;
            return;
        }
        const info = await fetchMangaUpdatesInfo(key, { links: d.links, titles: d.allTitles ?? [] }, { force });
        if (manga.value.key === key) mangaUpdates.value = info;
    }

    async function loadContentRating(key: string) {
        if (mangaDexRating.value) return;
        await server.load();
        const stored = server.entries.get(key);
        if (stored) {
            const level = stored.data.contentRating;
            if (level && manga.value.key === key)
                mangaDexRating.value = contentRatingFromLevel(level, stored.data.contentRatingSource ?? 'MangaDex');
            return;
        }
        const id = mangaDexIdFromConnectors(manga.value.mangaConnectorIds);
        if (!id) return;
        const rating = await fetchMangaDexContentRating(id);
        if (manga.value.key === key) mangaDexRating.value = rating;
    }

    return { details, loading, mangaUpdates, contentRating };
}

/** "3 Oct 2026" for dates this year or older, "2 hours ago"-style for the last few days */
export function formatDownloadDate(iso?: string | null): string | undefined {
    if (!iso) return undefined;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    const diffMs = Date.now() - date.getTime();
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 7) return rtf.format(-days, 'day');
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Vol. 3 Ch. 42" / "Ch. 42" */
export function formatChapter(ch?: Chapter | null): string | undefined {
    if (!ch) return undefined;
    const vol = ch.volume && ch.volume > 0 ? `Vol. ${ch.volume} ` : '';
    return `${vol}Ch. ${ch.chapterNumber}`;
}
