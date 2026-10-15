export type MangaView = 'grid' | 'overview';

/**
 * Remembers how manga lists are displayed:
 * - `grid`: cover cards (default)
 * - `overview`: one row per manga with cover, title, synopsis and release status
 */
export const useMangaView = () =>
    useCookie<MangaView>('tranga-manga-view', { default: () => 'grid', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
