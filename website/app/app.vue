<template>
    <UApp>
        <UHeader :toggle="true">
            <template #left>
                <NuxtLink to="/">
                    <div class="h-full flex gap-2 items-center">
                        <img src="/blahaj.png" class="h-lh cursor-grab" alt="Blahaj" />
                        <p
                            style="
                                background: linear-gradient(110deg, var(--color-pink), var(--color-blue));
                                background-clip: text;
                                -webkit-background-clip: text;
                                -webkit-text-fill-color: transparent;
                            "
                            class="font-bold cursor-pointer text-3xl max-sm:text-2xl">
                            Tranga
                        </p>
                    </div>
                </NuxtLink>
            </template>
            <template #body>
                <!-- Phone menu: pages whose header buttons are hidden on small screens, then the links -->
                <UNavigationMenu :items="[...phoneItems, ...items]" orientation="vertical" variant="link" color="neutral" />
            </template>
            <template #default>
                <UNavigationMenu :items="items" orientation="horizontal" variant="link" color="neutral" />
            </template>
            <template #right>
                <UTooltip text="What Tranga has been doing (downloads, checks, …)">
                    <UButton
                        class="max-sm:hidden"
                        icon="i-lucide-brick-wall-shield"
                        :to="`/actions?return=${$route.fullPath}`"
                        :disabled="$route.fullPath.startsWith('/actions')"
                        variant="soft"
                        color="secondary">
                        <span class="max-lg:hidden">Activity</span>
                    </UButton>
                </UTooltip>
                <UTooltip text="New chapters by day, and what's expected next">
                    <UButton
                        class="max-sm:hidden"
                        icon="i-lucide-calendar-days"
                        to="/calendar"
                        variant="soft"
                        color="secondary"
                        aria-label="Release calendar">
                        <span class="max-lg:hidden">Calendar</span>
                    </UButton>
                </UTooltip>
                <UButton icon="i-lucide-plus" to="/search" color="primary">
                    <template #default>
                        <span class="max-sm:hidden">Add manga</span>
                    </template>
                </UButton>
                <UTooltip text="Switch light / dark mode">
                    <UColorModeButton color="secondary" class="max-sm:hidden" />
                </UTooltip>
                <UButton icon="i-lucide-settings" variant="ghost" to="/settings" color="secondary" aria-label="Settings">
                    <span class="max-lg:hidden">Settings</span>
                </UButton>
                <UTooltip v-if="auth.status.value?.enabled && auth.status.value.loggedIn" :text="`Log out ${auth.status.value.username ?? ''}`">
                    <UButton icon="i-lucide-log-out" variant="ghost" color="secondary" aria-label="Log out" @click="auth.logout()" />
                </UTooltip>
            </template>
        </UHeader>
        <UMain>
            <UPage>
                <NuxtPage />
            </UPage>
        </UMain>
    </UApp>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '#ui/components/NavigationMenu.vue';

const auth = useAuth();

const colorMode = useColorMode();
const phoneItems = computed<NavigationMenuItem[]>(() => [
    { label: 'Activity', to: '/actions', icon: 'i-lucide-brick-wall-shield', class: 'min-sm:hidden' },
    { label: 'Release calendar', to: '/calendar', icon: 'i-lucide-calendar-days', class: 'min-sm:hidden' },
    {
        label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
        icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
        class: 'min-sm:hidden',
        onSelect: () => (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'),
    },
]);

const items = computed<NavigationMenuItem[]>(() => [
    { label: 'API', to: 'https://github.com/C9Glax/tranga', icon: 'i-lucide-github', target: '_blank' },
    { label: 'Website', to: 'https://github.com/C9Glax/tranga-website', icon: 'i-lucide-github', target: '_blank' },
    { label: 'Swagger', to: `${useRuntimeConfig().public.openFetch.api.baseURL}swagger`, icon: 'i-lucide-book-open', target: '_blank' },
]);
</script>
