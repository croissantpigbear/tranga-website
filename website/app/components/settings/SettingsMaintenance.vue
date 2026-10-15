<template>
    <SettingsSection title="Maintenance" icon="i-lucide-wrench" description="Tidy up Tranga's database. Neither option deletes downloaded files.">
        <div class="flex flex-col gap-3">
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
