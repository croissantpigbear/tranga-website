/** What the library index knows about one manga, for filtering */
export interface MangaFacets {
    writers: string[];
    artists: string[];
    publishers: string[];
    genres: string[];
    /** MangaDex content rating, or estimated from MangaUpdates genres; undefined if unknown */
    rating?: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
    /** true once all sources (Tranga, MangaDex, MangaUpdates) have been asked */
    complete: boolean;
    /** when the facets were gathered (ms) */
    at: number;
}

export type RatingFilterValue = NonNullable<MangaFacets['rating']> | 'unknown';

export interface MangaFilter {
    /** Tranga release status (any of) */
    statuses: string[];
    /** Content rating (any of) */
    ratings: RatingFilterValue[];
    /** any of */
    writers: string[];
    /** any of */
    artists: string[];
    /** any of */
    publishers: string[];
    /** all of */
    genres: string[];
}

export const emptyMangaFilter = (): MangaFilter => ({ statuses: [], ratings: [], writers: [], artists: [], publishers: [], genres: [] });

export function activeFilterCount(f: MangaFilter): number {
    return (Object.values(f) as string[][]).reduce((n, v) => n + v.length, 0);
}

/** True if the filter uses anything that needs the library index (everything except status) */
export function filterNeedsFacets(f: MangaFilter): boolean {
    return !!(f.ratings.length || f.writers.length || f.artists.length || f.publishers.length || f.genres.length);
}

const norm = (s: string) => s.trim().toLowerCase();
const hasAny = (have: string[], wanted: string[]) => {
    const set = new Set(have.map(norm));
    return wanted.some((w) => set.has(norm(w)));
};
const hasAll = (have: string[], wanted: string[]) => {
    const set = new Set(have.map(norm));
    return wanted.every((w) => set.has(norm(w)));
};

/**
 * Whether a manga passes the filter. Different fields are combined with AND;
 * within a field it's "any of", except genres which must all match.
 * Manga whose facets aren't indexed yet fail facet-based filters.
 */
export function mangaMatchesFilter(m: { releaseStatus?: string | null }, facets: MangaFacets | undefined, f: MangaFilter): boolean {
    if (f.statuses.length && !f.statuses.includes(m.releaseStatus ?? '')) return false;
    if (!filterNeedsFacets(f)) return true;
    if (!facets) return false;
    if (f.ratings.length && !f.ratings.includes(facets.rating ?? 'unknown')) return false;
    if (f.writers.length && !hasAny(facets.writers, f.writers)) return false;
    if (f.artists.length && !hasAny(facets.artists, f.artists)) return false;
    if (f.publishers.length && !hasAny(facets.publishers, f.publishers)) return false;
    if (f.genres.length && !hasAll(facets.genres, f.genres)) return false;
    return true;
}

/** Distinct values (case-insensitive, first spelling wins), sorted A–Z — for the autocomplete lists */
export function distinctSorted(lists: Iterable<string[]>): string[] {
    const seen = new Map<string, string>();
    for (const list of lists) for (const v of list) if (v.trim() && !seen.has(norm(v))) seen.set(norm(v), v.trim());
    return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Merge lists without case-insensitive duplicates, keeping the first spelling */
export function mergeNames(...lists: (string[] | undefined)[]): string[] {
    return distinctSorted([lists.flatMap((l) => l ?? [])]);
}
