<template>
    <div class="min-h-[70vh] flex items-center justify-center p-4">
        <UCard class="w-full max-w-sm">
            <template #header>
                <div class="flex flex-row items-center gap-2">
                    <UIcon name="i-lucide-lock" class="size-5 text-primary" />
                    <h1 class="font-semibold text-lg">Log in to Tranga</h1>
                </div>
            </template>
            <form class="flex flex-col gap-4" @submit.prevent="submit">
                <UFormField label="User name">
                    <UInput v-model="username" autocomplete="username" autofocus class="w-full" />
                </UFormField>
                <UFormField label="Password">
                    <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
                </UFormField>
                <UCheckbox v-model="remember" label="Stay logged in for 30 days" />
                <p v-if="error" class="text-sm text-error flex items-start gap-1">
                    <UIcon name="i-lucide-circle-x" class="size-4 mt-0.5 shrink-0" />{{ error }}
                </p>
                <UButton type="submit" :loading="busy" :disabled="!username || !password" block>Log in</UButton>
                <p class="text-xs text-muted">
                    Forgot the password? Restart the Tranga API with <code>TRANGA_DISABLE_LOGIN=true</code> in its environment, or delete
                    <code>auth.json</code> from its settings folder.
                </p>
            </form>
        </UCard>
    </div>
</template>

<script setup lang="ts">
const route = useRoute();
const auth = useAuth();
const api = useTrangaApi();

const username = ref('');
const password = ref('');
const remember = ref(true);
const busy = ref(false);
const error = ref<string>();

const target = computed(() => {
    const r = typeof route.query.return === 'string' ? route.query.return : '/';
    return r.startsWith('/') && !r.startsWith('/login') ? r : '/';
});

onMounted(async () => {
    const s = await auth.refresh(true);
    if (!s?.enabled || s.loggedIn) await navigateTo(target.value);
});

async function submit() {
    busy.value = true;
    error.value = undefined;
    try {
        await auth.login(username.value, password.value, remember.value);
        refreshNuxtData();
        await navigateTo(target.value);
    } catch (e) {
        const status = api.statusOf(e);
        error.value =
            status === 401 ? 'Wrong user name or password.' : status === 429 ? api.messageOf(e) : `Couldn't log in (${api.messageOf(e)}).`;
        password.value = '';
    } finally {
        busy.value = false;
    }
}

useHead({ title: 'Log in' });
</script>
