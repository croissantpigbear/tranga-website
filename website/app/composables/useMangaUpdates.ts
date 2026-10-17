/**
 * Extra series info from MangaUpdates (https://api.mangaupdates.com), fetched through the website's nginx
 * at /mangaupdates/ (see nginx/templates/default.conf.template), which caches responses for 24h.
 *
 * MangaUpdates' acceptable use policy asks to credit them, space out requests and cache — hence the
 * attribution link in the UI, the one-at-a-time queue below and the caching here and in nginx.
 */

export interface MangaUpdatesInfo {
    seriesId: number;
    url: string;
    title: string;
    /** How the series was matched: via the MangaUpdates link Tranga stored from MangaDex, or an exact title match */
    matchedBy: 'link' | 'title';
    /** "2014" or "2014-2021" as given by MangaUpdates */
    year?: string;
    startYear?: string;
    endYear?: string;
    /** Raw status text, e.g. "27 Volumes (Ongoing)" */
    status?: string;
    volumes?: number;
    statusWord?: string;
    completed?: boolean;
    licensed?: boolean;
    latestChapter?: number;
    rating?: number;
    ratingVotes?: number;
    genres: string[];
    associated: string[];
    /** People by role: MangaUpdates uses "Author" (story) and "Artist" (art) */
    writers: string[];
    artists: string[];
    /** Publishers by market: "Original" (e.g. Japanese) and "English" */
    originalPublishers: string[];
    englishPublishers: string[];
    /** Magazines / imprints the series runs in, e.g. "Weekly Shounen Jump" */
    publications: string[];
    /** Where these details come from, e.g. "MangaUpdates", "AniList" or "MangaUpdates and AniList" */
    source?: string;
    /** Each source with its page, for "Info from …" links */
    sources?: { name: string; url: string; matchedBy: 'link' | 'title' }[];
    /** Most recent scanlation release listed on MangaUpdates (may be unavailable) */
    latestRelease?: { chapter?: string; volume?: string; date?: string; groups: string[] };
}

const BASE = '/mangaupdates';
const MIN_GAP_MS = 1000; // "reasonable spacing between requests"
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;

// --- polite request queue: one request at a time, at least MIN_GAP_MS apart ---
// Two priorities: rows on screen ("high") always go before the background library index ("low").
type Priority = 'high' | 'low';
const waiting: Record<Priority, (() => Promise<void>)[]> = { high: [], low: [] };
let pumping = false;
let lastRequestAt = 0;

async function pump() {
    if (pumping) return;
    pumping = true;
    try {
        while (waiting.high.length || waiting.low.length) {
            const wait = lastRequestAt + MIN_GAP_MS - Date.now();
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
            const task = waiting.high.shift() ?? waiting.low.shift(); // re-checked after waiting
            if (!task) continue;
            await task();
            lastRequestAt = Date.now();
        }
    } finally {
        pumping = false;
    }
}

function queued<T>(fn: () => Promise<T>, priority: Priority): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        waiting[priority].push(async () => {
            try {
                resolve(await fn());
            } catch (e) {
                reject(e);
            }
        });
        pump();
    });
}

function muGet<T>(path: string, priority: Priority): Promise<T> {
    return queued(() => $fetch<T>(`${BASE}/${path}`), priority);
}
function muPost<T>(path: string, body: object, priority: Priority): Promise<T> {
    return queued(() => $fetch<T>(`${BASE}/${path}`, { method: 'POST', body }), priority);
}

// --- helpers ---
function decodeEntities(s?: string | null): string {
    if (!s) return '';
    if (typeof document === 'undefined') return s;
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
}
const normalise = (s: string) =>
    decodeEntities(s)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/**
 * MangaUpdates series id from a link Tranga stored (MangaDex provides it; Tranga currently labels it "Obj Updates").
 * New-style ids are base-36 slugs (e.g. "pb8uwds") or the decoded number; old 1-6 digit ids aren't usable with the API.
 */
export function mangaUpdatesIdFromLinks(links?: { provider: string; url: string }[]): number | undefined {
    for (const link of links ?? []) {
        if (!/mangaupdates\.com/i.test(link.url)) continue;
        const m = link.url.match(/[?&]id=([0-9a-z]+)/i) ?? link.url.match(/\/series\/([0-9a-z]+)/i);
        const raw = m?.[1]?.toLowerCase();
        if (!raw) continue;
        if (/^[0-9]+$/.test(raw)) {
            if (raw.length >= 8) return Number(raw); // already a new numeric id
            continue; // legacy id
        }
        const id = parseInt(raw, 36);
        if (Number.isSafeInteger(id) && id > 0) return id;
    }
    return undefined;
}

// --- API shapes (only the fields used) ---
interface MuSeries {
    series_id: number;
    title: string;
    url: string;
    associated?: { title: string }[];
    year?: string | null;
    status?: string | null;
    completed?: boolean;
    licensed?: boolean;
    latest_chapter?: number;
    bayesian_rating?: number | null;
    rating_votes?: number;
    genres?: { genre: string }[];
    authors?: { name: string; type?: string }[];
    publishers?: { publisher_name?: string; type?: string }[];
    publications?: { publication_name?: string; publisher_name?: string }[];
}
interface MuSearchResponse {
    results?: { record: { series_id: number; title: string }; hit_title?: string }[];
}
interface MuReleaseSearchResponse {
    results?: { record: { chapter?: string; volume?: string; release_date?: string; groups?: { name: string }[] } }[];
}

async function findByTitle(titles: string[], priority: Priority): Promise<number | undefined> {
    const wanted = new Set(titles.map(normalise).filter(Boolean));
    if (!wanted.size || !titles[0]) return undefined;
    const res = await muPost<MuSearchResponse>('series/search', { search: titles[0], perpage: 10 }, priority);
    // Only accept an exact (normalised) title match, to avoid showing info for the wrong series
    const hit = res.results?.find((r) => wanted.has(normalise(r.record.title)) || (r.hit_title && wanted.has(normalise(r.hit_title))));
    return hit?.record.series_id;
}

async function latestRelease(seriesId: number, priority: Priority): Promise<MangaUpdatesInfo['latestRelease']> {
    try {
        const res = await muPost<MuReleaseSearchResponse>('releases/search', {
            search: String(seriesId),
            search_type: 'series',
            orderby: 'date',
            asc: 'desc',
            perpage: 1,
        }, priority);
        const r = res.results?.[0]?.record;
        if (!r) return undefined;
        return {
            chapter: r.chapter || undefined,
            volume: r.volume || undefined,
            date: r.release_date || undefined,
            groups: (r.groups ?? []).map((g) => decodeEntities(g.name)).filter(Boolean),
        };
    } catch {
        return undefined; // e.g. if MangaUpdates requires a login for release search
    }
}

const uniq = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];
function namesOf(people: MuSeries['authors'], roleMatches: (type: string) => boolean): string[] {
    return uniq((people ?? []).filter((p) => roleMatches(p.type ?? '')).map((p) => decodeEntities(p.name)));
}

function toInfo(s: MuSeries, matchedBy: MangaUpdatesInfo['matchedBy']): MangaUpdatesInfo {
    const year = s.year?.trim() || undefined;
    const [startYear, endYear] = year ? year.split(/\s*-\s*/) : [];
    const status = decodeEntities(s.status).trim() || undefined;
    const volumes = status?.match(/(\d+)\s+Volumes?/i)?.[1];
    const statusWord = status?.match(/\(([^)]+)\)/)?.[1];
    return {
        seriesId: s.series_id,
        url: s.url,
        title: decodeEntities(s.title),
        matchedBy,
        year,
        startYear: startYear || undefined,
        endYear: endYear || undefined,
        status,
        volumes: volumes ? Number(volumes) : undefined,
        statusWord,
        completed: s.completed,
        licensed: s.licensed,
        latestChapter: s.latest_chapter && s.latest_chapter > 0 ? s.latest_chapter : undefined,
        rating: s.bayesian_rating ?? undefined,
        ratingVotes: s.rating_votes,
        genres: (s.genres ?? []).map((g) => decodeEntities(g.genre)).filter(Boolean),
        associated: (s.associated ?? []).map((a) => decodeEntities(a.title)).filter(Boolean),
        writers: namesOf(s.authors, (t) => /author|story|original/i.test(t)),
        artists: namesOf(s.authors, (t) => /artist|art|illustrat/i.test(t)),
        originalPublishers: uniq((s.publishers ?? []).filter((p) => /original/i.test(p.type ?? '')).map((p) => decodeEntities(p.publisher_name))),
        englishPublishers: uniq((s.publishers ?? []).filter((p) => /english/i.test(p.type ?? '')).map((p) => decodeEntities(p.publisher_name))),
        publications: uniq((s.publications ?? []).map((p) => decodeEntities(p.publication_name))),
    };
}

const memory = new Map<string, { at: number; promise: Promise<MangaUpdatesInfo | null> }>();

/**
 * Looks up a Tranga manga on MangaUpdates. Resolves to null when there's no confident match
 * or MangaUpdates can't be reached.
 */
export function fetchMangaUpdatesInfo(
    mangaKey: string,
    lookup: { links?: { provider: string; url: string }[]; titles: string[] },
    { force = false, releases = true, background = false } = {}
): Promise<MangaUpdatesInfo | null> {
    // Lookups without the release search (used by the library index) are cached separately
    const cacheKey = releases ? mangaKey : `${mangaKey}|series-only`;
    const cached = memory.get(cacheKey) ?? (releases ? undefined : memory.get(mangaKey));
    if (!force && cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.promise;

    const priority: Priority = background ? 'low' : 'high';
    const promise = (async () => {
        try {
            let matchedBy: MangaUpdatesInfo['matchedBy'] = 'link';
            let id = mangaUpdatesIdFromLinks(lookup.links);
            if (!id) {
                matchedBy = 'title';
                id = await findByTitle(lookup.titles, priority);
            }
            if (!id) return null;
            const series = await muGet<MuSeries>(`series/${id}`, priority);
            const info = toInfo(series, matchedBy);
            if (releases) info.latestRelease = await latestRelease(id, priority);
            return info;
        } catch {
            return null;
        }
    })();
    memory.set(cacheKey, { at: Date.now(), promise });
    return promise;
}
