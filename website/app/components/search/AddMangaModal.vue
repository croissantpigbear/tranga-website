<template>
    <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-xl' }">
        <template #description>Pick where to save it and which site to download from. Downloading starts within a minute.</template>
        <template #body>
            <div class="flex flex-col gap-4">
                <UFormField label="Save to library">
                    <p v-if="libraries && !libraries.length" class="text-sm text-warning">
                        You have no download folders yet.
                        <NuxtLink to="/settings#libraries" class="underline">Add one in Settings</NuxtLink> first.
                    </p>
                    <USelectMenu v-else v-model="libraryId" :items="libraryItems" value-key="value" class="w-full" icon="i-lucide-library-big" />
                </UFormField>

                <UFormField :label="manga.length === 1 ? 'Download from' : 'Download each from'">
                    <div class="flex flex-col gap-2">
                        <div v-for="m in manga" :key="m.key" class="flex flex-row items-center gap-2 rounded-md bg-elevated px-2 py-1.5">
                            <span v-if="manga.length > 1" class="text-sm truncate grow min-w-0" :title="m.name">{{ m.name }}</span>
                            <USelect
                                v-if="m.mangaConnectorIds.length > 1"
                                v-model="sources[m.key]"
                                :items="m.mangaConnectorIds.map((c) => c.mangaConnectorName)"
                                :class="manga.length > 1 ? 'w-44 shrink-0' : 'w-full'" />
                            <span v-else :class="['text-sm', manga.length > 1 ? 'shrink-0 text-muted' : '']">{{ m.mangaConnectorIds[0]?.mangaConnectorName }}</span>
                            <UIcon v-if="results[m.key] === 'ok'" name="i-lucide-circle-check" class="size-4 text-success shrink-0" />
                            <UTooltip v-else-if="results[m.key]" :text="results[m.key]!">
                                <UIcon name="i-lucide-circle-x" class="size-4 text-error shrink-0" />
                            </UTooltip>
                        </div>
                    </div>
                </UFormField>

                <UFormField
                    v-if="manga.length === 1"
                    label="Start from chapter (optional)"
                    description="Chapters before this number won't be downloaded. Handy if you've read the start elsewhere.">
                    <UInputNumber v-model="startFrom" :min="0" :step="1" placeholder="From the first chapter" class="w-48" />
                </UFormField>
            </div>
        </template>
        <template #footer>
            <div class="flex flex-row items-center gap-2 w-full">
                <span v-if="busy" class="text-sm text-muted grow">Adding {{ done }} of {{ manga.length }}…</span>
                <span v-else class="grow" />
                <UButton variant="outline" color="neutral" :disabled="busy" @click="open = false">Cancel</UButton>
                <UButton icon="i-lucide-download" :loading="busy" :disabled="!libraryId" @click="addAll">
                    {{ manga.length === 1 ? 'Add & download' : `Add ${manga.length} & download` }}
                </UButton>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type MinimalManga = components['schemas']['MinimalManga'];

const props = defineProps<{ manga: MinimalManga[] }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ (e: 'added', keys: string[]): void }>();
const { $api } = useNuxtApp();
const api = useTrangaApi();
const toast = useToast();

const LAST_LIBRARY = 'tranga-last-library';
const { data: libraries } = useApi('/v2/FileLibrary', { key: FetchKeys.FileLibraries, server: false });
const libraryItems = computed(() => (libraries.value ?? []).map((l) => ({ value: l.key, label: `${l.libraryName} (${l.basePath})` })));
const libraryId = ref<string>();
const sources = reactive<Record<string, string>>({});
const startFrom = ref<number | null>(null);
const busy = ref(false);
const done = ref(0);
const results = reactive<Record<string, string>>({});

const title = computed(() => (props.manga.length === 1 ? `Add “${props.manga[0]?.name}”` : `Add ${props.manga.length} manga`));

function preferredLibrary(): string | undefined {
    let last: string | null = null;
    try {
        last = localStorage.getItem(LAST_LIBRARY);
    } catch {
        /* ignore */
    }
    const libs = libraries.value ?? [];
    return libs.find((l) => l.key === last)?.key ?? libs[0]?.key;
}

watch(open, (o) => {
    if (!o) return;
    startFrom.value = null;
    done.value = 0;
    for (const k of Object.keys(results)) delete results[k];
    if (!libraryId.value) libraryId.value = preferredLibrary();
    for (const m of props.manga) if (!sources[m.key]) sources[m.key] = m.mangaConnectorIds[0]?.mangaConnectorName ?? '';
});
watch(libraries, () => {
    if (!libraryId.value) libraryId.value = preferredLibrary();
});

async function addOne(m: MinimalManga) {
    await $api('/v2/Manga/{MangaId}/ChangeLibrary/{LibraryId}', { method: 'POST', path: { MangaId: m.key, LibraryId: libraryId.value! } });
    if (props.manga.length === 1 && startFrom.value != null && startFrom.value > 0)
        await api.call(`v2/Chapters/IgnoreBefore/${encodeURIComponent(m.key)}`, { method: 'PATCH', body: startFrom.value });
    const source = sources[m.key] || m.mangaConnectorIds[0]?.mangaConnectorName;
    if (!source) throw new Error('No site to download from');
    await $api('/v2/Manga/{MangaId}/DownloadFrom/{MangaConnectorName}/{IsRequested}', {
        method: 'PATCH',
        path: { MangaId: m.key, MangaConnectorName: source, IsRequested: true },
    });
}

async function addAll() {
    if (!libraryId.value) return;
    try {
        localStorage.setItem(LAST_LIBRARY, libraryId.value);
    } catch {
        /* ignore */
    }
    busy.value = true;
    done.value = 0;
    const added: string[] = [];
    // One at a time, so the API isn't flooded
    for (const m of props.manga) {
        try {
            await addOne(m);
            results[m.key] = 'ok';
            added.push(m.key);
        } catch (e) {
            results[m.key] = api.messageOf(e);
        }
        done.value++;
    }
    busy.value = false;
    await refreshNuxtData(FetchKeys.Manga.All);
    if (added.length) emit('added', added);
    const failed = props.manga.length - added.length;
    if (failed === 0) {
        toast.add({
            title: added.length === 1 ? `Added ${props.manga[0]!.name}` : `Added ${added.length} manga`,
            description: 'Chapters will start downloading within a minute.',
            color: 'success',
            icon: 'i-lucide-check',
        });
        open.value = false;
    } else {
        toast.add({ title: `Couldn't add ${failed} of ${props.manga.length}`, description: 'Hover the red icons for the reason.', color: 'error', icon: 'i-lucide-circle-x' });
    }
}
</script>
