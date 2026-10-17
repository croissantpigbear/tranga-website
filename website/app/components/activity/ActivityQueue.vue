<template>
    <div class="flex flex-col gap-3">
        <div v-if="supported && pausedAll !== undefined" class="flex flex-row flex-wrap items-center gap-2">
            <UAlert
                v-if="pausedAll"
                color="warning"
                variant="subtle"
                icon="i-lucide-pause"
                title="Downloads are paused"
                description="No new chapters start downloading. Chapters already downloading finish."
                class="grow" />
            <span v-else class="grow" />
            <UButton
                :icon="pausedAll ? 'i-lucide-play' : 'i-lucide-pause'"
                :color="pausedAll ? 'primary' : 'neutral'"
                variant="soft"
                :loading="moving === 'all'"
                @click="setPausedAll(!pausedAll)">
                {{ pausedAll ? 'Resume downloads' : 'Pause all downloads' }}
            </UButton>
        </div>
        <ActivityFailures ref="failures" :active="active" @count="(n) => emit('failed', n)" @changed="load" />
        <p v-if="supported === false" class="text-sm text-warning">The download queue needs a newer Tranga API (the download queue update).</p>
        <USkeleton v-else-if="!entries" class="h-40 w-full" />
        <p v-else-if="!entries.length" class="text-sm text-muted">Nothing waiting to download. Every chapter you asked for is downloaded.</p>
        <template v-else>
            <ol class="flex flex-col divide-y divide-default rounded-lg border border-default">
                <li v-for="(e, i) in entries" :key="e.mangaId" class="flex flex-row items-center gap-3 p-2.5">
                    <span class="w-6 text-center text-sm font-medium text-muted shrink-0">{{ i + 1 }}</span>
                    <div class="w-10 shrink-0 rounded overflow-clip">
                        <FallbackImage :src="coverUrl(e.mangaId)" :alt="`${e.name} cover`" class="w-full aspect-[2/3] object-cover bg-elevated" />
                    </div>
                    <div class="flex flex-col gap-1 min-w-0 grow">
                        <NuxtLink
                            :to="`/manga/${e.mangaId}?return=${encodeURIComponent($route.fullPath)}`"
                            class="font-medium truncate hover:underline">
                            {{ e.name }}
                        </NuxtLink>
                        <div class="flex flex-row flex-wrap items-center gap-1.5 text-xs text-muted">
                            <UBadge v-if="e.paused" size="sm" variant="subtle" color="warning" icon="i-lucide-pause">Paused</UBadge>
                            <UBadge v-if="e.downloading" size="sm" variant="subtle" color="primary" icon="i-lucide-loader">
                                Downloading {{ e.downloading }}
                            </UBadge>
                            <UBadge v-else-if="i === firstActive && !e.paused && !pausedAll" size="sm" variant="subtle" color="neutral" icon="i-lucide-clock">
                                Next
                            </UBadge>
                            <UBadge v-if="e.failed" size="sm" variant="subtle" color="error" icon="i-lucide-triangle-alert">
                                {{ e.failed }} failed
                            </UBadge>
                            <UBadge v-if="e.retrying" size="sm" variant="subtle" color="warning" icon="i-lucide-rotate-ccw">
                                {{ e.retrying }} retrying
                            </UBadge>
                            <span>{{ e.chaptersLeft }} {{ e.chaptersLeft === 1 ? 'chapter' : 'chapters' }} left</span>
                            <span v-if="e.nextChapter" class="text-dimmed">· from Ch. {{ e.nextChapter }}</span>
                            <span v-if="e.websites.length" class="text-dimmed">· {{ e.websites.join(', ') }}</span>
                        </div>
                    </div>
                    <div class="flex flex-row items-center gap-0.5 shrink-0">
                        <UTooltip :text="e.paused ? 'Resume this series' : 'Pause this series'">
                            <UButton
                                size="xs"
                                variant="ghost"
                                :color="e.paused ? 'primary' : 'neutral'"
                                :icon="e.paused ? 'i-lucide-play' : 'i-lucide-pause'"
                                :disabled="!!moving"
                                :loading="moving === `${e.mangaId}:pause`"
                                :aria-label="e.paused ? 'Resume' : 'Pause'"
                                @click="setPaused(e.mangaId, !e.paused)" />
                        </UTooltip>
                        <UTooltip text="Download next">
                            <UButton
                                size="xs"
                                variant="ghost"
                                color="neutral"
                                icon="i-lucide-arrow-up-to-line"
                                :disabled="i === 0 || !!moving"
                                :loading="moving === `${e.mangaId}:0`"
                                aria-label="Download next"
                                @click="move(e.mangaId, 0)" />
                        </UTooltip>
                        <UTooltip text="Move up">
                            <UButton
                                size="xs"
                                variant="ghost"
                                color="neutral"
                                icon="i-lucide-chevron-up"
                                :disabled="i === 0 || !!moving"
                                aria-label="Move up"
                                @click="move(e.mangaId, i - 1)" />
                        </UTooltip>
                        <UTooltip text="Move down">
                            <UButton
                                size="xs"
                                variant="ghost"
                                color="neutral"
                                icon="i-lucide-chevron-down"
                                :disabled="i === entries.length - 1 || !!moving"
                                aria-label="Move down"
                                @click="move(e.mangaId, i + 1)" />
                        </UTooltip>
                    </div>
                </li>
            </ol>
            <p class="text-xs text-dimmed">
                Changes apply from the next download round (within a minute); chapters already downloading finish first. Each website
                has its own limit, so while the first series' website is busy, a series from another website can download alongside it.
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
export interface DownloadQueueEntry {
    mangaId: string;
    name: string;
    position: number;
    chaptersLeft: number;
    downloading: number;
    nextChapter?: string | null;
    websites: string[];
    failed?: number;
    retrying?: number;
    paused?: boolean;
}

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ (e: 'count', series: number): void; (e: 'failed', chapters: number): void; (e: 'paused', all: boolean): void }>();
const api = useTrangaApi();
const toast = useToast();
const config = useRuntimeConfig();

const entries = ref<DownloadQueueEntry[]>();
const supported = ref<boolean>();
const moving = ref<string>();
/** undefined with an older API (no pausing) */
const pausedAll = ref<boolean>();
const firstActive = computed(() => (entries.value ?? []).findIndex((e) => !e.paused));

const coverUrl = (mangaId: string) => `${config.public.openFetch.api.baseURL}v2/Manga/${mangaId}/Cover/Small`;

let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
    clearTimeout(timer);
    try {
        entries.value = await api.call<DownloadQueueEntry[]>('v2/DownloadQueue');
        supported.value = true;
        api.call<{ pausedAll: boolean }>('v2/DownloadQueue/Status')
            .then((st) => {
                pausedAll.value = st.pausedAll;
                emit('paused', st.pausedAll);
            })
            .catch(() => (pausedAll.value = undefined));
        emit('count', entries.value.length);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) {
            supported.value = false;
            return;
        }
    }
    timer = setTimeout(load, props.active ? 5000 : 30000);
}
watch(
    () => props.active,
    (a) => a && supported.value !== false && load()
);
onMounted(load);
const failures = ref<{ reload: () => unknown }>();
defineExpose({ reload: () => (load(), failures.value?.reload()) });
onBeforeUnmount(() => clearTimeout(timer));

async function setPaused(mangaId: string, paused: boolean) {
    moving.value = `${mangaId}:pause`;
    try {
        entries.value = await api.call<DownloadQueueEntry[]>(
            `v2/DownloadQueue/${encodeURIComponent(mangaId)}/${paused ? 'Pause' : 'Resume'}`,
            { method: 'POST' }
        );
    } catch (e) {
        toast.add({ title: "Couldn't change that", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
        load();
    } finally {
        moving.value = undefined;
    }
}

async function setPausedAll(paused: boolean) {
    moving.value = 'all';
    try {
        const st = await api.call<{ pausedAll: boolean }>(`v2/DownloadQueue/${paused ? 'Pause' : 'Resume'}`, { method: 'POST' });
        pausedAll.value = st.pausedAll;
        emit('paused', st.pausedAll);
    } catch (e) {
        toast.add({ title: "Couldn't change that", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    } finally {
        moving.value = undefined;
    }
}

async function move(mangaId: string, position: number) {
    moving.value = `${mangaId}:${position}`;
    try {
        entries.value = await api.call<DownloadQueueEntry[]>(`v2/DownloadQueue/${encodeURIComponent(mangaId)}/Move/${position}`, {
            method: 'POST',
        });
        emit('count', entries.value.length);
    } catch (e) {
        toast.add({
            title: "Couldn't move it",
            description: api.statusOf(e) === 404 ? 'It has finished downloading.' : api.messageOf(e),
            color: 'error',
            icon: 'i-lucide-circle-x',
        });
        load();
    } finally {
        moving.value = undefined;
    }
}
</script>
