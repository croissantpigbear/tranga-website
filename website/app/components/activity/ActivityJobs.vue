<template>
    <div class="flex flex-col gap-5">
        <p v-if="supported === false" class="text-sm text-warning">
            Showing what Tranga is doing needs a newer Tranga API (the Activity update).
        </p>
        <USkeleton v-else-if="!jobs" class="h-40 w-full" />
        <template v-else>
            <!-- Running -->
            <section class="flex flex-col gap-2">
                <h3 class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-loader" :class="['size-4', running.length && 'animate-spin text-primary']" />
                    Running now
                    <UBadge size="sm" variant="subtle" color="neutral">{{ running.length }}</UBadge>
                </h3>
                <p v-if="!running.length" class="text-sm text-muted">Nothing running. Tranga is idle.</p>
                <div v-for="j in running" :key="j.key" class="rounded-lg border border-default p-3 flex flex-col gap-2">
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <span class="font-medium">{{ j.title }}</span>
                        <template v-if="j.mangaName">
                            <span class="text-dimmed">·</span>
                            <NuxtLink :to="`/manga/${j.mangaId}?return=${encodeURIComponent($route.fullPath)}`" class="text-primary hover:underline">
                                {{ j.mangaName }}
                            </NuxtLink>
                        </template>
                        <UBadge v-if="j.chapterNumber" size="sm" variant="soft" color="neutral">Ch. {{ j.chapterNumber }}</UBadge>
                        <UBadge v-if="j.source" size="sm" variant="soft" color="neutral" icon="i-lucide-globe">{{ j.source }}</UBadge>
                        <span class="grow" />
                        <UButton
                            v-if="!j.periodic"
                            size="xs"
                            variant="soft"
                            color="error"
                            icon="i-lucide-square"
                            :loading="stopping === j.key"
                            @click="stop(j.key)">
                            Stop
                        </UButton>
                    </div>
                    <div v-if="j.progress != null || j.progressDescription" class="flex flex-col gap-1">
                        <UProgress v-if="j.progress != null" :model-value="Math.round(j.progress * 100)" size="sm" />
                        <p class="text-xs text-muted">
                            {{ j.progressDescription }}<template v-if="j.progress != null"> · {{ Math.round(j.progress * 100) }}%</template>
                        </p>
                    </div>
                </div>
            </section>

            <!-- Waiting -->
            <section class="flex flex-col gap-2">
                <h3 class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-hourglass" class="size-4" />
                    Waiting
                    <UBadge size="sm" variant="subtle" color="neutral">{{ waiting.length }}</UBadge>
                </h3>
                <p v-if="!waiting.length" class="text-sm text-muted">Nothing queued.</p>
                <template v-else>
                    <div class="flex flex-row flex-wrap gap-1.5">
                        <UBadge v-for="g in waitingSummary" :key="g.title" variant="soft" color="neutral" size="md">
                            {{ g.title }} · {{ g.count }}
                        </UBadge>
                    </div>
                    <ul class="text-sm flex flex-col divide-y divide-default rounded-lg border border-default">
                        <li v-for="j in waiting.slice(0, showAllWaiting ? undefined : 15)" :key="j.key" class="px-3 py-1.5 flex flex-row gap-2 items-center">
                            <span class="text-muted shrink-0">{{ j.title }}</span>
                            <span v-if="j.mangaName" class="truncate">{{ j.mangaName }}</span>
                            <span v-if="j.chapterNumber" class="text-dimmed shrink-0">Ch. {{ j.chapterNumber }}</span>
                        </li>
                    </ul>
                    <UButton v-if="waiting.length > 15" size="xs" variant="ghost" class="w-fit" @click="showAllWaiting = !showAllWaiting">
                        {{ showAllWaiting ? 'Show fewer' : `Show all ${waiting.length}` }}
                    </UButton>
                </template>
            </section>

            <!-- Scheduled -->
            <section class="flex flex-col gap-2">
                <h3 class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-calendar-clock" class="size-4" />
                    Scheduled jobs
                </h3>
                <div class="rounded-lg border border-default overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-dimmed text-left">
                            <tr>
                                <th class="px-3 py-2 font-medium">Job</th>
                                <th class="px-3 py-2 font-medium">Every</th>
                                <th class="px-3 py-2 font-medium">Last run</th>
                                <th class="px-3 py-2 font-medium">Next run</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-default">
                            <tr v-for="j in scheduled" :key="j.key">
                                <td class="px-3 py-1.5">
                                    {{ j.title }}
                                    <UBadge v-if="j.state === 'Running'" size="sm" variant="subtle" color="primary" class="ml-1">running</UBadge>
                                    <UBadge v-else-if="j.state === 'Failed'" size="sm" variant="subtle" color="error" class="ml-1">failed</UBadge>
                                </td>
                                <td class="px-3 py-1.5 text-muted whitespace-nowrap">{{ formatInterval(j.intervalMinutes) }}</td>
                                <td class="px-3 py-1.5 text-muted whitespace-nowrap" :title="j.lastRunUtc ? new Date(j.lastRunUtc).toLocaleString() : ''">
                                    {{ j.lastRunUtc ? relative(j.lastRunUtc) : 'Not yet' }}
                                </td>
                                <td class="px-3 py-1.5 text-muted whitespace-nowrap" :title="j.nextRunUtc ? new Date(j.nextRunUtc).toLocaleString() : ''">
                                    {{ j.nextRunUtc ? relative(j.nextRunUtc) : '—' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
export interface ActivityJob {
    key: string;
    type: string;
    title: string;
    state: string;
    mangaId?: string | null;
    mangaName?: string | null;
    chapterNumber?: string | null;
    source?: string | null;
    progress?: number | null;
    progressDescription?: string | null;
    periodic: boolean;
    lastRunUtc?: string | null;
    nextRunUtc?: string | null;
    intervalMinutes?: number | null;
}

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ (e: 'count', running: number): void }>();
const api = useTrangaApi();
const toast = useToast();

const jobs = ref<ActivityJob[]>();
const supported = ref<boolean>();
const showAllWaiting = ref(false);
const stopping = ref<string>();

const running = computed(() => (jobs.value ?? []).filter((j) => j.state === 'Running'));
const waiting = computed(() => (jobs.value ?? []).filter((j) => !j.periodic && j.state !== 'Running'));
const scheduled = computed(() => (jobs.value ?? []).filter((j) => j.periodic));
const waitingSummary = computed(() => {
    const m = new Map<string, number>();
    for (const j of waiting.value) m.set(j.title, (m.get(j.title) ?? 0) + 1);
    return [...m].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count);
});

let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
    clearTimeout(timer);
    try {
        jobs.value = await api.call<ActivityJob[]>('v2/Activity/Workers');
        supported.value = true;
        emit('count', running.value.length);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) {
            supported.value = false;
            return;
        }
    }
    // Poll quickly while the tab is open, slowly in the background (for the tab badge)
    timer = setTimeout(load, props.active ? 3000 : 20000);
}
watch(
    () => props.active,
    (a) => a && supported.value !== false && load()
);
onMounted(load);
defineExpose({ reload: load });
onBeforeUnmount(() => clearTimeout(timer));

async function stop(key: string) {
    stopping.value = key;
    try {
        await api.call(`v2/Worker/${encodeURIComponent(key)}/Stop`, { method: 'POST' });
        toast.add({ title: 'Stopped', color: 'success', icon: 'i-lucide-check' });
    } catch (e) {
        toast.add({
            title: "Couldn't stop it",
            description: api.statusOf(e) === 412 ? 'It had already finished.' : api.messageOf(e),
            color: 'error',
            icon: 'i-lucide-circle-x',
        });
    } finally {
        stopping.value = undefined;
        load();
    }
}

function formatInterval(minutes?: number | null): string {
    if (!minutes) return '—';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = minutes / 60;
    if (h < 48) return `${+h.toFixed(1)} h`;
    return `${+(h / 24).toFixed(1)} days`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relative(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 60e3; // minutes, + = future
    const abs = Math.abs(diff);
    if (abs < 1) return diff >= 0 ? 'any moment' : 'just now';
    if (abs < 60) return rtf.format(Math.round(diff), 'minute');
    if (abs < 48 * 60) return rtf.format(Math.round(diff / 60), 'hour');
    return rtf.format(Math.round(diff / 1440), 'day');
}
</script>
