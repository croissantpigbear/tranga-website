<template>
    <UTooltip :text="copied ? 'Copied' : label">
        <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :aria-label="label"
            class="shrink-0 -my-1"
            @click="copy" />
    </UTooltip>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ text: string; label?: string }>(), { label: 'Copy' });
const copied = ref(false);

async function copy() {
    try {
        await navigator.clipboard.writeText(props.text);
    } catch {
        // Clipboard API needs https; fall back for plain http on the home network
        const area = document.createElement('textarea');
        area.value = props.text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
}
</script>
