/** "24.3 MB" */
export function formatBytes(bytes?: number | null): string {
    if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

/** Friendlier names for link providers ("Obj Updates" is a Tranga naming bug for MangaUpdates) */
export function linkProviderLabel(provider: string, url?: string): string {
    if (/^obj updates$/i.test(provider) || /mangaupdates\.com/i.test(url ?? '')) return 'MangaUpdates';
    if (/^raw$/i.test(provider)) return 'Raw (original)';
    if (/^engtl$/i.test(provider)) return 'Official English';
    return provider;
}

/** Integer chapter numbers missing between the lowest and highest chapter (e.g. 1, 2, 4 → [3]) */
export function chapterNumberGaps(chapterNumbers: string[], max = 50): number[] {
    const present = new Set<number>();
    for (const c of chapterNumbers) {
        const n = parseFloat(c);
        if (Number.isFinite(n)) present.add(Math.floor(n));
    }
    if (present.size < 2) return [];
    const sorted = [...present].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let n = sorted[0]! + 1; n < sorted[sorted.length - 1]! && gaps.length < max; n++) if (!present.has(n)) gaps.push(n);
    return gaps;
}

/** "Ch. 1, 3–5, 9" */
export function formatChapterRanges(numbers: number[]): string {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const start = sorted[i]!;
        let end = start;
        while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i]!;
        parts.push(start === end ? `${start}` : `${start}–${end}`);
    }
    return parts.length ? `Ch. ${parts.join(', ')}` : '';
}
