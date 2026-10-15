/** Letters shown in the A–Z jump bar, in order. '#' = digits, symbols and non-Latin titles. */
export const ALPHA_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as const;
export type AlphaLetter = (typeof ALPHA_LETTERS)[number];

/** Title without leading punctuation/spaces, e.g. "[Oshi no Ko]" → "Oshi no Ko]" (used for letter and sorting) */
const sortKey = (title?: string | null) => (title ?? '').replace(/^[^\p{L}\p{N}]+/u, '');

/** Jump-bar letter for a title: first letter with accents removed (É → E), otherwise '#'. */
export function alphaLetterOf(title?: string | null): AlphaLetter {
    const first = sortKey(title)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .charAt(0)
        .toUpperCase();
    return first >= 'A' && first <= 'Z' ? (first as AlphaLetter) : '#';
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** A–Z by title, '#' titles first (matching the jump bar order). */
export function compareByTitle(a: { name: string }, b: { name: string }): number {
    const la = alphaLetterOf(a.name);
    const lb = alphaLetterOf(b.name);
    if (la !== lb) return la === '#' ? -1 : lb === '#' ? 1 : la < lb ? -1 : 1;
    return collator.compare(sortKey(a.name), sortKey(b.name));
}

/** DOM id of the anchor for a letter */
export const alphaAnchorId = (letter: AlphaLetter) => `alpha-${letter === '#' ? 'num' : letter}`;
