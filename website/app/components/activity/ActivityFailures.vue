<template>
    <section v-if="data && (data.failures.length || showEmpty)" class="flex flex-col gap-2">
        <div class="flex flex-row flex-wrap items-center gap-2">
            <h3 class="font-medium flex items-center gap-2">
                <UIcon name="i-lucide-triangle-alert" :class="['size-4', gaveUp.length ? 'text-error' : 'text-warning']" />
                Failed downloads
                <UBadge size="sm" variant="subtle" :color="gaveUp.length ? 'error' : 'warning'">{{ data.failures.length }}</UBadge>
            </h3>
            <span class="grow" />
            <USwitch
                :model-value="data.notifyWhenGivingUp"
                :loading="saving"
                size="sm"
                label="Notify me when Tranga gives up"
                @update:model-value="setNotify" />
            <UButton
                v-if="data.failures.length > 1"
                size="xs"
                variant="soft"
                color="neutral"
                icon="i-lucide-rotate-ccw"
                :loading="busy === 'all'"
                @click="act('all', 'v2/DownloadFailures/Retry')">
                Retry all
            </UButton>
        </div>
        <p class="text-xs text-muted">
            Tranga tries a failed chapter again after 5 minutes, 30 minutes, 2 hours and 12 hours, then gives up. If the chapter is also
            on another website you added the series from, Tranga switches to it.
        </p>
        <ul class="flex flex-col divide-y divide-default rounded-lg border border-default">
            <li v-for="f in data.failures" :key="f.chapterIdId" class="flex flex-col gap-1.5 p-2.5">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <NuxtLink :to="`/manga/${f.mangaId}?return=${encodeURIComponent($route.fullPath)}`" class="font-medium hover:underline">
                        {{ f.mangaName }}
                    </NuxtLink>
                    <UBadge size="sm" variant="soft" color="neutral">Ch. {{ f.chapterNumber }}</UBadge>
                    <UBadge size="sm" variant="soft" color="neutral" icon="i-lucide-globe">{{ f.website }}</UBadge>
                    <UBadge v-if="f.switchedTo" size="sm" variant="subtle" color="primary" icon="i-lucide-arrow-right-left">
                        Now from {{ f.switchedTo }}
                    </UBadge>
                    <UBadge v-else-if="f.gaveUp" size="sm" variant="subtle" color="error">Gave up</UBadge>
                    <UBadge v-else size="sm" variant="subtle" color="warning">
                        Try {{ f.attempts + 1 }} of {{ data.maxAttempts }} {{ f.nextRetryUtc ? relative(f.nextRetryUtc) : 'soon' }}
                    </UBadge>
                </div>
                <p class="text-sm text-muted">{{ f.lastError }}</p>
                <div class="flex flex-row flex-wrap items-center gap-1.5">
                    <span class="text-xs text-dimmed mr-1">
                        {{ f.attempts }} failed {{ f.attempts === 1 ? 'attempt' : 'attempts' }}, last {{ relative(f.lastAttemptUtc) }}
                    </span>
                    <UButton
                        size="xs"
                        variant="soft"
                        color="primary"
                        icon="i-lucide-rotate-ccw"
                        :loading="busy === `${f.chapterIdId}:retry`"
                        @click="act(`${f.chapterIdId}:retry`, `v2/DownloadFailures/${enc(f.chapterIdId)}/Retry`)">
                        Retry now
                    </UButton>
                    <UButton
                        v-for="w in f.otherWebsites"
                        :key="w"
                        size="xs"
                        variant="soft"
                        color="neutral"
                        icon="i-lucide-arrow-right-left"
                        :loading="busy === `${f.chapterIdId}:${w}`"
                        @click="act(`${f.chapterIdId}:${w}`, `v2/DownloadFailures/${enc(f.chapterIdId)}/UseWebsite/${enc(w)}`)">
                        Use {{ w }}
                    </UButton>
                    <UButton
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        icon="i-lucide-skip-forward"
                        :loading="busy === `${f.chapterIdId}:skip`"
                        @click="act(`${f.chapterIdId}:skip`, `v2/DownloadFailures/${enc(f.chapterIdId)}/Skip`)">
                        Skip
                    </UButton>
                </div>
            </li>
        </ul>
        <p v-if="data.failures.some((f) => f.gaveUp && !f.otherWebsites.length && !f.switchedTo)" class="text-xs text-dimmed">
            To get a chapter from another website, add the series again from that website on the Add manga page (it's merged into the same
            series), then switch on downloading from it on the series page.
        </p>
    </section>
</template>

<script setup lang="ts">
export interface DownloadFailure {
    chapterIdId: string;
    chapterId: string;
    mangaId: string;
    mangaName: string;
    chapterNumber: string;
    website: string;
    attempts: number;
    lastError: string;
    lastAttemptUtc: string;
    nextRetryUtc?: string | null;
    gaveUp: boolean;
    switchedTo?: string | null;
    otherWebsites: string[];
}
interface DownloadFailures {
    maxAttempts: number;
    notifyWhenGivingUp: boolean;
    failures: DownloadFailure[];
}

const props = defineProps<{ active: boolean; showEmpty?: boolean }>();
const emit = defineEmits<{ (e: 'count', failed: number): void; (e: 'changed'): void }>();
const api = useTrangaApi();
const toast = useToast();

const data = ref<DownloadFailures>();
const busy = ref<string>();
const saving = ref(false);
const gaveUp = computed(() => (data.value?.failures ?? []).filter((f) => f.gaveUp && !f.switchedTo));
const enc = encodeURIComponent;

let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
    clearTimeout(timer);
    try {
        data.value = await api.call<DownloadFailures>('v2/DownloadFailures');
        emit('count', gaveUp.value.length);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) return; // older API: section stays hidden
    }
    timer = setTimeout(load, props.active ? 10000 : 60000);
}
watch(
    () => props.active,
    (a) => a && load()
);
onMounted(load);
defineExpose({ reload: load });
onBeforeUnmount(() => clearTimeout(timer));

async function act(key: string, path: string) {
    busy.value = key;
    try {
        data.value = await api.call<DownloadFailures>(path, { method: 'POST' });
        emit('count', gaveUp.value.length);
        emit('changed');
    } catch (e) {
        toast.add({ title: "Couldn't do that", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
        load();
    } finally {
        busy.value = undefined;
    }
}

async function setNotify(value: boolean) {
    saving.value = true;
    try {
        data.value = await api.call<DownloadFailures>('v2/DownloadFailures', { method: 'PATCH', body: { notifyWhenGivingUp: value } });
    } catch (e) {
        toast.add({ title: "Couldn't save", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        saving.value = false;
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
