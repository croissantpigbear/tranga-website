/** Title matching for the Add manga page: relevance sorting and spotting series you already have. */

/** Lower-case, accents and punctuation removed, single spaces: "Rappa: Yankee Ninpuuchou!" → "rappa yankee ninpuuchou" */
export function normalizeTitle(title?: string | null): string {
    return (title ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

/** 0–100: how well a title matches what was searched for */
export function relevance(query: string, titles: (string | null | undefined)[]): number {
    const q = normalizeTitle(query);
    if (!q) return 0;
    const qWords = q.split(' ');
    let best = 0;
    for (const raw of titles) {
        const t = normalizeTitle(raw);
        if (!t) continue;
        let score: number;
        if (t === q) score = 100;
        else if (t.startsWith(q)) score = 85;
        else if (t.includes(q)) score = 70;
        else {
            const tWords = new Set(t.split(' '));
            const hits = qWords.filter((w) => tWords.has(w) || [...tWords].some((tw) => tw.startsWith(w) && w.length >= 3)).length;
            score = Math.round((hits / qWords.length) * 60);
        }
        // Slightly prefer shorter titles (the main series over spin-offs with longer names)
        score -= Math.min(10, Math.max(0, t.length - q.length) / 10);
        best = Math.max(best, score);
    }
    return best;
}

/** True if any title of one appears among the titles of the other (ignoring case, accents and punctuation) */
export function sameTitle(a: (string | null | undefined)[], b: (string | null | undefined)[]): boolean {
    const set = new Set(a.map(normalizeTitle).filter((t) => t.length >= 3));
    return b.some((t) => set.has(normalizeTitle(t)));
}

const EDITION = /\b(r ?-?18|adult|uncensored|censored|colou?r(?:ed)?|full ?colou?r|official|novel|light ?novel|anthology|one ?-?shot|doujin(?:shi)?|remake|webtoon|spin ?-?off)\b/gi;

/** Edition markers in a title ("R18", "Colored", "Official", …): "Title" and "Title [R18]" are different series */
export function editionTags(title?: string | null): string {
    const tags = [...(title ?? '').matchAll(EDITION)].map((m) =>
        m[0].toLowerCase().replace(/[^a-z0-9]/g, '').replace('colour', 'color').replace('colored', 'color').replace('doujinshi', 'doujin')
    );
    return [...new Set(tags)].sort().join(',');
}

/** "https://…", "http://…" or "www.…" */
export function looksLikeUrl(input: string): boolean {
    const s = input.trim();
    if (/^www\./i.test(s)) return true;
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}
