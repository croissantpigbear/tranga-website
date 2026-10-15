<template>
    <span v-if="state === 'saving'" class="text-xs text-muted flex items-center gap-1"><UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />Saving…</span>
    <span v-else-if="state === 'saved'" class="text-xs text-success flex items-center gap-1"><UIcon name="i-lucide-check" class="size-3.5" />Saved</span>
    <span v-else-if="state === 'error'" class="text-xs text-error flex items-center gap-1"><UIcon name="i-lucide-circle-x" class="size-3.5" />{{ error || 'Not saved' }}</span>
</template>

<script setup lang="ts">
defineProps<{ state?: 'idle' | 'saving' | 'saved' | 'error'; error?: string }>();
</script>
