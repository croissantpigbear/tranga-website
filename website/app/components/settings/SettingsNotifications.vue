<template>
    <SettingsSection title="Notifications" icon="i-lucide-bell" description="Get a message on your phone or desktop when new chapters are downloaded.">
        <div class="flex flex-col gap-2">
            <p v-if="!connectors?.length" class="text-sm text-muted">No notification services set up yet.</p>
            <div v-for="n in connectors" :key="n.name" class="rounded-lg bg-elevated p-3 flex flex-col gap-1.5">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <UIcon name="i-lucide-megaphone" class="size-5 text-secondary shrink-0" />
                    <div class="grow min-w-0">
                        <p class="font-medium">{{ n.name }}</p>
                        <p class="text-sm text-muted break-all">{{ n.url }}</p>
                    </div>
                    <UButton
                        v-if="testsSupported !== false"
                        size="sm"
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-send"
                        :loading="testing === n.name"
                        @click="sendTest(n.name)">
                        Send test
                    </UButton>
                    <UButton size="sm" variant="soft" color="error" icon="i-lucide-trash-2" @click="askDelete(n.name)">Delete</UButton>
                </div>
                <p v-if="results[n.name]" :class="['text-xs flex items-start gap-1', results[n.name]!.ok ? 'text-success' : 'text-error']">
                    <UIcon :name="results[n.name]!.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-3.5 mt-px shrink-0" />
                    {{ results[n.name]!.message }}
                </p>
            </div>
        </div>
        <div class="flex flex-row flex-wrap gap-2">
            <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="emit('add', 'Gotify')">Add Gotify</UButton>
            <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="emit('add', 'Ntfy')">Add Ntfy</UButton>
            <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="emit('add', 'Pushover')">Add Pushover</UButton>
            <UTooltip text="Any service that accepts a web request (webhook), e.g. Discord or Home Assistant">
                <UButton size="sm" variant="soft" icon="i-lucide-plus" @click="emit('add', 'Generic')">Add other (webhook)</UButton>
            </UTooltip>
        </div>
        <ConfirmDialog v-model:open="confirmOpen" :title="`Delete ${deleteName}?`" confirm-label="Delete" :action="doDelete">
            <p>Tranga will stop sending notifications to {{ deleteName }}.</p>
        </ConfirmDialog>
    </SettingsSection>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'add', type: 'Gotify' | 'Ntfy' | 'Pushover' | 'Generic'): void }>();
const { $api } = useNuxtApp();
const api = useTrangaApi();

const { data: connectors } = useApi('/v2/NotificationConnector', { key: FetchKeys.NotificationConnectors.All, server: false });

const testsSupported = ref<boolean>();
const testing = ref<string>();
const results = reactive<Record<string, { ok: boolean; message: string }>>({});
async function sendTest(name: string) {
    testing.value = name;
    try {
        results[name] = await api.call<{ ok: boolean; message: string }>(`v2/ConnectionTests/NotificationConnector/${encodeURIComponent(name)}`, { method: 'POST' });
        testsSupported.value = true;
    } catch (e) {
        if (api.statusOf(e) === 404 && !(e as { data?: unknown }).data) {
            testsSupported.value = false;
            results[name] = { ok: false, message: 'Testing needs a newer Tranga API.' };
        } else results[name] = { ok: false, message: api.messageOf(e) };
    } finally {
        testing.value = undefined;
    }
}

const confirmOpen = ref(false);
const deleteName = ref('');
function askDelete(name: string) {
    deleteName.value = name;
    confirmOpen.value = true;
}
async function doDelete() {
    await $api('/v2/NotificationConnector/{Name}', { path: { Name: deleteName.value }, method: 'DELETE' });
    await refreshNuxtData(FetchKeys.NotificationConnectors.All);
}
</script>
