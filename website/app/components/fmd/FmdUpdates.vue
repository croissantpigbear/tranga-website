<template>
    <section v-if="data" class="rounded-lg border border-default p-4 flex flex-col gap-3">
        <div class="flex flex-row flex-wrap items-center gap-2">
            <UIcon name="i-lucide-refresh-cw" class="size-5 text-primary" />
            <h2 class="font-semibold grow">
                Updates from FMD2
                <UBadge v-if="available.length" size="sm" variant="subtle" color="primary" class="ml-1">{{ available.length }} available</UBadge>
            </h2>
            <UButton size="sm" variant="soft" color="neutral" icon="i-lucide-search-check" :loading="busy === 'check'" @click="check">Check now</UButton>
            <UButton v-if="available.length > 1" size="sm" icon="i-lucide-download" :loading="busy === 'all'" @click="updateAll">
                Update all
            </UButton>
        </div>
        <p class="text-sm text-muted">
            Website modules break when sites change, and FMD2's volunteers fix them often. Tranga compares your files with FMD2 on GitHub
            once a day<template v-if="data.lastCheckUtc"> (last checked {{ relative(data.lastCheckUtc) }})</template>.
        </p>
        <p v-if="data.lastError" class="text-sm text-error flex items-start gap-1">
            <UIcon name="i-lucide-circle-x" class="size-4 mt-0.5 shrink-0" />Couldn't check: {{ data.lastError }}
        </p>
        <USwitch
            :model-value="data.autoUpdate"
            :loading="busy === 'settings'"
            label="Install updates automatically"
            description="After the daily check. The previous version is kept, and put back if the new one doesn't load."
            @update:model-value="setAuto" />

        <p v-if="!data.lastCheckUtc" class="text-sm text-muted">Not checked yet.</p>
        <p v-else-if="!available.length && !data.lastError" class="text-sm text-success flex items-center gap-1">
            <UIcon name="i-lucide-circle-check" class="size-4" />All your files match FMD2's current versions.
        </p>
        <ul v-if="available.length || undoable.length" class="flex flex-col divide-y divide-default rounded-md border border-default">
            <li v-for="f in [...available, ...undoable]" :key="`${f.kind}/${f.fileName}`" class="p-2.5 flex flex-row flex-wrap items-center gap-2">
                <UIcon name="i-lucide-file-code" class="size-4 text-muted" />
                <span class="font-mono text-sm">{{ f.fileName }}</span>
                <UBadge size="sm" variant="soft" color="neutral">{{ f.kind }}</UBadge>
                <UBadge v-if="f.status === 'updateAvailable'" size="sm" variant="subtle" color="primary">Newer version</UBadge>
                <span v-else-if="f.updatedUtc" class="text-xs text-dimmed">updated {{ relative(f.updatedUtc) }}</span>
                <span class="grow" />
                <UButton
                    v-if="f.canUndo"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-undo-2"
                    :loading="busy === `undo:${f.kind}/${f.fileName}`"
                    @click="undo(f)">
                    Undo last update
                </UButton>
                <UButton
                    v-if="f.status === 'updateAvailable'"
                    size="xs"
                    icon="i-lucide-download"
                    :loading="busy === `${f.kind}/${f.fileName}`"
                    @click="update(f)">
                    Update
                </UButton>
                <p v-if="f.status === 'updateAvailable' && (f.remoteChangedUtc || f.remoteChangeMessage)" class="basis-full text-xs text-muted pl-6">
                    Changed in FMD2 <template v-if="f.remoteChangedUtc">{{ formatDate(f.remoteChangedUtc) }}</template
                    ><template v-if="f.remoteChangeMessage">: “{{ f.remoteChangeMessage }}”</template>
                </p>
            </li>
        </ul>
        <p v-if="notInFmd2.length" class="text-xs text-dimmed">
            Not found in FMD2 (renamed there, or your own): {{ notInFmd2.map((f) => f.fileName).join(', ') }}
        </p>
    </section>
</template>

<script setup lang="ts">
export interface LuaFileUpdate {
    kind: 'module' | 'template' | 'helper';
    fileName: string;
    status: 'upToDate' | 'updateAvailable' | 'notInFmd2';
    remoteChangedUtc?: string | null;
    remoteChangeMessage?: string | null;
    canUndo: boolean;
    updatedUtc?: string | null;
}
export interface LuaUpdates {
    repository: string;
    branch: string;
    autoUpdate: boolean;
    lastCheckUtc?: string | null;
    lastError?: string | null;
    files: LuaFileUpdate[];
}
interface UpdateResult {
    fileName: string;
    ok: boolean;
    message: string;
}

const emit = defineEmits<{ (e: 'loaded', data: LuaUpdates): void; (e: 'installed'): void }>();
const api = useTrangaApi();
const toast = useToast();
const data = ref<LuaUpdates>();
const busy = ref<string>();

const available = computed(() => (data.value?.files ?? []).filter((f) => f.status === 'updateAvailable'));
const undoable = computed(() => (data.value?.files ?? []).filter((f) => f.status !== 'updateAvailable' && f.canUndo));
const notInFmd2 = computed(() => (data.value?.files ?? []).filter((f) => f.status === 'notInFmd2'));

function take(d: LuaUpdates) {
    data.value = d;
    emit('loaded', d);
}

async function load() {
    try {
        take(await api.call<LuaUpdates>('v2/LuaModules/Updates'));
    } catch {
        data.value = undefined; // older API: section hidden
    }
}
onMounted(load);
defineExpose({ reload: load });

async function check() {
    busy.value = 'check';
    try {
        take(await api.call<LuaUpdates>('v2/LuaModules/Updates/Check', { method: 'POST' }));
    } catch (e) {
        toast.add({ title: "Couldn't check", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        busy.value = undefined;
    }
}

async function setAuto(value: boolean) {
    busy.value = 'settings';
    try {
        take(await api.call<LuaUpdates>('v2/LuaModules/Updates', { method: 'PATCH', body: { autoUpdate: value } }));
    } catch (e) {
        toast.add({ title: "Couldn't save", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        busy.value = undefined;
    }
}

function report(results: UpdateResult[]) {
    for (const r of results)
        toast.add({
            title: r.ok ? `${r.fileName} updated` : `${r.fileName} not updated`,
            description: r.ok ? undefined : r.message,
            color: r.ok ? 'success' : 'error',
            icon: r.ok ? 'i-lucide-check' : 'i-lucide-circle-x',
        });
}

const path = (f: LuaFileUpdate) => `${f.kind}/${encodeURIComponent(f.fileName)}`;

async function update(f: LuaFileUpdate) {
    busy.value = `${f.kind}/${f.fileName}`;
    try {
        report([await api.call<UpdateResult>(`v2/LuaModules/Updates/${path(f)}`, { method: 'POST' })]);
        emit('installed');
    } catch (e) {
        toast.add({ title: "Couldn't update", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        busy.value = undefined;
        load();
    }
}

async function updateAll() {
    busy.value = 'all';
    try {
        report(await api.call<UpdateResult[]>('v2/LuaModules/Updates/All', { method: 'POST' }));
        emit('installed');
    } catch (e) {
        toast.add({ title: "Couldn't update", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        busy.value = undefined;
        load();
    }
}

async function undo(f: LuaFileUpdate) {
    busy.value = `undo:${f.kind}/${f.fileName}`;
    try {
        report([await api.call<UpdateResult>(`v2/LuaModules/Updates/${path(f)}/Undo`, { method: 'POST' })]);
        emit('installed');
    } catch (e) {
        toast.add({ title: "Couldn't undo", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        busy.value = undefined;
        load();
    }
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relative(iso: string): string {
    const minutes = (Date.now() - new Date(iso).getTime()) / 60e3;
    if (minutes < 1) return 'just now';
    if (minutes < 60) return rtf.format(-Math.round(minutes), 'minute');
    if (minutes < 48 * 60) return rtf.format(-Math.round(minutes / 60), 'hour');
    return rtf.format(-Math.round(minutes / 1440), 'day');
}
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
</script>
