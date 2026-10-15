import type { MangaUpdatesInfo } from '~/composables/useMangaUpdates';

type MuLike = Pick<MangaUpdatesInfo, 'writers' | 'artists' | 'originalPublishers' | 'englishPublishers' | 'publications'> | null | undefined;

const sameNames = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase()));

/** "By X" / "Story X · Art Y", publishers and magazine — from MangaUpdates, falling back to the authors Tranga stored */
export function mangaCredits(mu: MuLike, trangaAuthors: string[] = []): { label: string; value: string }[] {
    const list: { label: string; value: string }[] = [];
    const writers = mu?.writers.length ? mu.writers : trangaAuthors;
    const artists = mu?.artists ?? [];
    if (writers.length && artists.length && sameNames(writers, artists)) list.push({ label: 'By', value: writers.join(', ') });
    else {
        if (writers.length) list.push({ label: mu?.writers.length ? 'Story' : 'By', value: writers.join(', ') });
        if (artists.length) list.push({ label: 'Art', value: artists.join(', ') });
    }
    const publishers = [...(mu?.originalPublishers ?? []), ...(mu?.englishPublishers ?? []).map((p) => `${p} (EN)`)];
    if (publishers.length) list.push({ label: publishers.length > 1 ? 'Publishers' : 'Publisher', value: publishers.join(', ') });
    if (mu?.publications.length) list.push({ label: 'In', value: mu.publications[0]! });
    return list;
}

/** "27 volumes · Ongoing" / "No volumes yet · Ongoing" / raw status text */
export function mangaUpdatesStatusText(mu: Pick<MangaUpdatesInfo, 'status' | 'volumes' | 'statusWord'> | null | undefined): string {
    if (!mu?.status) return '';
    if (mu.volumes !== undefined && mu.volumes !== null) {
        const vols = mu.volumes === 0 ? 'No volumes yet' : `${mu.volumes} ${mu.volumes === 1 ? 'volume' : 'volumes'}`;
        return mu.statusWord ? `${vols} · ${mu.statusWord}` : vols;
    }
    return mu.statusWord ?? mu.status;
}
