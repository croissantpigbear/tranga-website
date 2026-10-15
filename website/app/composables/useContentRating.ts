/**
 * Content (age) rating for a manga.
 * - Preferred: MangaDex's own rating (safe / suggestive / erotica / pornographic), fetched through the
 *   website's nginx at /mangadex/ (cached 24h) using the MangaDex id from the manga's MangaDex link.
 * - Fallback: derived from MangaUpdates genres (Hentai/Adult, Smut/Mature, Ecchi), which is less precise.
 */

export type ContentRatingLevel = 'safe' | 'suggestive' | 'erotica' | 'pornographic';

export interface ContentRating {
    level: ContentRatingLevel;
    label: string;
    color: 'success' | 'warning' | 'error' | 'neutral';
    source: 'MangaDex' | 'MangaUpdates genres';
    /** Tooltip text explaining where it came from */
    description: string;
}

const LABELS: Record<ContentRatingLevel, { label: string; color: ContentRating['color']; meaning: string }> = {
    safe: { label: 'Safe', color: 'success', meaning: 'Safe — no sexual content (may still contain e.g. violence)' },
    suggestive: { label: 'Suggestive', color: 'warning', meaning: 'Suggestive — mild fan service' },
    erotica: { label: 'Erotica (18+)', color: 'error', meaning: 'Erotica — sexual themes or nudity' },
    pornographic: { label: 'Explicit (18+)', color: 'error', meaning: 'Pornographic — explicit sexual content' },
};

/** Badge info for a rating level (also used for ratings stored by the Tranga API) */
export function contentRatingFromLevel(level: ContentRatingLevel, source: ContentRating['source']): ContentRating {
    const l = LABELS[level];
    return {
        level,
        label: l.label,
        color: l.color,
        source,
        description:
            source === 'MangaDex'
                ? `${l.meaning} (MangaDex content rating)`
                : `${l.meaning} (estimated from MangaUpdates genres)`,
    };
}

/** MangaDex manga id from a connector's website link, e.g. https://mangadex.org/title/<uuid>/... */
export function mangaDexIdFromConnectors(ids?: { mangaConnectorName: string; websiteUrl?: string | null }[]): string | undefined {
    for (const id of ids ?? []) {
        const m = id.websiteUrl?.match(/mangadex\.org\/title\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m?.[1]) return m[1].toLowerCase();
    }
    return undefined;
}

/** Rough rating from MangaUpdates genres; undefined if nothing suggests adult content (absence doesn't mean "safe") */
export function contentRatingFromGenres(genres?: string[]): ContentRating | undefined {
    const g = new Set((genres ?? []).map((x) => x.toLowerCase()));
    if (g.has('hentai') || g.has('adult')) return contentRatingFromLevel('pornographic', 'MangaUpdates genres');
    if (g.has('smut') || g.has('mature')) return contentRatingFromLevel('erotica', 'MangaUpdates genres');
    if (g.has('ecchi')) return contentRatingFromLevel('suggestive', 'MangaUpdates genres');
    return undefined;
}

// One MangaDex request at a time, a little apart (MangaDex allows ~5/s; nginx caches anyway)
let chain: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
        try {
            return await fn();
        } finally {
            await new Promise((r) => setTimeout(r, 300));
        }
    });
    chain = run.catch(() => undefined);
    return run;
}

const memory = new Map<string, Promise<ContentRating | undefined>>();

export function fetchMangaDexContentRating(mangaDexId: string): Promise<ContentRating | undefined> {
    let p = memory.get(mangaDexId);
    if (!p) {
        p = queued(() => $fetch<{ data?: { attributes?: { contentRating?: string } } }>(`/mangadex/manga/${mangaDexId}`))
            .then((res) => {
                const level = res?.data?.attributes?.contentRating as ContentRatingLevel | undefined;
                return level && level in LABELS ? contentRatingFromLevel(level, 'MangaDex') : undefined;
            })
            .catch(() => undefined);
        memory.set(mangaDexId, p);
    }
    return p;
}
