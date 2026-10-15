<template>
    <SettingsSection
        title="Performance"
        icon="i-lucide-gauge"
        description="How much Tranga does at the same time. Pick the profile that matches the machine Tranga runs on.">
        <p v-if="limits === null" class="text-sm text-warning">These settings need a newer Tranga API (the download limits update).</p>
        <USkeleton v-else-if="!limits" class="h-40 w-full" />
        <template v-else>
            <p class="text-sm text-muted flex flex-row flex-wrap items-center gap-x-1">
                <UIcon name="i-lucide-cpu" class="size-4" />
                Tranga sees <span class="text-default">{{ limits.processorCount }} CPU cores</span> and
                <span class="text-default">{{ formatBytes(limits.totalMemoryBytes) }}</span> of memory ({{ limits.architecture }}).
                <UTooltip text="With Docker Desktop this is what Docker is allowed to use (Docker Desktop → Settings → Resources), not the whole computer.">
                    <UIcon name="i-lucide-info" class="size-3.5" />
                </UTooltip>
            </p>

            <!-- Profiles -->
            <div class="grid grid-cols-1 min-md:grid-cols-2 min-xl:grid-cols-4 gap-2">
                <button
                    v-for="p in PROFILES"
                    :key="p.id"
                    type="button"
                    :disabled="saving"
                    :class="[
                        'relative text-left rounded-lg border p-3 flex flex-col gap-1 transition-colors',
                        activeProfile === p.id ? 'border-primary bg-primary/10' : 'border-default hover:bg-elevated',
                    ]"
                    @click="applyProfile(p.id)">
                    <div class="flex flex-row items-center gap-2">
                        <UIcon :name="p.icon" class="size-5 text-primary shrink-0" />
                        <span class="font-medium grow">{{ p.label }}</span>
                        <UIcon v-if="activeProfile === p.id" name="i-lucide-circle-check" class="size-4 text-primary" />
                    </div>
                    <p class="text-xs text-muted">{{ p.hardware }}</p>
                    <p v-if="p.values" class="text-xs">
                        {{ p.values.workers }} jobs · {{ p.values.downloads }} downloads · {{ p.values.perSource }} per site
                    </p>
                    <p v-else class="text-xs">Set the numbers yourself.</p>
                    <UBadge v-if="p.id === recommended" size="sm" variant="subtle" color="success" class="absolute -top-2 right-2">
                        Recommended here
                    </UBadge>
                </button>
            </div>

            <!-- Numbers -->
            <div class="grid grid-cols-1 min-md:grid-cols-3 gap-3">
                <UFormField label="Jobs at once" description="Everything Tranga does: downloads, chapter checks, covers, metadata.">
                    <UInputNumber v-model="workers" :min="2" :max="64" class="w-32" @update:model-value="custom" />
                </UFormField>
                <UFormField label="Downloads at once" description="Chapters downloading at the same time, all sites together.">
                    <UInputNumber v-model="downloads" :min="1" :max="20" class="w-32" @update:model-value="custom" />
                </UFormField>
                <UFormField label="Downloads per site" description="Keeps any one site from being overloaded (or blocking you).">
                    <UInputNumber v-model="perSource" :min="1" :max="10" class="w-32" @update:model-value="custom" />
                </UFormField>
            </div>
            <p v-if="problem || warning" :class="['text-sm flex items-start gap-1', problem ? 'text-error' : 'text-warning']">
                <UIcon name="i-lucide-triangle-alert" class="size-4 mt-0.5 shrink-0" />{{ problem ?? warning }}
            </p>
            <div class="flex flex-row flex-wrap items-center gap-2">
                <UButton v-if="dirty" size="sm" icon="i-lucide-check" :loading="saving" :disabled="!!problem" @click="save()">Save</UButton>
                <UButton v-if="dirty" size="sm" variant="outline" color="neutral" :disabled="saving" @click="reset">Cancel</UButton>
                <SettingsSaveStatus :state="saveState.state.value" :error="saveState.error.value" />
            </div>

            <p class="text-xs text-muted">
                Now: {{ limits.runningWorkers }} of {{ limits.maxConcurrentWorkers }} jobs running<template v-if="downloadingNow.length"
                    >; downloading from
                    <span v-for="(d, i) in downloadingNow" :key="d.source">{{ i > 0 ? ', ' : '' }}{{ d.source }} ({{ d.count }})</span></template
                >. All sites together are also limited to {{ limits.requestsPerMinute }} requests a minute
                (<code>REQUESTS_PER_MINUTE</code>), whatever you pick here. Changes apply within a minute; running jobs aren't stopped.
            </p>
        </template>
    </SettingsSection>
</template>

<script setup lang="ts">
interface Limits {
    maxConcurrentDownloads: number;
    maxConcurrentDownloadsPerConnector: number;
    maxConcurrentWorkers?: number;
    runningWorkers?: number;
    requestsPerMinute: number;
    processorCount: number;
    totalMemoryBytes?: number;
    architecture?: string;
    downloading: Record<string, number>;
}
interface Values {
    workers: number;
    downloads: number;
    perSource: number;
}
type ProfileId = 'pi' | 'low' | 'high' | 'custom';

const PROFILES: { id: ProfileId; label: string; icon: string; hardware: string; values?: Values }[] = [
    {
        id: 'pi',
        label: 'Raspberry Pi / NAS',
        icon: 'i-lucide-cpu',
        hardware: 'Raspberry Pi 4/5, small NAS — about 4 cores, 2–4 GB memory.',
        values: { workers: 4, downloads: 2, perSource: 1 },
    },
    {
        id: 'low',
        label: 'Low-end desktop',
        icon: 'i-lucide-monitor',
        hardware: 'Older PC, mini PC or laptop — 4–6 cores, around 8 GB.',
        values: { workers: 6, downloads: 3, perSource: 2 },
    },
    {
        id: 'high',
        label: 'High-end desktop / server',
        icon: 'i-lucide-server',
        hardware: 'Modern desktop or home server — 8+ cores, 16 GB or more.',
        values: { workers: 12, downloads: 6, perSource: 2 },
    },
    { id: 'custom', label: 'Custom', icon: 'i-lucide-sliders-horizontal', hardware: 'Your own numbers.' },
];

const api = useTrangaApi();
/** undefined = loading, null = older API */
const limits = ref<Limits | null>();
const workers = ref(4);
const downloads = ref(2);
const perSource = ref(2);
const chosen = ref<ProfileId>();
const saving = ref(false);
const saveState = useSaveState();

const GB = 1024 ** 3;
const recommended = computed<ProfileId | undefined>(() => {
    const l = limits.value;
    if (!l) return undefined;
    const mem = l.totalMemoryBytes ?? 0;
    if (l.processorCount <= 4 || (mem && mem < 6 * GB)) return 'pi';
    if (l.processorCount <= 6 || (mem && mem < 12 * GB)) return 'low';
    return 'high';
});

const matches = (v: Values) => v.workers === workers.value && v.downloads === downloads.value && v.perSource === perSource.value;
const activeProfile = computed<ProfileId>(() => chosen.value ?? PROFILES.find((p) => p.values && matches(p.values))?.id ?? 'custom');

const dirty = computed(
    () =>
        !!limits.value &&
        (workers.value !== (limits.value.maxConcurrentWorkers ?? workers.value) ||
            downloads.value !== limits.value.maxConcurrentDownloads ||
            perSource.value !== limits.value.maxConcurrentDownloadsPerConnector)
);
/** Values the API would refuse (blocks Save) */
const problem = computed(() => {
    if (workers.value < downloads.value + 2)
        return `"Jobs at once" needs to be at least ${downloads.value + 2} (downloads + 2), so chapter checks and covers can still run while downloading.`;
    if (perSource.value > downloads.value) return `"Downloads per site" can't be more than "Downloads at once" (${downloads.value}).`;
    return undefined;
});
/** Allowed, but probably a bad idea */
const warning = computed(() =>
    limits.value && workers.value > limits.value.processorCount * 4
        ? `${workers.value} jobs is a lot for ${limits.value.processorCount} cores; Tranga may get sluggish.`
        : undefined
);

function take(l: Limits) {
    limits.value = l;
    workers.value = l.maxConcurrentWorkers ?? workers.value;
    downloads.value = l.maxConcurrentDownloads;
    perSource.value = l.maxConcurrentDownloadsPerConnector;
    chosen.value = undefined;
}

let poll: ReturnType<typeof setTimeout> | undefined;
async function load(applyValues = true) {
    clearTimeout(poll);
    try {
        const l = await api.call<Limits>('v2/DownloadLimits');
        if (applyValues && !dirty.value) take(l);
        else if (limits.value) Object.assign(limits.value, { runningWorkers: l.runningWorkers, downloading: l.downloading });
        poll = setTimeout(() => load(false), 10000);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) limits.value = null;
    }
}
onMounted(() => load());
onBeforeUnmount(() => clearTimeout(poll));

const custom = () => (chosen.value = 'custom');
function reset() {
    if (limits.value) take(limits.value);
}
function applyProfile(id: ProfileId) {
    const p = PROFILES.find((x) => x.id === id);
    chosen.value = id;
    if (!p?.values) return; // custom: just edit the numbers
    workers.value = p.values.workers;
    downloads.value = p.values.downloads;
    perSource.value = p.values.perSource;
    save();
}

async function save() {
    if (problem.value) return;
    saving.value = true;
    const ok = await saveState.run(async () => {
        const l = await api.call<Limits>('v2/DownloadLimits', {
            method: 'PATCH',
            body: {
                maxConcurrentWorkers: workers.value,
                maxConcurrentDownloads: downloads.value,
                maxConcurrentDownloadsPerConnector: Math.min(perSource.value, downloads.value),
            },
        });
        const keep = chosen.value;
        take(l);
        chosen.value = keep === 'custom' ? undefined : keep;
    });
    saving.value = false;
    if (!ok) load();
}

const downloadingNow = computed(() =>
    Object.entries(limits.value?.downloading ?? {})
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
);
</script>
