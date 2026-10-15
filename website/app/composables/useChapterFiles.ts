/**
 * Downloaded chapter files (size, date), single-chapter file deletion and the chapter-check schedule,
 * from the /v2/ChapterFiles endpoints of a newer Tranga API. With an older API, `supported` becomes false
 * and the page simply doesn't show sizes or the per-chapter delete.
 */
export interface ChapterFile {
    chapterId: string;
    fileName: string;
    sizeBytes: number;
    modifiedUtc: string;
}

const support = reactive<{ supported?: boolean }>({});

function httpStatus(e: unknown): number | undefined {
    const err = e as { status?: number; statusCode?: number; response?: { status?: number } };
    return err?.response?.status ?? err?.status ?? err?.statusCode;
}

export function useChapterFiles(mangaId: string) {
    const config = useRuntimeConfig();
    const base = `${config.public.openFetch.api.baseURL}v2/ChapterFiles`;

    const files = ref(new Map<string, ChapterFile>());
    const totalBytes = ref<number>();
    const nextCheck = ref<{ at: Date; intervalHours: number }>();

    async function load() {
        if (support.supported === false) return;
        try {
            const res = await $fetch<{ totalBytes: number; files: ChapterFile[] }>(`${base}/Manga/${encodeURIComponent(mangaId)}`);
            files.value = new Map(res.files.map((f) => [f.chapterId, f]));
            totalBytes.value = res.totalBytes;
            support.supported = true;
        } catch (e) {
            const status = httpStatus(e);
            // 404 with the API's "MangaId" message = manga not found; without = endpoint missing (older API)
            if ((status === 404 && !(e as { data?: unknown }).data) || status === 405) support.supported = false;
        }
        if (support.supported) {
            try {
                const s = await $fetch<{ nextChapterCheckUtc: string; intervalHours: number }>(`${base}/Schedule`);
                nextCheck.value = { at: new Date(s.nextChapterCheckUtc), intervalHours: s.intervalHours };
            } catch {
                /* ignore */
            }
        }
    }

    /** Deletes a chapter's file and stops it being downloaded again */
    async function deleteFile(chapterId: string) {
        await $fetch(`${base}/${encodeURIComponent(chapterId)}`, { method: 'DELETE' });
        await load();
    }

    return { files, totalBytes, nextCheck, supported: computed(() => support.supported), load, deleteFile };
}
