<template>
    <UModal v-model:open="open" :title="title" :dismissible="!busy" :close="!busy">
        <template #body>
            <div class="flex flex-col gap-3 text-sm">
                <slot />
            </div>
        </template>
        <template #footer>
            <div class="flex flex-row justify-end gap-2 w-full">
                <UButton variant="outline" color="neutral" :disabled="busy" @click="open = false">Cancel</UButton>
                <UButton :color="color" :icon="icon" :loading="busy" @click="confirm">{{ confirmLabel }}</UButton>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        title: string;
        confirmLabel: string;
        icon?: string;
        color?: 'error' | 'primary' | 'warning';
        /** Called on confirm; the dialog closes when it resolves (stays open if it throws) */
        action: () => Promise<unknown> | unknown;
    }>(),
    { color: 'error', icon: 'i-lucide-trash-2' }
);
const open = defineModel<boolean>('open', { default: false });
const busy = ref(false);

async function confirm() {
    busy.value = true;
    try {
        await props.action();
        open.value = false;
    } catch {
        /* the action shows its own error; keep the dialog open */
    } finally {
        busy.value = false;
    }
}
</script>
