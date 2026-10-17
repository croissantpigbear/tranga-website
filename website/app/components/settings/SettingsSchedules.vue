<template>
    <SettingsSection
        title="Schedules"
        icon="i-lucide-calendar-clock"
        description="How often Tranga does things on its own. The recommended times suit most setups: shorter means fresher results, but more work for Tranga and more requests to the websites.">
        <p v-if="jobs === null" class="text-sm text-warning">Changing schedules needs a newer Tranga API (the schedules update).</p>
        <USkeleton v-else-if="!jobs" class="h-40 w-full" />
        <template v-else>
            <div v-for="group in groups" :key="group.id" class="flex flex-col gap-2">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed">{{ group.label }}</h3>
                <div class="flex flex-col divide-y divide-default rounded-lg border border-default">
                    <div v-for="j in group.jobs" :key="j.id" class="p-3 flex flex-col gap-2">
                        <div class="flex flex-row flex-wrap items-start gap-3">
                            <div class="flex flex-col gap-0.5 grow basis-64 min-w-0">
                                <span class="font-medium">{{ j.title }}</span>
                                <span class="text-xs text-muted">{{ j.description }}</span>
                            </div>
                            <div class="flex flex-row items-center gap-1.5 shrink-0">
                                <span class="text-sm text-muted">Every</span>
                                <UInputNumber v-model="edits[j.id]!.value" :min="1" class="w-24" size="sm" />
                                <USelect v-model="edits[j.id]!.unit" :items="UNITS" value-key="value" size="sm" class="w-28" />
                            </div>
                        </div>
                        <div class="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span>
                                Recommended: {{ describe(j.recommendedMinutes) }}
                                <UButton
                                    v-if="minutesOf(j.id) !== j.recommendedMinutes"
                                    size="xs"
                                    variant="link"
                                    class="p-0 ml-1"
                                    @click="setEdit(j.id, j.recommendedMinutes)">
                                    Use
                                </UButton>
                            </span>
                            <span v-if="j.running" class="text-primary flex items-center gap-1">
                                <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />Running now
                            </span>
                            <span v-else-if="j.nextRunUtc">Next run {{ relative(j.nextRunUtc) }}</span>
                            <span class="grow" />
                            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-play" :loading="running === j.id" @click="runNow(j)">
                                Run now
                            </UButton>
                        </div>
                        <p v-if="problemOf(j)" class="text-xs text-error flex items-center gap-1">
                            <UIcon name="i-lucide-circle-x" class="size-3.5" />{{ problemOf(j) }}
                        </p>
                        <p v-else-if="warningOf(j)" class="text-xs text-warning flex items-center gap-1">
                            <UIcon name="i-lucide-triangle-alert" class="size-3.5" />{{ warningOf(j) }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="flex flex-row flex-wrap items-center gap-2">
                <UButton v-if="dirty.length" size="sm" icon="i-lucide-check" :loading="saving" :disabled="hasProblems" @click="save">
                    Save {{ dirty.length }} {{ dirty.length === 1 ? 'change' : 'changes' }}
                </UButton>
                <UButton v-if="dirty.length" size="sm" variant="outline" color="neutral" :disabled="saving" @click="take(jobs)">Cancel</UButton>
                <UButton
                    v-if="!dirty.length && jobs.some((j) => j.minutes !== j.recommendedMinutes)"
                    size="sm"
                    variant="soft"
                    color="neutral"
                    icon="i-lucide-rotate-ccw"
                    :loading="saving"
                    @click="resetAll">
                    Use recommended times for everything
                </UButton>
                <SettingsSaveStatus :state="saveState.state.value" :error="saveState.error.value" />
            </div>
            <p class="text-xs text-muted">Changes apply straight away; a job that's waiting picks up its new time without a restart.</p>
        </template>
    </SettingsSection>
</template>

<script setup lang="ts">
interface Job {
    id: string;
    group: 'downloads' | 'metadata' | 'notifications' | 'maintenance';
    title: string;
    description: string;
    minutes: number;
    recommendedMinutes: number;
    defaultMinutes: number;
    minMinutes: number;
    maxMinutes: number;
    lastRunUtc?: string | null;
    nextRunUtc?: string | null;
    running: boolean;
}
type Unit = 1 | 60 | 1440;

const UNITS = [
    { value: 1, label: 'minutes' },
    { value: 60, label: 'hours' },
    { value: 1440, label: 'days' },
];
const GROUPS = [
    { id: 'downloads', label: 'Downloads' },
    { id: 'metadata', label: 'Metadata and covers' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'maintenance', label: 'Maintenance' },
];

const api = useTrangaApi();
const toast = useToast();
const saveState = useSaveState();
/** undefined = loading, null = older API */
const jobs = ref<Job[] | null>();
const edits = reactive<Record<string, { value: number; unit: Unit }>>({});
const saving = ref(false);
const running = ref<string>();

const groups = computed(() =>
    GROUPS.map((g) => ({ ...g, jobs: (jobs.value ?? []).filter((j) => j.group === g.id) })).filter((g) => g.jobs.length)
);

/** Largest unit that shows the value as a whole number */
function split(minutes: number): { value: number; unit: Unit } {
    if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 1440 };
    if (minutes % 60 === 0) return { value: minutes / 60, unit: 60 };
    return { value: minutes, unit: 1 };
}
const minutesOf = (id: string) => (edits[id] ? Math.round((edits[id].value || 0) * edits[id].unit) : 0);
const setEdit = (id: string, minutes: number) => (edits[id] = split(minutes));

/** "30 minutes", "1 hour", "7 days" */
function amount(minutes: number): string {
    const { value, unit } = split(minutes);
    const name = unit === 1440 ? 'day' : unit === 60 ? 'hour' : 'minute';
    return `${value} ${name}${value === 1 ? '' : 's'}`;
}
/** "every 3 hours", "every minute" */
const describe = (minutes: number) => (split(minutes).value === 1 ? `every ${amount(minutes).slice(2)}` : `every ${amount(minutes)}`);

function take(list: Job[] | null | undefined) {
    if (!list) return;
    jobs.value = list;
    for (const j of list) setEdit(j.id, j.minutes);
}

const dirty = computed(() => (jobs.value ?? []).filter((j) => minutesOf(j.id) !== j.minutes));
function problemOf(j: Job): string | undefined {
    const m = minutesOf(j.id);
    if (m < j.minMinutes) return `At least ${amount(j.minMinutes)}.`;
    if (m > j.maxMinutes) return `At most ${amount(j.maxMinutes)}.`;
    return undefined;
}
const hasProblems = computed(() => (jobs.value ?? []).some((j) => problemOf(j)));
function warningOf(j: Job): string | undefined {
    const m = minutesOf(j.id);
    if (j.id === 'CheckForNewChaptersWorker' && m < 60)
        return 'Checking more than once an hour sends many requests; some websites may block Tranga.';
    if (m < j.recommendedMinutes / 4) return 'Much more often than recommended; this may slow Tranga down.';
    return undefined;
}

let poll: ReturnType<typeof setTimeout> | undefined;
async function load(applyEdits = true) {
    clearTimeout(poll);
    try {
        const list = await api.call<Job[]>('v2/TaskSchedules');
        if (applyEdits && !dirty.value.length) take(list);
        else if (jobs.value)
            for (const j of jobs.value) {
                const fresh = list.find((x) => x.id === j.id);
                if (fresh) Object.assign(j, { lastRunUtc: fresh.lastRunUtc, nextRunUtc: fresh.nextRunUtc, running: fresh.running });
            }
        poll = setTimeout(() => load(false), 15000);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) jobs.value = null;
    }
}
onMounted(() => load());
onBeforeUnmount(() => clearTimeout(poll));

async function save() {
    saving.value = true;
    const body = Object.fromEntries(dirty.value.map((j) => [j.id, minutesOf(j.id)]));
    await saveState.run(async () => take(await api.call<Job[]>('v2/TaskSchedules', { method: 'PATCH', body })));
    saving.value = false;
}

async function resetAll() {
    saving.value = true;
    await saveState.run(async () => take(await api.call<Job[]>('v2/TaskSchedules/Reset', { method: 'POST' })));
    saving.value = false;
}

async function runNow(j: Job) {
    running.value = j.id;
    try {
        await api.call(`v2/TaskSchedules/${encodeURIComponent(j.id)}/RunNow`, { method: 'POST' });
        toast.add({ title: `${j.title}: starting`, description: 'It runs within a few seconds.', color: 'success', icon: 'i-lucide-check' });
        setTimeout(() => load(false), 6000);
    } catch (e) {
        toast.add({ title: "Couldn't start it", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        running.value = undefined;
    }
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relative(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 60e3;
    const abs = Math.abs(diff);
    if (abs < 1) return diff >= 0 ? 'any moment' : 'just now';
    if (abs < 60) return rtf.format(Math.round(diff), 'minute');
    if (abs < 48 * 60) return rtf.format(Math.round(diff / 60), 'hour');
    return rtf.format(Math.round(diff / 1440), 'day');
}
</script>
