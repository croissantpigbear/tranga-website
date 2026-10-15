<template>
    <div class="flex flex-col gap-3 h-full">
        <p v-if="supported === false" class="text-sm text-warning">The log viewer needs a newer Tranga API (the Activity update).</p>
        <template v-else>
            <div class="flex flex-row flex-wrap items-center gap-2">
                <UFieldGroup>
                    <UButton
                        v-for="l in LEVELS"
                        :key="l.value"
                        size="sm"
                        :color="level === l.value ? 'primary' : 'neutral'"
                        :variant="level === l.value ? 'solid' : 'outline'"
                        @click="level = l.value">
                        {{ l.label }}
                    </UButton>
                </UFieldGroup>
                <UInput v-model="search" icon="i-lucide-search" placeholder="Search the log…" size="sm" class="w-64" />
                <span class="grow" />
                <USwitch v-model="live" size="sm" label="Live" />
                <USwitch v-model="follow" size="sm" label="Follow newest" />
                <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-file-down" :href="downloadUrl" target="_blank">Download</UButton>
            </div>
            <p class="text-xs text-muted">
                The last {{ capacityNote }} lines since the API started (older lines are in the API container's log file:
                <code>/usr/share/tranga-api/log/Tranga.log</code>).
                <template v-if="problems"> In the last 24 hours: </template>
                <span v-if="problems?.errors" class="text-error">{{ problems.errors }} errors</span>
                <template v-if="problems?.errors && problems?.warnings">, </template>
                <span v-if="problems?.warnings" class="text-warning">{{ problems.warnings }} warnings</span>
                <template v-if="problems && !problems.errors && !problems.warnings">no warnings or errors.</template>
            </p>

            <div
                ref="scroller"
                class="font-mono text-xs rounded-lg border border-default bg-elevated/30 overflow-y-auto min-h-80 h-[calc(100dvh-22rem)]"
                @scroll="onScroll">
                <p v-if="!entries.length" class="p-4 text-muted font-sans text-sm">
                    {{ loading ? 'Loading…' : search || level !== 'DEBUG' ? 'No matching lines.' : 'No log lines yet.' }}
                </p>
                <div
                    v-for="e in entries"
                    :key="e.id"
                    :class="['px-3 py-0.5 border-b border-default/40 flex flex-row gap-2 items-start', rowClass(e.level)]">
                    <span class="text-dimmed shrink-0 whitespace-nowrap" :title="new Date(e.timeUtc).toLocaleString()">{{ time(e.timeUtc) }}</span>
                    <span :class="['shrink-0 w-12 font-semibold', levelClass(e.level)]">{{ e.level }}</span>
                    <span class="shrink-0 text-muted w-56 max-md:w-28 truncate" :title="e.logger">{{ e.logger }}</span>
                    <div class="min-w-0 grow">
                        <span class="whitespace-pre-wrap break-words">{{ e.message }}</span>
                        <template v-if="e.exception">
                            <button type="button" class="block text-error underline-offset-2 hover:underline" @click="toggle(e.id)">
                                {{ open.has(e.id) ? 'Hide error details' : 'Show error details' }}
                            </button>
                            <pre v-if="open.has(e.id)" class="whitespace-pre-wrap break-all text-error/90 mt-1">{{ e.exception }}</pre>
                        </template>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
interface LogEntry {
    id: number;
    timeUtc: string;
    level: string;
    logger: string;
    message: string;
    exception?: string | null;
}
interface LogsResponse {
    entries: LogEntry[];
    lastId: number;
    oldestUtc?: string | null;
    warnings24h: number;
    errors24h: number;
}

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ (e: 'problems', p: { warnings: number; errors: number }): void }>();
const api = useTrangaApi();
const config = useRuntimeConfig();

const LEVELS = [
    { value: 'DEBUG', label: 'Everything' },
    { value: 'INFO', label: 'Info' },
    { value: 'WARN', label: 'Warnings & errors' },
    { value: 'ERROR', label: 'Errors' },
] as const;
const MAX_LINES = 3000;
const capacityNote = '5000';

const level = ref<string>('INFO');
const search = ref('');
const live = ref(true);
const follow = ref(true);
const entries = ref<LogEntry[]>([]);
const loading = ref(false);
const supported = ref<boolean>();
const problems = ref<{ warnings: number; errors: number }>();
const open = reactive(new Set<number>());
const toggle = (id: number) => (open.has(id) ? open.delete(id) : open.add(id));

const downloadUrl = computed(() => `${config.public.openFetch.api.baseURL}v2/Activity/Logs/Download?minLevel=${level.value}`);

let lastId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

async function fetchLogs(reset: boolean) {
    clearTimeout(timer);
    const gen = reset ? ++generation : generation;
    if (reset) {
        lastId = 0;
        loading.value = true;
    }
    try {
        const res = await api.call<LogsResponse>('v2/Activity/Logs', {
            query: { afterId: String(lastId), minLevel: level.value, search: search.value, limit: reset ? '1000' : '500' },
        });
        if (gen !== generation) return; // filters changed meanwhile
        supported.value = true;
        lastId = Math.max(lastId, res.lastId);
        problems.value = { warnings: res.warnings24h, errors: res.errors24h };
        emit('problems', problems.value);
        const merged = reset ? res.entries : [...entries.value, ...res.entries];
        entries.value = merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged;
        if (follow.value) nextTick(scrollToBottom);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) {
            supported.value = false;
            return;
        }
    } finally {
        if (gen === generation) loading.value = false;
    }
    schedule();
}
function schedule() {
    clearTimeout(timer);
    // Fast while watching; slow in the background (keeps the error count on the tab current)
    if (live.value) timer = setTimeout(() => fetchLogs(false), props.active ? 3000 : 30000);
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(level, () => fetchLogs(true));
watch(search, () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchLogs(true), 400);
});
watch(live, (on) => (on ? fetchLogs(false) : clearTimeout(timer)));
watch(
    () => props.active,
    (a) => {
        if (a && supported.value !== false) fetchLogs(false);
    }
);
onMounted(() => fetchLogs(true));
defineExpose({ reload: () => fetchLogs(true) });
onBeforeUnmount(() => {
    clearTimeout(timer);
    clearTimeout(searchTimer);
});

const scroller = ref<HTMLElement>();
function scrollToBottom() {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}
// Scrolling up pauses "follow"; scrolling back to the bottom resumes it
function onScroll() {
    const el = scroller.value;
    if (!el) return;
    follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}
watch(follow, (f) => f && nextTick(scrollToBottom));

const time = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return sameDay ? t : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${t}`;
};
const levelClass = (l: string) =>
    l === 'ERROR' || l === 'FATAL' ? 'text-error' : l === 'WARN' ? 'text-warning' : l === 'INFO' ? 'text-info' : 'text-dimmed';
const rowClass = (l: string) => (l === 'ERROR' || l === 'FATAL' ? 'bg-error/10' : l === 'WARN' ? 'bg-warning/5' : '');
</script>
