/** Small helper for "Saving… / Saved / error" next to a setting */
export function useSaveState() {
    const state = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const error = ref('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function run(fn: () => Promise<unknown>) {
        state.value = 'saving';
        error.value = '';
        clearTimeout(timer);
        try {
            await fn();
            state.value = 'saved';
            timer = setTimeout(() => (state.value = 'idle'), 2500);
            return true;
        } catch (e) {
            const err = e as { data?: unknown; message?: string };
            error.value = typeof err?.data === 'string' && err.data ? err.data : (err?.message ?? 'Not saved');
            state.value = 'error';
            return false;
        }
    }
    return { state, error, run };
}
