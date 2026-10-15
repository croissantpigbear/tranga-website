<template>
    <SettingsSection title="Network" icon="i-lucide-globe" description="How Tranga talks to manga websites.">
        <template v-if="settings">
            <UFormField
                label="FlareSolverr"
                description="Needed for websites protected by Cloudflare. Enter the address of your FlareSolverr container, e.g. http://flaresolverr:8191">
                <div class="flex flex-col gap-2">
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <UInput v-model="flareUrl" placeholder="Not used" class="grow min-w-60" />
                        <UButton size="sm" icon="i-lucide-check" :disabled="flareUrl === (settings.flareSolverrUrl ?? '')" @click="saveFlare">Save</UButton>
                        <UButton v-if="settings.flareSolverrUrl" size="sm" variant="ghost" color="neutral" icon="i-lucide-x" @click="clearFlare">Clear</UButton>
                        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-plug-zap" :loading="flareTesting" :disabled="!settings.flareSolverrUrl" @click="testFlare">
                            Test
                        </UButton>
                    </div>
                    <SettingsSaveStatus :state="flareSave.state.value" :error="flareSave.error.value" />
                    <p v-if="flareResult" :class="['text-xs flex items-center gap-1', flareResult.ok ? 'text-success' : 'text-error']">
                        <UIcon :name="flareResult.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-3.5" />
                        {{ flareResult.message }}
                    </p>
                </div>
            </UFormField>

            <UFormField label="User agent" description="The browser name Tranga presents to websites. Only change it if a site blocks Tranga.">
                <div class="flex flex-col gap-2">
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <UInput v-model="userAgent" class="grow min-w-60 font-mono text-xs" />
                        <UButton size="sm" icon="i-lucide-check" :disabled="userAgent === settings.userAgent" @click="saveUserAgent">Save</UButton>
                        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-rotate-ccw" @click="resetUserAgent">Default</UButton>
                    </div>
                    <SettingsSaveStatus :state="uaSave.state.value" :error="uaSave.error.value" />
                </div>
            </UFormField>
        </template>
        <USkeleton v-else class="h-24 w-full" />
    </SettingsSection>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type TrangaSettings = components['schemas']['TrangaSettings'];

const props = defineProps<{ settings?: TrangaSettings | null }>();
const api = useTrangaApi();

const flareUrl = ref('');
const userAgent = ref('');
watch(
    () => props.settings,
    (s) => {
        if (!s) return;
        flareUrl.value = s.flareSolverrUrl ?? '';
        userAgent.value = s.userAgent;
    },
    { immediate: true }
);
const reload = () => refreshNuxtData(FetchKeys.Settings.All);

const flareSave = useSaveState();
const saveFlare = () =>
    flareSave.run(async () => {
        if (flareUrl.value.trim()) await api.call('v2/Settings/FlareSolverr/Url', { method: 'PATCH', body: flareUrl.value.trim() });
        else await api.call('v2/Settings/FlareSolverr/Url', { method: 'DELETE' });
        flareResult.value = undefined;
        await reload();
    });
const clearFlare = () => {
    flareUrl.value = '';
    saveFlare();
};
const flareTesting = ref(false);
const flareResult = ref<{ ok: boolean; message: string }>();
async function testFlare() {
    flareTesting.value = true;
    try {
        await api.call('v2/Settings/FlareSolverr/Test', { method: 'POST' });
        flareResult.value = { ok: true, message: 'FlareSolverr is working.' };
    } catch {
        flareResult.value = { ok: false, message: "FlareSolverr didn't work — check the address and that the container is running." };
    } finally {
        flareTesting.value = false;
    }
}

const uaSave = useSaveState();
const saveUserAgent = () =>
    uaSave.run(async () => {
        await api.call('v2/Settings/UserAgent', { method: 'PATCH', body: userAgent.value });
        await reload();
    });
const resetUserAgent = () =>
    uaSave.run(async () => {
        await api.call('v2/Settings/UserAgent', { method: 'DELETE' });
        await reload();
    });
</script>
