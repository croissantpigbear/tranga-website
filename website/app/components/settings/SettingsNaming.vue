<template>
    <SettingsSection
        title="Naming"
        icon="i-lucide-text-cursor-input"
        description="How series folders and chapter files are named. Komga and Kavita use the folder name as the series name.">
        <!-- Series folders -->
        <div class="flex flex-col gap-2">
            <h3 class="font-medium">Series folders</h3>
            <p v-if="namingSupported === false" class="text-sm text-muted">Series folder naming needs a newer Tranga API.</p>
            <template v-else>
                <div class="flex flex-row flex-wrap gap-1">
                    <UButton
                        v-for="p in seriesPresets"
                        :key="p.scheme"
                        size="xs"
                        :variant="seriesScheme === p.scheme ? 'solid' : 'outline'"
                        :color="seriesScheme === p.scheme ? 'primary' : 'neutral'"
                        @click="seriesScheme = p.scheme">
                        {{ p.label }}
                    </UButton>
                </div>
                <UInput ref="seriesInput" v-model="seriesScheme" class="w-full font-mono" placeholder="%M" />
                <div class="flex flex-row flex-wrap items-center gap-1 text-xs">
                    <span class="text-muted mr-1">Insert:</span>
                    <UTooltip v-for="ph in seriesPlaceholders" :key="ph.code" :text="ph.label">
                        <UButton size="xs" variant="soft" color="neutral" class="font-mono" @click="insert('series', ph.code)">{{ ph.code }}</UButton>
                    </UTooltip>
                    <span class="text-dimmed ml-1">?Y( … ) = only if there's a year</span>
                </div>
                <div class="rounded-md bg-elevated p-2 text-sm flex flex-col gap-0.5">
                    <span class="text-xs text-dimmed">Preview{{ preview?.mangaName ? ` for "${preview.mangaName}"` : '' }}</span>
                    <span v-if="previewLoading" class="text-muted">…</span>
                    <span v-else-if="preview?.seriesFolder" class="font-mono break-all">📁 {{ preview.seriesFolder }}</span>
                    <span v-else class="text-muted">Add a manga to see a preview.</span>
                </div>
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <UButton size="sm" icon="i-lucide-check" :disabled="seriesScheme === savedSeriesScheme" :loading="seriesSave.state.value === 'saving'" @click="saveSeries">
                        Save
                    </UButton>
                    <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-folder-pen" @click="openRename">Rename existing folders…</UButton>
                    <SettingsSaveStatus :state="seriesSave.state.value" :error="seriesSave.error.value" />
                </div>
                <p class="text-xs text-muted">Applies to newly added series. Use "Rename existing folders" for series you already have.</p>
            </template>
        </div>

        <!-- Chapter files -->
        <div class="flex flex-col gap-2">
            <h3 class="font-medium">Chapter files</h3>
            <div class="flex flex-row flex-wrap gap-1">
                <UButton
                    v-for="p in chapterPresets"
                    :key="p.scheme"
                    size="xs"
                    :variant="chapterScheme === p.scheme ? 'solid' : 'outline'"
                    :color="chapterScheme === p.scheme ? 'primary' : 'neutral'"
                    @click="chapterScheme = p.scheme">
                    {{ p.label }}
                </UButton>
            </div>
            <UInput ref="chapterInput" v-model="chapterScheme" class="w-full font-mono" />
            <div class="flex flex-row flex-wrap items-center gap-1 text-xs">
                <span class="text-muted mr-1">Insert:</span>
                <UTooltip v-for="ph in chapterPlaceholders" :key="ph.code" :text="ph.label">
                    <UButton size="xs" variant="soft" color="neutral" class="font-mono" @click="insert('chapter', ph.code)">{{ ph.code }}</UButton>
                </UTooltip>
                <span class="text-dimmed ml-1">?V( … ) = only if there's a volume, ?T( … ) = only if there's a title</span>
            </div>
            <p v-if="chapterScheme && !chapterScheme.includes('%C')" class="text-xs text-warning flex items-start gap-1">
                <UIcon name="i-lucide-triangle-alert" class="size-3.5 mt-px shrink-0" />
                Without %C every chapter would get the same file name.
            </p>
            <div class="rounded-md bg-elevated p-2 text-sm flex flex-col gap-0.5">
                <span class="text-xs text-dimmed">Preview{{ preview?.mangaName ? ` for "${preview.mangaName}"` : '' }}</span>
                <span v-if="previewLoading" class="text-muted">…</span>
                <template v-else-if="preview?.chapterFiles.length">
                    <span v-for="f in preview.chapterFiles" :key="f" class="font-mono break-all">📄 {{ f }}</span>
                </template>
                <span v-else-if="namingSupported === false" class="text-muted">Preview needs a newer Tranga API.</span>
                <span v-else class="text-muted">Add a manga with chapters to see a preview.</span>
            </div>
            <p class="text-xs text-muted">
                Characters outside basic Latin (e.g. Japanese) are removed from file names by Tranga. Applies to new downloads; existing files keep
                their names.
            </p>
            <div class="flex flex-row items-center gap-2">
                <UButton size="sm" icon="i-lucide-check" :disabled="!settings || chapterScheme === settings.chapterNamingScheme" :loading="chapterSave.state.value === 'saving'" @click="saveChapter">
                    Save
                </UButton>
                <UButton
                    v-if="chapterScheme !== DEFAULT_CHAPTER_SCHEME"
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-rotate-ccw"
                    @click="chapterScheme = DEFAULT_CHAPTER_SCHEME">
                    Default
                </UButton>
                <SettingsSaveStatus :state="chapterSave.state.value" :error="chapterSave.error.value" />
            </div>
        </div>

        <!-- Rename existing folders -->
        <UModal v-model:open="renameOpen" title="Rename existing series folders" :ui="{ content: 'max-w-3xl' }" :dismissible="!renaming">
            <template #body>
                <div class="flex flex-col gap-3 text-sm">
                    <p>
                        Using the saved scheme <code class="font-mono bg-elevated px-1 rounded">{{ savedSeriesScheme }}</code
                        >.
                        <span v-if="seriesScheme !== savedSeriesScheme" class="text-warning">Save your changes first to use the new scheme.</span>
                    </p>
                    <UAlert
                        color="warning"
                        variant="subtle"
                        icon="i-lucide-triangle-alert"
                        title="Komga / Kavita"
                        description="Reading servers may treat a renamed folder as a new series, which can lose read progress and custom metadata there." />
                    <USkeleton v-if="planLoading" class="h-24 w-full" />
                    <template v-else-if="plan">
                        <p>
                            <span class="font-medium">{{ toRename.length }}</span> to rename ·
                            <span class="text-muted">{{ plan.filter((p) => p.status === 'same').length }} already named correctly</span>
                            <span v-if="conflicts.length" class="text-warning"> · {{ conflicts.length }} skipped (name already taken)</span>
                        </p>
                        <ul v-if="toRename.length || conflicts.length" class="max-h-72 overflow-y-auto rounded-md bg-elevated p-2 flex flex-col gap-1.5">
                            <li v-for="p in [...toRename, ...conflicts]" :key="p.mangaId" class="flex flex-col">
                                <span class="font-mono text-xs text-muted break-all" :class="p.status === 'rename' && 'line-through'">{{ p.currentFolder }}</span>
                                <span class="font-mono text-xs break-all" :class="p.status === 'conflict' ? 'text-warning' : 'text-success'">
                                    → {{ p.newFolder }}<span v-if="p.status === 'conflict'"> (skipped: already exists)</span>
                                </span>
                            </li>
                        </ul>
                    </template>
                    <p v-if="renameResult" :class="renameResult.skipped.length ? 'text-warning' : 'text-success'">
                        Renamed {{ renameResult.renamed }} folder(s).
                        <span v-for="s in renameResult.skipped" :key="s.mangaId" class="block text-xs">{{ s.name }}: {{ s.reason }}</span>
                    </p>
                </div>
            </template>
            <template #footer>
                <div class="flex flex-row justify-end gap-2 w-full">
                    <UButton variant="outline" color="neutral" :disabled="renaming" @click="renameOpen = false">Close</UButton>
                    <UButton icon="i-lucide-folder-pen" :loading="renaming" :disabled="!toRename.length || !!renameResult" @click="doRename">
                        Rename {{ toRename.length }} folder(s)
                    </UButton>
                </div>
            </template>
        </UModal>
    </SettingsSection>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type TrangaSettings = components['schemas']['TrangaSettings'];

const props = defineProps<{ settings?: TrangaSettings | null }>();
const api = useTrangaApi();

const DEFAULT_CHAPTER_SCHEME = '%M - ?V(Vol.%V )Ch.%C?T( - %T)';
const seriesPresets = [
    { label: 'Title', scheme: '%M' },
    { label: 'English title', scheme: '%E' },
    { label: 'Title (Year)', scheme: '%M?Y( (%Y))' },
    { label: 'English title (Year)', scheme: '%E?Y( (%Y))' },
];
const seriesPlaceholders = [
    { code: '%M', label: 'Title (as Tranga shows it)' },
    { code: '%E', label: 'English title (falls back to the title)' },
    { code: '%Y', label: 'Year' },
    { code: '%A', label: 'First author' },
];
const chapterPresets = [
    { label: 'Series - Vol.1 Ch.5 - Title (default)', scheme: DEFAULT_CHAPTER_SCHEME },
    { label: 'Series - Ch.5', scheme: '%M - Ch.%C' },
    { label: 'Series Vol.1 Ch.5', scheme: '%M ?V(Vol.%V )Ch.%C' },
    { label: 'Ch.5 - Title', scheme: 'Ch.%C?T( - %T)' },
];
const chapterPlaceholders = [
    { code: '%M', label: 'Series title' },
    { code: '%V', label: 'Volume' },
    { code: '%C', label: 'Chapter number' },
    { code: '%T', label: 'Chapter title' },
    { code: '%A', label: 'First author' },
    { code: '%Y', label: 'Year' },
];

// Current values
const namingSupported = ref<boolean>();
const savedSeriesScheme = ref('%M');
const seriesScheme = ref('%M');
const chapterScheme = ref(DEFAULT_CHAPTER_SCHEME);
watch(
    () => props.settings?.chapterNamingScheme,
    (s) => {
        if (s) chapterScheme.value = s;
    },
    { immediate: true }
);
onMounted(async () => {
    try {
        const s = await api.call<string>('v2/Naming/SeriesFolderScheme');
        savedSeriesScheme.value = seriesScheme.value = s || '%M';
        namingSupported.value = true;
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) namingSupported.value = false;
    }
    loadPreview();
});

// Insert a placeholder at the cursor
const seriesInput = ref<{ inputRef?: HTMLInputElement }>();
const chapterInput = ref<{ inputRef?: HTMLInputElement }>();
function insert(which: 'series' | 'chapter', code: string) {
    const target = which === 'series' ? seriesScheme : chapterScheme;
    const el = (which === 'series' ? seriesInput : chapterInput).value?.inputRef;
    const pos = el?.selectionStart ?? target.value.length;
    target.value = target.value.slice(0, pos) + code + target.value.slice(el?.selectionEnd ?? pos);
    nextTick(() => {
        el?.focus();
        el?.setSelectionRange(pos + code.length, pos + code.length);
    });
}

// Live preview (server-side, same formatter as real downloads)
const preview = ref<{ mangaName?: string | null; seriesFolder?: string | null; chapterFiles: string[] }>();
const previewLoading = ref(false);
let previewTimer: ReturnType<typeof setTimeout> | undefined;
async function loadPreview() {
    if (namingSupported.value === false) return;
    previewLoading.value = !preview.value;
    try {
        preview.value = await api.call('v2/Naming/Preview', {
            method: 'POST',
            body: { chapterScheme: chapterScheme.value, seriesScheme: seriesScheme.value },
        });
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) namingSupported.value = false;
    } finally {
        previewLoading.value = false;
    }
}
watch([seriesScheme, chapterScheme], () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(loadPreview, 400);
});

// Save
const seriesSave = useSaveState();
async function saveSeries() {
    const ok = await seriesSave.run(() => api.call('v2/Naming/SeriesFolderScheme', { method: 'PATCH', body: seriesScheme.value }));
    if (ok) savedSeriesScheme.value = seriesScheme.value;
}
const chapterSave = useSaveState();
function saveChapter() {
    chapterSave.run(async () => {
        await api.call('v2/Settings/ChapterNamingScheme', { method: 'PATCH', body: chapterScheme.value });
        await refreshNuxtData(FetchKeys.Settings.All);
    });
}

// Rename existing folders
type PlanItem = { mangaId: string; name: string; currentFolder: string; newFolder: string; status: 'same' | 'rename' | 'conflict' };
const renameOpen = ref(false);
const plan = ref<PlanItem[]>();
const planLoading = ref(false);
const renaming = ref(false);
const renameResult = ref<{ renamed: number; skipped: { mangaId: string; name: string; reason: string }[] }>();
const toRename = computed(() => plan.value?.filter((p) => p.status === 'rename') ?? []);
const conflicts = computed(() => plan.value?.filter((p) => p.status === 'conflict') ?? []);
async function openRename() {
    renameOpen.value = true;
    renameResult.value = undefined;
    planLoading.value = true;
    try {
        plan.value = await api.call<PlanItem[]>('v2/Naming/SeriesFolders/Plan');
    } finally {
        planLoading.value = false;
    }
}
async function doRename() {
    renaming.value = true;
    try {
        renameResult.value = await api.call('v2/Naming/SeriesFolders/Rename', { method: 'POST', body: { mangaIds: null } });
        plan.value = await api.call<PlanItem[]>('v2/Naming/SeriesFolders/Plan');
    } catch (e) {
        renameResult.value = { renamed: 0, skipped: [{ mangaId: '-', name: 'Error', reason: api.messageOf(e) }] };
    } finally {
        renaming.value = false;
    }
}
</script>
