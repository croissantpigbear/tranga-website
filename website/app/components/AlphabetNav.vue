<template>
    <nav
        aria-label="Jump to letter"
        class="fixed right-0 z-30 flex flex-col items-center select-none touch-none py-1 px-0.5 rounded-l-lg bg-default/70 backdrop-blur"
        :style="{ top: 'calc(var(--ui-header-height) + 3.5rem)', bottom: '0.5rem' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp">
        <button
            v-for="l in ALPHA_LETTERS"
            :key="l"
            type="button"
            :data-letter="l"
            :aria-disabled="!available.has(l)"
            :tabindex="available.has(l) ? 0 : -1"
            :aria-label="l === '#' ? 'Numbers and other' : `Letter ${l}`"
            :class="[
                'flex-1 min-h-0 w-6 max-sm:w-5 flex items-center justify-center text-xs max-sm:text-[0.65rem] font-semibold leading-none rounded transition-colors',
                active === l
                    ? 'bg-primary text-inverted'
                    : available.has(l)
                      ? 'text-toned hover:text-primary hover:bg-elevated cursor-pointer'
                      : 'text-dimmed/50 cursor-default',
            ]"
            @click="(e: MouseEvent) => e.detail === 0 && jump(l)">
            {{ l }}
        </button>
    </nav>
</template>

<script setup lang="ts">
import { ALPHA_LETTERS, type AlphaLetter } from '~/utils/alphaIndex';

const props = defineProps<{ letters: Iterable<AlphaLetter> }>();
const emit = defineEmits<{ (e: 'jump', letter: AlphaLetter): void }>();

const available = computed(() => new Set(props.letters));
const active = ref<AlphaLetter>();
let activeTimer: ReturnType<typeof setTimeout> | undefined;
let scrubbing = false;

function jump(l: AlphaLetter) {
    if (!available.value.has(l)) return;
    active.value = l;
    clearTimeout(activeTimer);
    activeTimer = setTimeout(() => (active.value = undefined), 800);
    emit('jump', l);
}

/** Letter under the pointer; if it has no manga, the nearest following letter that does */
function letterAt(e: PointerEvent): AlphaLetter | undefined {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-letter]') as HTMLElement | null;
    const l = el?.dataset.letter as AlphaLetter | undefined;
    if (!l) return undefined;
    const i = ALPHA_LETTERS.indexOf(l);
    return ALPHA_LETTERS.slice(i).find((x) => available.value.has(x)) ?? [...ALPHA_LETTERS].reverse().find((x) => available.value.has(x));
}

// Press, or press and drag to scrub (mouse or touch), like a phone's contact list
function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    scrubbing = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    // Jump on press (clicks can be swallowed by the pointer capture); keyboard uses the click handler
    const l = letterAt(e);
    if (l) jump(l);
}
function onPointerMove(e: PointerEvent) {
    if (!scrubbing) return;
    const l = letterAt(e);
    if (l && l !== active.value) jump(l);
}
function onPointerUp() {
    scrubbing = false;
}

onBeforeUnmount(() => clearTimeout(activeTimer));
</script>
