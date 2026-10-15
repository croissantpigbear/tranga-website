<template>
    <UModal v-model:open="open" title="Reader metadata (ComicInfo.xml)" :ui="{ content: 'max-w-3xl' }">
        <template #description>
            Tranga puts a ComicInfo.xml file inside every chapter it downloads. Kavita, Komga and most comic readers use it for the series
            name, writer, genres, age rating, reading direction and more.
        </template>
        <template #body>
            <div class="flex flex-col gap-3">
                <p v-if="supported === false" class="text-sm text-warning">This needs a newer Tranga API (the ComicInfo update).</p>
                <p v-else-if="!files.length" class="text-sm text-muted">No chapters downloaded yet. New downloads get this metadata automatically.</p>
                <template v-else>
                    <UFormField label="Chapter">
                        <USelectMenu v-model="chapterId" :items="chapterItems" value-key="value" class="w-full" />
                    </UFormField>

                    <USkeleton v-if="loading" class="h-48 w-full" />
                    <template v-else-if="preview">
                        <div
                            v-if="preview.inFile === null"
                            class="text-sm rounded-md bg-warning/10 text-warning px-3 py-2 flex items-start gap-2">
                            <UIcon name="i-lucide-triangle-alert" class="size-4 mt-0.5 shrink-0" />
                            This chapter's file has no ComicInfo.xml yet.
                        </div>
                        <div v-else-if="outdated" class="text-sm rounded-md bg-info/10 text-info px-3 py-2 flex items-start gap-2">
                            <UIcon name="i-lucide-info" class="size-4 mt-0.5 shrink-0" />
                            The file has older metadata than shown here. Use "Update all chapters" to write the new version.
                        </div>
                        <div v-else class="text-sm rounded-md bg-success/10 text-success px-3 py-2 flex items-start gap-2">
                            <UIcon name="i-lucide-circle-check" class="size-4 mt-0.5 shrink-0" />
                            The file is up to date.
                        </div>

                        <div class="flex flex-row items-center gap-2">
                            <span class="text-sm font-medium grow">{{ showRaw ? 'Raw XML' : 'What readers will see' }}</span>
                            <USwitch v-model="showRaw" label="Show XML" size="sm" />
                        </div>
                        <pre v-if="showRaw" class="text-xs bg-elevated rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">{{
                            preview.generated
                        }}</pre>
                        <dl v-else class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
                            <template v-for="f in fields" :key="f.name">
                                <dt class="text-muted">{{ f.label }}</dt>
                                <dd :class="['min-w-0 break-words', f.name === 'Summary' && 'line-clamp-4', f.name === 'Web' && 'whitespace-pre-line break-all']">{{ f.value }}</dd>
                            </template>
                        </dl>
                        <p v-if="missing.length" class="text-xs text-muted">
                            Not available for this series: {{ missing.join(', ') }}.
                        </p>
                    </template>
                    <p v-else-if="error" class="text-sm text-error">{{ error }}</p>
                </template>
            </div>
        </template>
        <template #footer>
            <div class="flex flex-row flex-wrap items-center gap-2 w-full">
                <p v-if="queued !== undefined" class="text-sm text-success grow flex items-center gap-1">
                    <UIcon name="i-lucide-circle-check" class="size-4" />
                    Updating {{ queued }} {{ queued === 1 ? 'chapter' : 'chapters' }} in the background. Kavita/Komga are asked to rescan
                    afterwards.
                </p>
                <span v-else class="grow" />
                <UButton variant="outline" color="neutral" @click="open = false">Close</UButton>
                <UButton
                    v-if="files.length && supported !== false"
                    icon="i-lucide-file-pen-line"
                    :loading="writing"
                    :disabled="queued !== undefined"
                    @click="writeAll">
                    Update all {{ files.length }} {{ files.length === 1 ? 'chapter' : 'chapters' }}
                </UButton>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
import type { ChapterFile } from '~/composables/useChapterFiles';

const props = defineProps<{ mangaId: string; files: Map<string, ChapterFile> }>();
const open = defineModel<boolean>('open', { default: false });
const api = useTrangaApi();
const toast = useToast();

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const files = computed(() => [...props.files.values()].sort((a, b) => collator.compare(b.fileName, a.fileName)));
const chapterItems = computed(() => files.value.map((f) => ({ value: f.chapterId, label: f.fileName.replace(/\.cbz$/i, '') })));

const chapterId = ref<string>();
const preview = ref<{ generated: string; inFile: string | null }>();
const loading = ref(false);
const error = ref<string>();
const supported = ref<boolean>();
const showRaw = ref(false);
const queued = ref<number>();
const writing = ref(false);

watch(open, (o) => {
    if (!o) return;
    queued.value = undefined;
    if (!chapterId.value || !props.files.has(chapterId.value)) chapterId.value = files.value[0]?.chapterId;
    else load();
});
watch(chapterId, () => open.value && load());

async function load() {
    if (!chapterId.value) return;
    loading.value = true;
    error.value = undefined;
    try {
        preview.value = await api.call(`v2/ComicInfo/Chapter/${encodeURIComponent(chapterId.value)}`);
        supported.value = true;
    } catch (e) {
        preview.value = undefined;
        if (api.statusOf(e) === 404 && !(e as { data?: unknown }).data) supported.value = false;
        else error.value = api.messageOf(e);
    } finally {
        loading.value = false;
    }
}

/** Element values of a ComicInfo.xml, by tag name */
function parse(xml?: string | null): Map<string, string> {
    const out = new Map<string, string>();
    if (!xml) return out;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const el of Array.from(doc.documentElement?.children ?? [])) out.set(el.tagName, el.textContent ?? '');
    return out;
}

const LABELS: [string, string][] = [
    ['Series', 'Series'],
    ['LocalizedSeries', 'English title'],
    ['Number', 'Chapter'],
    ['Volume', 'Volume'],
    ['Title', 'Chapter title'],
    ['Count', 'Total chapters'],
    ['Year', 'Year'],
    ['Writer', 'Writer'],
    ['Penciller', 'Artist'],
    ['Publisher', 'Publisher'],
    ['Imprint', 'Magazine'],
    ['Genre', 'Genres'],
    ['Tags', 'Tags'],
    ['AgeRating', 'Age rating'],
    ['CommunityRating', 'Rating'],
    ['Manga', 'Reading direction'],
    ['LanguageISO', 'Language'],
    ['BlackAndWhite', 'Black & white'],
    ['PageCount', 'Pages'],
    ['Summary', 'Summary'],
    ['Web', 'Links'],
    ['ScanInformation', 'Downloaded from'],
];
const OPTIONAL_WORTH_MENTIONING = ['Writer', 'Penciller', 'Publisher', 'Genre', 'AgeRating', 'Year'];

function display(name: string, value: string): string {
    if (name === 'Manga') return value === 'YesAndRightToLeft' ? 'Right to left (manga)' : 'Left to right';
    if (name === 'CommunityRating') return `${value} / 5`;
    if (name === 'Count') return `${value} (series finished)`;
    if (name === 'Web') return value.split(',').map((s) => s.trim()).join('\n');
    return value;
}

const generated = computed(() => parse(preview.value?.generated));
const fields = computed(() =>
    LABELS.filter(([name]) => generated.value.get(name)).map(([name, label]) => ({ name, label, value: display(name, generated.value.get(name)!) }))
);
const missing = computed(() =>
    OPTIONAL_WORTH_MENTIONING.filter((n) => !generated.value.get(n)).map((n) => LABELS.find(([k]) => k === n)![1].toLowerCase())
);
const outdated = computed(() => {
    const inFile = parse(preview.value?.inFile);
    for (const [k, v] of generated.value) if ((inFile.get(k) ?? '') !== v) return true;
    return false;
});

async function writeAll() {
    writing.value = true;
    try {
        queued.value = await api.call<number>(`v2/ComicInfo/Rewrite/Manga/${encodeURIComponent(props.mangaId)}`, { method: 'POST' });
    } catch (e) {
        const status = api.statusOf(e);
        toast.add({
            title: "Couldn't update the chapters",
            description: status === 412 ? 'ComicInfo.xml is turned off (CREATE_COMICINFO_XML=false).' : api.messageOf(e),
            color: 'error',
            icon: 'i-lucide-circle-x',
        });
    } finally {
        writing.value = false;
    }
}
</script>
