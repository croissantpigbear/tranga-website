import type { components } from '#open-fetch-schemas/api';
type MangaReleaseStatus = components['schemas']['MangaReleaseStatus'];

export interface ReleaseStatusInfo {
    label: string;
    color: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
    icon: string;
    /** Tailwind background class for the accent bar under the cover */
    barClass: string;
}

const statusInfo: Record<MangaReleaseStatus, ReleaseStatusInfo> = {
    Continuing: { label: 'Releasing', color: 'success', icon: 'i-lucide-circle-play', barClass: 'bg-success' },
    Completed: { label: 'Completed', color: 'secondary', icon: 'i-lucide-circle-check', barClass: 'bg-secondary' },
    OnHiatus: { label: 'Hiatus', color: 'warning', icon: 'i-lucide-circle-pause', barClass: 'bg-warning' },
    Cancelled: { label: 'Cancelled', color: 'error', icon: 'i-lucide-circle-x', barClass: 'bg-error' },
    Unreleased: { label: 'Unreleased', color: 'neutral', icon: 'i-lucide-clock', barClass: 'bg-neutral-400' },
};

const unknownStatus: ReleaseStatusInfo = { label: 'Unknown', color: 'neutral', icon: 'i-lucide-circle-help', barClass: 'bg-neutral-400' };

export function releaseStatusInfo(status?: MangaReleaseStatus | null): ReleaseStatusInfo {
    return (status && statusInfo[status]) || unknownStatus;
}

/** Turns a (possibly Markdown/HTML) description into a single line of plain text for previews. */
export function plainTextDescription(description?: string | null): string {
    if (!description) return '';
    return description
        .replace(/<[^>]*>/g, ' ') // HTML tags
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
        .replace(/^\s*([-*_]\s*){3,}$/gm, '') // horizontal rules
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
        .replace(/(\*\*|__|\*|_|~~|`)/g, '') // emphasis / code
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
