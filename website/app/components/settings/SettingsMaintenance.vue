<template>
    <SettingsSection title="Maintenance" icon="i-lucide-wrench" description="Backups, and tidying up Tranga's database. Nothing here deletes downloaded files.">
        <div class="flex flex-col gap-3">
            <!-- Backups (made by the tranga-backup container) -->
            <div v-if="backups" class="rounded-lg bg-elevated p-3 flex flex-col gap-1">
                <p class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-archive" class="size-4" />Backups
                    <UBadge v-if="backupState" size="sm" variant="subtle" :color="backupState.color">{{ backupState.label }}</UBadge>
                </p>
                <p v-if="!backups.folderFound" class="text-sm text-muted">
                    No backup folder is connected to the API. Add the <code>tranga-backup</code> service and the <code>backups</code> folder from
                    the latest <code>docker-compose.yaml</code> to get a daily backup of the database and settings.
                </p>
                <template v-else-if="lastDb">
                    <p class="text-sm text-muted">
                        Last database backup {{ relative(lastDb.createdUtc) }} ({{ sizeText(lastDb.sizeBytes) }}); {{ dbCount }} kept, plus
                        {{ settingsCount }} of the settings folder. How to restore one is in the README.
                    </p>
                </template>
                <p v-else class="text-sm text-warning">The backup folder is connected, but no backups are in it yet.</p>
            </div>
            <SettingsBackupRestore />
            <div class="rounded-lg bg-elevated p-3 flex flex-row flex-wrap items-center gap-3">
                <div class="grow min-w-60">
                    <p class="font-medium">Remove manga you're not downloading</p>
                    <p class="text-sm text-muted">
                        Search results stay in Tranga's database even if you never download them<span v-if="notDownloading !== undefined">
                            — currently <span class="font-medium">{{ notDownloading }}</span></span
                        >. This removes every manga that isn't set to download from any website.
                    </p>
                </div>
                <UButton variant="soft" color="warning" icon="i-lucide-database" :disabled="notDownloading === 0" @click="cleanDbOpen = true">Clean up</UButton>
            </div>
            <div class="rounded-lg bg-elevated p-3 flex flex-row flex-wrap items-center gap-3">
                <div class="grow min-w-60">
                    <p class="font-medium">Clear the activity log</p>
                    <p class="text-sm text-muted">
                        Deletes the history shown under Activity. "Last downloaded" dates in the overview come from this log, so they'll be
                        blank for older chapters afterwards.
                    </p>
                </div>
                <UButton variant="soft" color="warning" icon="i-lucide-captions-off" @click="cleanActionsOpen = true">Clear log</UButton>
            </div>
        </div>
        <ConfirmDialog v-model:open="cleanDbOpen" title="Remove manga you're not downloading?" confirm-label="Remove" color="warning" icon="i-lucide-database" :action="cleanDb">
            <p>
                {{ notDownloading ?? 'All' }} manga that aren't set to download from any website will be removed from Tranga. Manga you
                download are not affected, and no files are deleted.
            </p>
        </ConfirmDialog>
        <ConfirmDialog v-model:open="cleanActionsOpen" title="Clear the activity log?" confirm-label="Clear log" color="warning" icon="i-lucide-captions-off" :action="cleanActions">
            <p>All entries under Activity are deleted. This can't be undone.</p>
        </ConfirmDialog>
    </SettingsSection>
</template>

<script setup lang="ts">
const { $api } = useNuxtApp();
const { data: manga } = useApi('/v2/Manga', { key: FetchKeys.Manga.All, server: false });
const notDownloading = computed(() => (manga.value ? manga.value.filter((m) => !m.mangaConnectorIds.some((id) => id.useForDownload)).length : undefined));

interface BackupFile {
    kind: 'database' | 'settings';
    fileName: string;
    sizeBytes: number;
    createdUtc: string;
}
const api = useTrangaApi();
/** undefined with an older API (section hidden) */
const backups = ref<{ folderFound: boolean; folder: string; files: BackupFile[] }>();
onMounted(async () => {
    try {
        backups.value = await api.call('v2/Backups');
    } catch {
        backups.value = undefined;
    }
});
const lastDb = computed(() => backups.value?.files.find((f) => f.kind === 'database'));
const dbCount = computed(() => backups.value?.files.filter((f) => f.kind === 'database').length ?? 0);
const settingsCount = computed(() => backups.value?.files.filter((f) => f.kind === 'settings').length ?? 0);
const backupState = computed(() => {
    if (!backups.value?.folderFound) return undefined;
    if (!lastDb.value) return { label: 'None yet', color: 'warning' as const };
    const hours = (Date.now() - new Date(lastDb.value.createdUtc).getTime()) / 36e5;
    return hours < 36 ? { label: 'OK', color: 'success' as const } : { label: 'Out of date', color: 'error' as const };
});
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relative(iso: string): string {
    const h = (Date.now() - new Date(iso).getTime()) / 36e5;
    return h < 1 ? 'less than an hour ago' : h < 48 ? rtf.format(-Math.round(h), 'hour') : rtf.format(-Math.round(h / 24), 'day');
}
function sizeText(n: number): string {
    return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

const cleanDbOpen = ref(false);
const cleanActionsOpen = ref(false);
async function cleanDb() {
    await $api('/v2/Maintenance/CleanupNoDownloadManga', { method: 'POST' });
    await refreshNuxtData([FetchKeys.Manga.All, 'settings-stats']);
}
async function cleanActions() {
    await $api('/v2/Maintenance/CleanupActions', { method: 'POST' });
    await refreshNuxtData('settings-stats');
}
</script>
