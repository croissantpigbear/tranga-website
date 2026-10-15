<template>
    <SettingsSection
        title="More websites (FMD2)"
        icon="i-lucide-puzzle"
        description="Add websites Tranga doesn't support by uploading the site's script from Free Manga Downloader 2.">
        <div class="flex flex-row flex-wrap items-center gap-3">
            <p class="text-sm grow">
                <template v-if="count === null">This needs a newer Tranga API.</template>
                <template v-else-if="count === undefined">…</template>
                <template v-else-if="count === 0">No extra websites added yet.</template>
                <template v-else>
                    <span class="font-medium">{{ count }}</span> extra {{ count === 1 ? 'website' : 'websites' }}:
                    <span class="text-muted">{{ names.join(', ') }}</span>
                </template>
            </p>
            <UButton icon="i-lucide-puzzle" to="/fmd-modules?return=/settings" :disabled="count === null">Manage websites</UButton>
        </div>
    </SettingsSection>
</template>

<script setup lang="ts">
const api = useTrangaApi();
const count = ref<number | null>();
const names = ref<string[]>([]);
onMounted(async () => {
    try {
        const o = await api.call<{ modules: { sites: { name: string }[] }[] }>('v2/LuaModules');
        names.value = o.modules.flatMap((m) => m.sites.map((s) => s.name));
        count.value = names.value.length;
    } catch {
        count.value = null;
    }
});
</script>
