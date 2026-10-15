<template>
    <UModal v-model:open="open" :title="`Delete ${countLabel}?`" :dismissible="!busy" :close="!busy">
        <template #body>
            <div class="flex flex-col gap-3">
                <p class="text-sm">
                    This removes the selected manga from Tranga, together with their chapter records and download settings. Tranga will
                    stop checking them for new chapters.
                </p>
                <UAlert
                    color="info"
                    variant="subtle"
                    icon="i-lucide-hard-drive"
                    title="Downloaded files are kept"
                    description="Chapters already downloaded (.cbz files) stay in your library folder. Delete them there if you no longer want them." />
                <ul class="max-h-56 overflow-y-auto rounded-md bg-elevated px-4 py-2 text-sm list-disc list-inside">
                    <li v-for="m in manga" :key="m.key" class="truncate">{{ m.name }}</li>
                </ul>
                <p v-if="busy" class="text-sm text-muted">Deleting {{ done + 1 }} of {{ manga.length }}…</p>
            </div>
        </template>
        <template #footer>
            <div class="flex flex-row justify-end gap-2 w-full">
                <UButton variant="outline" color="neutral" :disabled="busy" @click="open = false">Cancel</UButton>
                <UButton color="error" icon="i-lucide-trash-2" :loading="busy" :disabled="manga.length === 0" @click="deleteAll">
                    Delete {{ countLabel }}
                </UButton>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
import type { components } from '#open-fetch-schemas/api';
type Manga = components['schemas']['Manga'];
type MinimalManga = components['schemas']['MinimalManga'];

const props = defineProps<{ manga: (MinimalManga | Manga)[] }>();
const emit = defineEmits<{ (e: 'deleted', keys: string[]): void }>();
const open = defineModel<boolean>('open', { default: false });

const { $api } = useNuxtApp();
const toast = useToast();

const busy = ref(false);
const done = ref(0);
const countLabel = computed(() => (props.manga.length === 1 ? '1 manga' : `${props.manga.length} manga`));

async function deleteAll() {
    busy.value = true;
    done.value = 0;
    const total = props.manga.length;
    const deleted: string[] = [];
    const failed: string[] = [];
    // One at a time, so a large selection doesn't flood the API / database
    for (const m of [...props.manga]) {
        try {
            await $api('/v2/Manga/{MangaId}', { path: { MangaId: m.key }, method: 'DELETE' });
            deleted.push(m.key);
        } catch {
            failed.push(m.name);
        }
        done.value++;
    }
    busy.value = false;

    if (deleted.length) {
        await refreshNuxtData(FetchKeys.Manga.All);
        emit('deleted', deleted);
    }
    if (failed.length) {
        toast.add({
            title: `Couldn't delete ${failed.length} of ${total}`,
            description: failed.join(', '),
            color: 'error',
            icon: 'i-lucide-circle-x',
        });
    } else {
        toast.add({ title: `Deleted ${deleted.length === 1 ? '1 manga' : `${deleted.length} manga`}`, color: 'success', icon: 'i-lucide-check' });
        open.value = false;
    }
}
</script>
