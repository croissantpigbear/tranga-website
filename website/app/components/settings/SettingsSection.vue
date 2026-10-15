<template>
    <UCard :ui="{ body: 'flex flex-col gap-5' }">
        <template #header>
            <div class="flex flex-row items-center gap-2">
                <UIcon :name="icon" class="size-5 text-primary" />
                <h2 class="font-semibold text-lg">{{ title }}</h2>
            </div>
            <p v-if="description" class="text-sm text-muted mt-1">{{ description }}</p>
        </template>
        <slot />
    </UCard>
</template>

<script setup lang="ts">
defineProps<{ title: string; icon: string; description?: string }>();
</script>
