<template>
    <TrangaPage>
        <div class="max-w-4xl mx-auto w-full flex flex-col gap-4 pb-8">
            <div class="flex flex-col gap-2">
                <h1 class="text-3xl font-bold">Settings</h1>
                <div v-if="settingsStatus === 'error'" class="text-sm">
                    <p class="text-warning">Unable to connect to the Tranga API.</p>
                    <p class="text-muted">NUXT_PUBLIC_OPEN_FETCH_API_BASE_URL: {{ $config.public.openFetch.api.baseURL }}</p>
                </div>
                <nav class="flex flex-row flex-wrap gap-1">
                    <UButton v-for="s in sections" :key="s.id" size="xs" variant="soft" color="neutral" :icon="s.icon" @click="jump(s.id)">
                        {{ s.label }}
                    </UButton>
                </nav>
            </div>

            <SettingsLibraries id="libraries" :settings="settings" class="scroll-mt-4" @add-library="addLibraryModal.open()" @connect="onConnect" />
            <SettingsDownloads id="downloads" :settings="settings" class="scroll-mt-4" />
            <SettingsPerformance id="performance" class="scroll-mt-4" />
            <SettingsFmd id="fmd" class="scroll-mt-4" />
            <SettingsNaming id="naming" :settings="settings" class="scroll-mt-4" />
            <SettingsComicInfo id="metadata" class="scroll-mt-4" />
            <SettingsNetwork id="network" :settings="settings" class="scroll-mt-4" />
            <SettingsNotifications id="notifications" class="scroll-mt-4" @add="onAddNotification" />
            <SettingsMaintenance id="maintenance" class="scroll-mt-4" />
            <SettingsStats id="stats" class="scroll-mt-4" />
        </div>
    </TrangaPage>
</template>

<script setup lang="ts">
import {
    LazyAddLibraryModal,
    LazyGenericNotificationConnectorModal,
    LazyGotifyModal,
    LazyKavitaModal,
    LazyKomgaModal,
    LazyNtfyModal,
    LazyPushoverModal,
} from '#components';
const overlay = useOverlay();

const addLibraryModal = overlay.create(LazyAddLibraryModal);
const komgaModal = overlay.create(LazyKomgaModal);
const kavitaModal = overlay.create(LazyKavitaModal);
const addGotifyModal = overlay.create(LazyGotifyModal);
const addNtfyModal = overlay.create(LazyNtfyModal);
const addPushoverModal = overlay.create(LazyPushoverModal);
const addGenericConnectorModal = overlay.create(LazyGenericNotificationConnectorModal);

const onConnect = (type: 'Komga' | 'Kavita') => (type === 'Komga' ? komgaModal.open() : kavitaModal.open());
const onAddNotification = (type: 'Gotify' | 'Ntfy' | 'Pushover' | 'Generic') =>
    ({ Gotify: addGotifyModal, Ntfy: addNtfyModal, Pushover: addPushoverModal, Generic: addGenericConnectorModal })[type].open();

const { data: settings, status: settingsStatus } = useApi('/v2/Settings', { key: FetchKeys.Settings.All, server: false });

const sections = [
    { id: 'libraries', label: 'Libraries', icon: 'i-lucide-library-big' },
    { id: 'downloads', label: 'Downloads', icon: 'i-lucide-download' },
    { id: 'performance', label: 'Performance', icon: 'i-lucide-gauge' },
    { id: 'fmd', label: 'More websites', icon: 'i-lucide-puzzle' },
    { id: 'naming', label: 'Naming', icon: 'i-lucide-text-cursor-input' },
    { id: 'metadata', label: 'Reader metadata', icon: 'i-lucide-file-code-2' },
    { id: 'network', label: 'Network', icon: 'i-lucide-globe' },
    { id: 'notifications', label: 'Notifications', icon: 'i-lucide-bell' },
    { id: 'maintenance', label: 'Maintenance', icon: 'i-lucide-wrench' },
    { id: 'stats', label: 'Stats', icon: 'i-lucide-chart-no-axes-column' },
];
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

useHead({ title: 'Settings' });
</script>
