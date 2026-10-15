/** The last few searches on the Add manga page (this browser only) */
export interface RecentSearch {
    query: string;
    site: string;
}

const KEY = 'tranga-recent-searches';
const MAX = 8;
const list = ref<RecentSearch[]>([]);
let loaded = false;

function persist() {
    try {
        localStorage.setItem(KEY, JSON.stringify(list.value));
    } catch {
        /* storage unavailable */
    }
}

export function useRecentSearches() {
    if (!loaded && typeof window !== 'undefined') {
        loaded = true;
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) list.value = (JSON.parse(raw) as RecentSearch[]).filter((r) => r && typeof r.query === 'string').slice(0, MAX);
        } catch {
            /* ignore */
        }
    }
    function add(query: string, site: string) {
        const q = query.trim();
        if (!q) return;
        list.value = [{ query: q, site }, ...list.value.filter((r) => r.query.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
        persist();
    }
    function remove(query: string) {
        list.value = list.value.filter((r) => r.query !== query);
        persist();
    }
    function clear() {
        list.value = [];
        persist();
    }
    return { recent: list, add, remove, clear };
}
