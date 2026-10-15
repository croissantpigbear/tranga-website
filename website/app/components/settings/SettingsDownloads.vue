<template>
    <SettingsSection title="Downloads" icon="i-lucide-download" description="Which translation to download, and how to store the images.">
        <template v-if="settings">
            <UFormField label="Download language" description="Chapters in this language are downloaded (where the website offers it).">
                <div class="flex flex-row flex-wrap items-center gap-2">
                    <USelectMenu v-model="language" :items="languageItems" value-key="value" class="w-64" @update:model-value="saveLanguage" />
                    <SettingsSaveStatus :state="languageSave.state.value" :error="languageSave.error.value" />
                </div>
            </UFormField>

            <UFormField label="Image compression" description="Re-compress pages as JPEG to save space. Lower quality = smaller files.">
                <div class="flex flex-col gap-2">
                    <USwitch v-model="compress" label="Compress images" @update:model-value="saveCompressionDebounced" />
                    <div v-if="compress" class="flex flex-row items-center gap-3 max-w-md">
                        <span class="text-xs text-muted w-16">Smaller</span>
                        <USlider v-model="quality" :min="1" :max="99" class="grow" @update:model-value="saveCompressionDebounced" />
                        <span class="text-xs text-muted w-16 text-right">Better</span>
                        <UBadge variant="subtle" color="neutral" class="w-14 justify-center">{{ quality }}</UBadge>
                    </div>
                    <p v-if="compress" class="text-xs text-muted">Around 40–60 is usually a good balance. Only affects new downloads.</p>
                    <SettingsSaveStatus :state="compressionSave.state.value" :error="compressionSave.error.value" />
                </div>
            </UFormField>

            <UFormField label="Black & white" description="Convert pages to greyscale — saves more space; fine for most manga, not for colour comics.">
                <div class="flex flex-row items-center gap-2">
                    <USwitch v-model="blackWhite" label="Convert to black & white" @update:model-value="saveBlackWhite" />
                    <SettingsSaveStatus :state="bwSave.state.value" :error="bwSave.error.value" />
                </div>
            </UFormField>
        </template>
        <USkeleton v-else class="h-32 w-full" />
    </SettingsSection>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type TrangaSettings = components['schemas']['TrangaSettings'];

const props = defineProps<{ settings?: TrangaSettings | null }>();
const api = useTrangaApi();

const LANGUAGES: [string, string][] = [
    ['en', 'English'],
    ['es', 'Spanish'],
    ['es-la', 'Spanish (Latin America)'],
    ['pt-br', 'Portuguese (Brazil)'],
    ['pt', 'Portuguese'],
    ['fr', 'French'],
    ['de', 'German'],
    ['it', 'Italian'],
    ['ru', 'Russian'],
    ['uk', 'Ukrainian'],
    ['pl', 'Polish'],
    ['tr', 'Turkish'],
    ['id', 'Indonesian'],
    ['vi', 'Vietnamese'],
    ['th', 'Thai'],
    ['ar', 'Arabic'],
    ['ja', 'Japanese'],
    ['ko', 'Korean'],
    ['zh', 'Chinese (simplified)'],
    ['zh-hk', 'Chinese (traditional)'],
];
const language = ref<string>();
const languageItems = computed(() => {
    const items = LANGUAGES.map(([value, name]) => ({ value, label: `${name} (${value})` }));
    if (language.value && !items.some((i) => i.value === language.value)) items.unshift({ value: language.value, label: language.value });
    return items;
});

const compress = ref(false);
const quality = ref(40);
const blackWhite = ref(false);

watch(
    () => props.settings,
    (s) => {
        if (!s) return;
        language.value = s.downloadLanguage;
        compress.value = s.imageCompression < 100;
        quality.value = s.imageCompression < 100 ? s.imageCompression : 40;
        blackWhite.value = s.blackWhiteImages;
    },
    { immediate: true }
);

const languageSave = useSaveState();
function saveLanguage() {
    if (!language.value) return;
    languageSave.run(() => api.call(`v2/Settings/DownloadLanguage/${encodeURIComponent(language.value!)}`, { method: 'PATCH' }));
}

const compressionSave = useSaveState();
let compressionTimer: ReturnType<typeof setTimeout> | undefined;
function saveCompressionDebounced() {
    clearTimeout(compressionTimer);
    compressionTimer = setTimeout(() => {
        const level = compress.value ? Math.min(99, Math.max(1, quality.value)) : 100; // 100 = off
        compressionSave.run(() => api.call(`v2/Settings/ImageCompressionLevel/${level}`, { method: 'PATCH' }));
    }, 500);
}

const bwSave = useSaveState();
function saveBlackWhite() {
    bwSave.run(() => api.call(`v2/Settings/BWImages/${blackWhite.value}`, { method: 'PATCH' }));
}
</script>
