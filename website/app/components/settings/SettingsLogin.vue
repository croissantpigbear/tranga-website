<template>
    <SettingsSection
        title="Login"
        icon="i-lucide-lock"
        description="Ask for a user name and password before anyone can use Tranga. Off by default; worth switching on if other people can reach Tranga on your network.">
        <p v-if="status === null" class="text-sm text-warning">The login needs a newer Tranga API (the login update).</p>
        <USkeleton v-else-if="!status" class="h-24 w-full" />
        <template v-else>
            <UAlert
                v-if="status.forcedOff"
                color="warning"
                variant="subtle"
                icon="i-lucide-triangle-alert"
                title="The login is switched off by TRANGA_DISABLE_LOGIN"
                description="Remove TRANGA_DISABLE_LOGIN from the API's environment (docker-compose) and restart it to use the login again." />

            <!-- Off: switch on -->
            <template v-if="!status.enabled">
                <p class="text-sm flex items-center gap-2">
                    <UBadge color="neutral" variant="subtle">Off</UBadge>Anyone who can open this website can use Tranga.
                </p>
                <div class="grid grid-cols-1 min-md:grid-cols-2 gap-3">
                    <UFormField label="User name">
                        <UInput v-model="username" autocomplete="username" class="w-full" />
                    </UFormField>
                    <UFormField label="Password" description="At least 8 characters.">
                        <UInput v-model="password" type="password" autocomplete="new-password" class="w-full" />
                    </UFormField>
                </div>
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <UButton icon="i-lucide-lock" :loading="busy === 'on'" :disabled="!username || password.length < 8" @click="setCredentials('on')">
                        Switch login on
                    </UButton>
                    <span class="text-xs text-muted">You stay logged in on this browser.</span>
                </div>
            </template>

            <!-- On -->
            <template v-else>
                <p class="text-sm flex items-center gap-2">
                    <UBadge color="success" variant="subtle">On</UBadge>Logged in as <span class="font-medium">{{ status.username }}</span>.
                </p>

                <details class="rounded-lg border border-default p-3 group">
                    <summary class="cursor-pointer text-sm font-medium">Change user name or password</summary>
                    <div class="grid grid-cols-1 min-md:grid-cols-3 gap-3 mt-3">
                        <UFormField label="Current password">
                            <UInput v-model="currentPassword" type="password" autocomplete="current-password" class="w-full" />
                        </UFormField>
                        <UFormField label="User name">
                            <UInput v-model="username" autocomplete="username" class="w-full" />
                        </UFormField>
                        <UFormField label="New password" description="At least 8 characters.">
                            <UInput v-model="password" type="password" autocomplete="new-password" class="w-full" />
                        </UFormField>
                    </div>
                    <UButton
                        class="mt-3"
                        size="sm"
                        icon="i-lucide-check"
                        :loading="busy === 'change'"
                        :disabled="!currentPassword || !username || password.length < 8"
                        @click="setCredentials('change')">
                        Save (logs out other browsers)
                    </UButton>
                </details>

                <div class="rounded-lg border border-default p-3 flex flex-col gap-2">
                    <p class="text-sm font-medium">API key for other apps</p>
                    <p class="text-xs text-muted">
                        For apps or scripts that talk to the Tranga API directly. Send it as <code>Authorization: Bearer &lt;key&gt;</code> or
                        <code>X-Api-Key</code>.
                        <template v-if="status.apiKeySet"> A key exists (made {{ formatDate(status.apiKeyCreatedUtc) }}).</template>
                    </p>
                    <div v-if="newKey" class="flex flex-row flex-wrap items-center gap-2">
                        <code class="text-xs break-all rounded bg-elevated px-2 py-1">{{ newKey }}</code>
                        <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copy">Copy</UButton>
                        <span class="text-xs text-warning">Copy it now; it isn't shown again.</span>
                    </div>
                    <div class="flex flex-row flex-wrap gap-2">
                        <UButton size="sm" variant="soft" icon="i-lucide-key-round" :loading="busy === 'key'" @click="createKey">
                            {{ status.apiKeySet ? 'Make a new key' : 'Make a key' }}
                        </UButton>
                        <UButton v-if="status.apiKeySet" size="sm" variant="ghost" color="error" icon="i-lucide-trash-2" :loading="busy === 'delkey'" @click="deleteKey">
                            Delete key
                        </UButton>
                    </div>
                </div>

                <div class="flex flex-row flex-wrap gap-2">
                    <UButton size="sm" variant="soft" color="neutral" icon="i-lucide-log-out" @click="auth.logout()">Log out</UButton>
                    <UButton size="sm" variant="soft" color="error" icon="i-lucide-lock-open" :loading="busy === 'off'" @click="disable">
                        Switch login off
                    </UButton>
                </div>
                <p class="text-xs text-muted">
                    Forgot the password? Restart the API with <code>TRANGA_DISABLE_LOGIN=true</code> in its environment, or delete
                    <code>auth.json</code> from its settings folder.
                </p>
            </template>
            <p v-if="error" class="text-sm text-error flex items-start gap-1">
                <UIcon name="i-lucide-circle-x" class="size-4 mt-0.5 shrink-0" />{{ error }}
            </p>
        </template>
    </SettingsSection>
</template>

<script setup lang="ts">
import type { AuthStatus } from '~/composables/useAuth';

const auth = useAuth();
const api = useTrangaApi();
const toast = useToast();

/** undefined = loading, null = older API */
const status = ref<AuthStatus | null>();
const username = ref('');
const password = ref('');
const currentPassword = ref('');
const busy = ref<string>();
const error = ref<string>();
const newKey = ref<string>();

onMounted(async () => {
    status.value = await auth.refresh(true);
    username.value = status.value?.username ?? '';
});

function take(s: AuthStatus) {
    status.value = s;
    auth.set(s);
}

async function run(key: string, fn: () => Promise<void>) {
    busy.value = key;
    error.value = undefined;
    try {
        await fn();
    } catch (e) {
        const code = api.statusOf(e);
        error.value = code === 401 ? 'The current password is wrong.' : api.messageOf(e);
    } finally {
        busy.value = undefined;
    }
}

const setCredentials = (key: 'on' | 'change') =>
    run(key, async () => {
        take(
            await api.call<AuthStatus>('v2/Auth/Credentials', {
                method: 'POST',
                body: { username: username.value, password: password.value, currentPassword: currentPassword.value || null },
            })
        );
        password.value = '';
        currentPassword.value = '';
        toast.add({ title: key === 'on' ? 'Login switched on' : 'Login details changed', color: 'success', icon: 'i-lucide-check' });
    });

const disable = () =>
    run('off', async () => {
        take(await api.call<AuthStatus>('v2/Auth/Disable', { method: 'POST' }));
        newKey.value = undefined;
        toast.add({ title: 'Login switched off', color: 'success', icon: 'i-lucide-check' });
    });

const createKey = () =>
    run('key', async () => {
        newKey.value = (await api.call<{ apiKey: string }>('v2/Auth/ApiKey', { method: 'POST' })).apiKey;
        status.value = await auth.refresh(true);
    });

const deleteKey = () =>
    run('delkey', async () => {
        take(await api.call<AuthStatus>('v2/Auth/ApiKey', { method: 'DELETE' }));
        newKey.value = undefined;
    });

async function copy() {
    if (!newKey.value) return;
    await navigator.clipboard.writeText(newKey.value);
    toast.add({ title: 'Copied', color: 'success', icon: 'i-lucide-check' });
}

const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
</script>
