<template>
    <TrangaPage>
        <template #title>
            <p class="text-2xl font-semibold">Activity</p>
        </template>
        <template #actions>
            <UTooltip text="Reload" :kbds="['meta', 'R']">
                <UButton variant="soft" color="secondary" icon="i-lucide-refresh-ccw" @click="reload">
                    <span class="max-sm:hidden">Reload</span>
                </UButton>
            </UTooltip>
        </template>
        <div class="max-w-6xl mx-auto w-full flex flex-col gap-4 pb-8">
            <nav class="flex flex-row flex-wrap gap-1 border-b border-default">
                <button
                    v-for="t in tabs"
                    :key="t.value"
                    type="button"
                    :class="[
                        'flex flex-row items-center gap-2 px-3 py-2 text-sm -mb-px border-b-2 transition-colors',
                        tab === t.value ? 'border-primary text-primary font-medium' : 'border-transparent text-muted hover:text-default',
                    ]"
                    @click="tab = t.value">
                    <UIcon :name="t.icon" class="size-4" />
                    {{ t.label }}
                    <UBadge v-if="t.badge" size="sm" variant="subtle" :color="t.badgeColor ?? 'neutral'">{{ t.badge }}</UBadge>
                </button>
            </nav>
            <p class="text-sm text-muted -mt-2">{{ tabs.find((t) => t.value === tab)?.description }}</p>

            <ActivityHistory v-show="tab === 'history'" ref="history" :initial-manga-id="initialMangaId" />
            <ActivityQueue v-show="tab === 'queue'" ref="queue" :active="tab === 'queue'" @count="(n) => (queueCount = n)" @failed="(n) => (failedCount = n)" />
            <ActivityJobs v-show="tab === 'jobs'" ref="jobs" :active="tab === 'jobs'" @count="(n) => (runningCount = n)" />
            <ActivityLogs v-show="tab === 'logs'" ref="logs" :active="tab === 'logs'" @problems="(p) => (problems = p)" />
        </div>
    </TrangaPage>
</template>

<script setup lang="ts">
type Tab = 'history' | 'queue' | 'jobs' | 'logs';

const route = useRoute();
const router = useRouter();
const initialMangaId = typeof route.query.mangaId === 'string' ? route.query.mangaId : undefined;

const tab = ref<Tab>(['history', 'queue', 'jobs', 'logs'].includes(route.query.tab as string) ? (route.query.tab as Tab) : 'history');
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t } }));

const runningCount = ref(0);
const queueCount = ref(0);
const failedCount = ref(0);
const problems = ref<{ warnings: number; errors: number }>();

const tabs = computed(() => [
    {
        value: 'history' as Tab,
        label: 'History',
        icon: 'i-lucide-history',
        description: 'What Tranga has done: downloads, chapter checks, covers, metadata updates and file moves.',
    },
    {
        value: 'queue' as Tab,
        label: 'Download queue',
        icon: 'i-lucide-list-ordered',
        badge: failedCount.value ? `${failedCount.value} failed` : queueCount.value || undefined,
        badgeColor: failedCount.value ? ('error' as const) : ('primary' as const),
        description:
            'Series waiting to download, in order: first added, first downloaded. Move a series up to download it sooner. Failed chapters are listed first.',
    },
    {
        value: 'jobs' as Tab,
        label: 'Running now',
        icon: 'i-lucide-cpu',
        badge: runningCount.value || undefined,
        badgeColor: 'primary' as const,
        description: 'Jobs running or queued right now, and the jobs Tranga runs on a schedule.',
    },
    {
        value: 'logs' as Tab,
        label: 'Logs',
        icon: 'i-lucide-scroll-text',
        badge: problems.value?.errors ? `${problems.value.errors} errors` : problems.value?.warnings ? `${problems.value.warnings} warnings` : undefined,
        badgeColor: problems.value?.errors ? ('error' as const) : ('warning' as const),
        description: "Tranga's own log, live. Use it to see why something failed, e.g. a download that didn't finish.",
    },
]);

type Reloadable = { reload: () => unknown };
const history = ref<Reloadable>();
const queue = ref<Reloadable>();
const jobs = ref<Reloadable>();
const logs = ref<Reloadable>();
const reload = () => ({ history, queue, jobs, logs })[tab.value].value?.reload();
defineShortcuts({ meta_r: { usingInput: true, handler: reload } });

useHead({ title: 'Activity' });
</script>
