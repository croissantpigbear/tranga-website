<template>
    <SettingsSection
        title="Libraries"
        icon="i-lucide-library-big"
        description="Where downloaded chapters are saved, and the reading servers (Komga / Kavita) Tranga tells about new chapters.">
        <!-- File libraries -->
        <div class="flex flex-col gap-2">
            <h3 class="font-medium">Download folders</h3>
            <div v-for="l in fileLibraries" :key="l.key" class="rounded-lg bg-elevated p-3 flex flex-col gap-2">
                <template v-if="editing !== l.key">
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <UIcon name="i-lucide-folder" class="size-5 text-primary shrink-0" />
                        <div class="grow min-w-0">
                            <p class="font-medium">{{ l.libraryName }}</p>
                            <p class="text-sm text-muted break-all">{{ l.basePath }}</p>
                        </div>
                        <UTooltip text="Add series folders that are already in this folder to Tranga, without downloading them again">
                            <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-folder-input" :to="`/import?library=${l.key}&return=/settings%23libraries`">
                                Import existing
                            </UButton>
                        </UTooltip>
                        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-pencil" @click="startEdit(l)">Edit</UButton>
                        <UButton size="sm" variant="soft" color="error" icon="i-lucide-trash-2" @click="askDelete(l)">Delete</UButton>
                    </div>
                </template>
                <template v-else>
                    <div class="grid grid-cols-1 min-md:grid-cols-2 gap-2">
                        <UFormField label="Name"><UInput v-model="editName" class="w-full" /></UFormField>
                        <UFormField label="Folder (inside the Tranga container)"><UInput v-model="editPath" class="w-full" /></UFormField>
                    </div>
                    <p class="text-xs text-warning flex items-start gap-1">
                        <UIcon name="i-lucide-triangle-alert" class="size-3.5 mt-px shrink-0" />
                        Changing the folder only tells Tranga where to look — nothing is moved. Move the files yourself (or change the
                        Docker volume) first, or Tranga will think chapters are missing and download them again.
                    </p>
                    <div class="flex flex-row items-center gap-2">
                        <UButton size="sm" icon="i-lucide-check" :loading="save.state.value === 'saving'" @click="saveEdit(l.key)">Save</UButton>
                        <UButton size="sm" variant="outline" color="neutral" @click="editing = undefined">Cancel</UButton>
                        <SettingsSaveStatus :state="save.state.value" :error="save.error.value" />
                    </div>
                </template>
            </div>
            <div>
                <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="emit('addLibrary')">Add download folder</UButton>
            </div>
        </div>

        <!-- Library servers -->
        <div class="flex flex-col gap-2">
            <h3 class="font-medium">Reading servers</h3>
            <p class="text-xs text-muted -mt-1">Tranga asks these to rescan when new chapters arrive.</p>
            <div v-for="c in connectors" :key="c.key" class="rounded-lg bg-elevated p-3 flex flex-col gap-1.5">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <UIcon name="i-lucide-server" class="size-5 text-secondary shrink-0" />
                    <div class="grow min-w-0">
                        <p class="font-medium">{{ c.type }}</p>
                        <p class="text-sm text-muted break-all">{{ c.baseUrl }}</p>
                    </div>
                    <UButton
                        v-if="testsSupported !== false"
                        size="sm"
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-plug-zap"
                        :loading="testing === c.key"
                        @click="testConnector(c.key)">
                        Test
                    </UButton>
                    <UButton size="sm" variant="soft" color="error" icon="i-lucide-unlink" @click="askRemove(c)">Remove</UButton>
                </div>
                <p v-if="testResults[c.key]" :class="['text-xs flex items-start gap-1', testResults[c.key]!.ok ? 'text-success' : 'text-error']">
                    <UIcon :name="testResults[c.key]!.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-3.5 mt-px shrink-0" />
                    {{ testResults[c.key]!.message }}
                </p>
            </div>
            <SettingsKavitaCovers ref="kavitaCovers" />
            <div class="flex flex-row flex-wrap gap-2">
                <UButton v-if="!hasType('Komga')" size="sm" variant="soft" icon="i-lucide-link" @click="emit('connect', 'Komga')">Connect Komga</UButton>
                <UButton v-if="!hasType('Kavita')" size="sm" variant="soft" icon="i-lucide-link" @click="emit('connect', 'Kavita')">Connect Kavita</UButton>
            </div>
        </div>

        <!-- Refresh timing -->
        <div v-if="settings" class="flex flex-col gap-2">
            <h3 class="font-medium">When to ask reading servers to rescan</h3>
            <URadioGroup v-model="refreshSetting" :items="refreshItems" @update:model-value="saveRefresh" />
            <div v-if="refreshSetting === 'WhileDownloading'" class="flex flex-row items-center gap-2 text-sm">
                <span>Every</span>
                <UInputNumber v-model="refreshMinutes" :min="1" :max="1440" class="w-28" @update:model-value="saveRefreshDebounced" />
                <span>minutes while downloading</span>
            </div>
            <SettingsSaveStatus :state="refreshSave.state.value" :error="refreshSave.error.value" />
        </div>

        <ConfirmDialog v-model:open="confirmOpen" :title="confirm.title" :confirm-label="confirm.label" :action="confirm.action">
            <p>{{ confirm.text }}</p>
        </ConfirmDialog>
    </SettingsSection>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type FileLibrary = components['schemas']['FileLibrary'];
type LibraryConnector = components['schemas']['LibraryConnector'];
type TrangaSettings = components['schemas']['TrangaSettings'];

const props = defineProps<{ settings?: TrangaSettings | null }>();
const emit = defineEmits<{ (e: 'addLibrary'): void; (e: 'connect', type: 'Komga' | 'Kavita'): void }>();
const { $api } = useNuxtApp();
const api = useTrangaApi();

const { data: fileLibraries } = useApi('/v2/FileLibrary', { key: FetchKeys.FileLibraries, server: false });
const { data: connectors } = useApi('/v2/LibraryConnector', { key: FetchKeys.Libraries.All, server: false });
const hasType = (t: string) => !!connectors.value?.some((c) => c.type === t);
const kavitaCovers = ref<{ reload: () => void }>();
watch(connectors, () => kavitaCovers.value?.reload());

// Edit a download folder
const editing = ref<string>();
const editName = ref('');
const editPath = ref('');
const save = useSaveState();
function startEdit(l: FileLibrary) {
    editing.value = l.key;
    editName.value = l.libraryName;
    editPath.value = l.basePath;
}
async function saveEdit(key: string) {
    const ok = await save.run(() => api.call(`v2/FileLibrary/${encodeURIComponent(key)}`, { method: 'PATCH', body: { path: editPath.value, name: editName.value } }));
    if (ok) {
        await refreshNuxtData(FetchKeys.FileLibraries);
        editing.value = undefined;
    }
}

// Confirmations
const confirmOpen = ref(false);
const confirm = reactive({ title: '', label: '', text: '', action: (() => Promise.resolve()) as () => Promise<unknown> });
function askDelete(l: FileLibrary) {
    Object.assign(confirm, {
        title: `Delete "${l.libraryName}"?`,
        label: 'Delete',
        text: `Tranga will stop using ${l.basePath}. The files in it are not deleted. Manga in this library will need another library to download into.`,
        action: async () => {
            await $api('/v2/FileLibrary/{FileLibraryId}', { path: { FileLibraryId: l.key }, method: 'DELETE' });
            await refreshNuxtData(FetchKeys.FileLibraries);
        },
    });
    confirmOpen.value = true;
}
function askRemove(c: LibraryConnector) {
    Object.assign(confirm, {
        title: `Disconnect ${c.type}?`,
        label: 'Disconnect',
        text: `Tranga will stop asking ${c.type} (${c.baseUrl}) to rescan. Nothing in ${c.type} is changed.`,
        action: async () => {
            await $api('/v2/LibraryConnector/{LibraryConnectorId}', { method: 'DELETE', path: { LibraryConnectorId: c.key } });
            await refreshNuxtData(FetchKeys.Libraries.All);
        },
    });
    confirmOpen.value = true;
}

// Connection test (newer API)
const testsSupported = ref<boolean>();
const testing = ref<string>();
const testResults = reactive<Record<string, { ok: boolean; message: string }>>({});
async function testConnector(key: string) {
    testing.value = key;
    try {
        testResults[key] = await api.call<{ ok: boolean; message: string }>(`v2/ConnectionTests/LibraryConnector/${encodeURIComponent(key)}`, { method: 'POST' });
        testsSupported.value = true;
    } catch (e) {
        if (api.statusOf(e) === 404 && !(e as { data?: unknown }).data) {
            testsSupported.value = false;
            testResults[key] = { ok: false, message: 'Testing needs a newer Tranga API.' };
        } else testResults[key] = { ok: false, message: api.messageOf(e) };
    } finally {
        testing.value = undefined;
    }
}

// Rescan timing
const refreshItems = [
    { value: 'AfterEveryChapter', label: 'After every chapter', description: 'New chapters show up fastest; most rescans.' },
    { value: 'AfterMangaFinished', label: 'After each manga finishes downloading', description: 'Recommended.' },
    { value: 'AfterAllFinished', label: 'After all downloads finish', description: 'Fewest rescans.' },
    { value: 'WhileDownloading', label: 'Every few minutes while downloading', description: 'For long download runs.' },
];
const refreshSetting = ref<string>();
const refreshMinutes = ref<number>(10);
watch(
    () => props.settings,
    (s) => {
        if (!s) return;
        refreshSetting.value = s.libraryRefreshSetting;
        refreshMinutes.value = s.refreshLibraryWhileDownloadingEveryMinutes ?? 10;
    },
    { immediate: true }
);
const refreshSave = useSaveState();
function saveRefresh() {
    refreshSave.run(async () => {
        await api.call('v2/Settings/LibraryRefresh', {
            method: 'PATCH',
            body: { setting: refreshSetting.value, refreshLibraryWhileDownloadingEveryMinutes: refreshMinutes.value },
        });
        await refreshNuxtData(FetchKeys.Settings.All);
    });
}
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function saveRefreshDebounced() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(saveRefresh, 600);
}
</script>
