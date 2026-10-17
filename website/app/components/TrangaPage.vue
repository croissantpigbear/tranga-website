<template>
    <!-- Wide screens: fixed to the window, each column scrolls; phones: one page that scrolls normally -->
    <UPageBody
        v-bind="$props"
        class="mt-0 pb-0 min-md:h-[calc(100dvh-var(--ui-header-height))] relative min-xl:overflow-clip">
        <div class="flex min-md:flex-row max-md:flex-col max-md:gap-0 gap-4 min-md:h-full relative">
            <div
                v-if="$slots.left"
                class="flex flex-col gap-2 bg-elevated min-md:w-3/7 min-xl:w-2/7 max-md:w-full py-4 min-md:pl-4 min-md:pr-2 max-md:px-3 min-md:overflow-y-auto">
                <slot name="left" />
            </div>
            <div class="flex flex-col gap-2 w-full min-md:h-full py-4 relative min-w-0">
                <div :class="['w-full flex flex-row flex-wrap justify-between gap-2', $slots.left ? 'min-md:pr-4 max-md:px-3' : 'px-4 max-sm:px-3']">
                    <div class="flex flex-row flex-wrap items-center gap-x-6 gap-y-2 min-w-0">
                        <UButton
                            variant="outline"
                            color="neutral"
                            :to="backUrl ?? '/'"
                            :icon="backUrl ? 'i-lucide-arrow-left' : 'i-lucide-home'"
                            >{{ backUrl ? 'Back' : 'Home' }}</UButton
                        >
                        <slot name="title">
                            <p v-if="title" class="text-2xl text-primary font-semibold">{{ title }}</p>
                        </slot>
                    </div>
                    <div class="flex flex-row flex-wrap gap-2">
                        <slot name="actions" />
                    </div>
                </div>
                <div
                    :class="[
                        $slots.left ? (rimless ? '' : 'min-md:mr-4 max-md:mx-3') : rimless ? '' : 'mx-4 max-sm:mx-3',
                        'min-md:h-full min-md:overflow-y-auto',
                    ]">
                    <div
                        v-if="$slots.center"
                        class="flex flex-row max-md:flex-wrap max-md:justify-center gap-2 w-full min-md:justify-center max-md:items-center">
                        <slot name="center" />
                    </div>
                    <slot />
                </div>
            </div>
        </div>
    </UPageBody>
</template>

<script setup lang="ts">
import type { PageBodyProps } from '#ui/components/PageBody.vue';

const route = useRoute();
const backUrl = route.query.return as string | undefined;

export interface PageProps extends PageBodyProps {
    title?: string;
    rimless?: boolean;
}

defineProps<PageProps>();
</script>
