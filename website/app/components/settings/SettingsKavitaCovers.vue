<template>
    <div v-if="status && status.kavitaConnected" class="rounded-lg bg-elevated p-3 flex flex-col gap-3">
        <div class="flex flex-row flex-wrap items-center gap-2">
            <UIcon name="i-lucide-image" class="size-5 text-secondary shrink-0" />
            <div class="grow min-w-0">
                <p class="font-medium">Kavita covers</p>
                <p class="text-xs text-muted">
                    Sets each series' cover in Kavita to the cover Tranga downloaded, instead of the first page. Happens once Kavita has
                    scanned the first downloaded chapter (checked every 15 minutes).
                </p>
            </div>
        </div>
        <div class="flex flex-row flex-wrap items-center gap-x-6 gap-y-2">
            <USwitch v-model="enabled" label="Send covers automatically" @update:model-value="saveSettings" />
            <UTooltip text="Kavita won't replace a locked cover when it rescans. Unlock it in Kavita (or turn this off) to let Kavita pick again.">
                <USwitch v-model="lockCover" label="Lock covers in Kavita" @update:model-value="saveSettings" />
            </UTooltip>
            <SettingsSaveStatus :state="save.state.value" :error="save.error.value" />
        </div>
        <div class="flex flex-row flex-wrap items-center gap-2 text-sm">
            <span>
                <span class="font-medium">{{ status.sent }}</span> sent<template v-if="status.waiting">,
                    <span class="font-medium">{{ status.waiting }}</span> waiting for Kavita</template
                >.
            </span>
            <span v-if="status.lastRunUtc" class="text-xs text-muted">Last checked {{ relative(status.lastRunUtc) }}.</span>
            <span class="grow" />
            <UButton size="sm" variant="soft" icon="i-lucide-send" :loading="pushing === 'missing' || status.running" @click="push(false)">
                Send missing now
            </UButton>
            <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-refresh-cw" :loading="pushing === 'all'" @click="push(true)">
                Re-send all
            </UButton>
        </div>
        <details v-if="status.recent.length" class="text-xs">
            <summary class="cursor-pointer text-muted">Recent results</summary>
            <ul class="mt-2 flex flex-col gap-1">
                <li v-for="r in status.recent" :key="r.mangaId" class="flex flex-row items-start gap-2">
                    <UIcon :name="ICONS[r.status]?.icon ?? 'i-lucide-circle'" :class="['size-4 shrink-0', ICONS[r.status]?.class]" />
                    <span class="min-w-0">
                        <NuxtLink :to="`/manga/${r.mangaId}`" class="font-medium hover:underline">{{ r.mangaName }}</NuxtLink>
                        <span class="text-muted"> — {{ r.message }}</span>
                    </span>
                </li>
            </ul>
        </details>
    </div>
</template>

<script setup lang="ts">
interface Status {
    kavitaConnected: boolean;
    enabled: boolean;
    lockCover: boolean;
    sent: number;
    waiting: number;
    running: boolean;
    lastRunUtc?: string | null;
    recent: { mangaId: string; mangaName: string; status: string; message: string; atUtc: string }[];
}
const ICONS: Record<string, { icon: string; class: string }> = {
    set: { icon: 'i-lucide-circle-check', class: 'text-success' },
    notInKavita: { icon: 'i-lucide-clock', class: 'text-muted' },
    noCover: { icon: 'i-lucide-image-off', class: 'text-warning' },
    failed: { icon: 'i-lucide-circle-x', class: 'text-error' },
};

const api = useTrangaApi();
const toast = useToast();
const status = ref<Status | null>();
const enabled = ref(true);
const lockCover = ref(true);
const pushing = ref<'missing' | 'all'>();
const save = useSaveState();

let timer: ReturnType<typeof setTimeout> | undefined;
async function load(applySettings = true) {
    clearTimeout(timer);
    try {
        status.value = await api.call<Status>('v2/KavitaCovers');
        if (applySettings) {
            enabled.value = status.value.enabled;
            lockCover.value = status.value.lockCover;
        }
        // Poll quickly while sending, slowly otherwise
        timer = setTimeout(() => load(false), status.value.running || pushing.value ? 3000 : 30000);
    } catch {
        status.value = null; // older API: hide
    }
}
onMounted(() => load());
onBeforeUnmount(() => clearTimeout(timer));
defineExpose({ reload: () => load() });

function saveSettings() {
    save.run(() => api.call('v2/KavitaCovers', { method: 'PATCH', body: { enabled: enabled.value, lockCover: lockCover.value } }));
}

async function push(all: boolean) {
    pushing.value = all ? 'all' : 'missing';
    try {
        await api.call('v2/KavitaCovers/Push', { method: 'POST', query: all ? { force: 'true' } : undefined });
        toast.add({ title: 'Sending covers to Kavita', description: 'Results appear below in a moment.', color: 'success', icon: 'i-lucide-send' });
        setTimeout(() => load(false), 2000);
    } catch (e) {
        toast.add({ title: "Couldn't send covers", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        setTimeout(() => (pushing.value = undefined), 4000);
    }
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relative(iso: string) {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60e3);
    return Math.abs(mins) < 60 ? rtf.format(mins, 'minute') : rtf.format(Math.round(mins / 60), 'hour');
}
</script>
