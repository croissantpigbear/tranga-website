<template>
    <UModal v-model:open="open" :title="`Test ${site}`" :ui="{ content: 'max-w-3xl' }">
        <template #description>
            Paste a link to a manga on {{ rootUrl }}. Tranga reads its details, chapters and the pages of the newest chapter. Nothing is
            saved.
        </template>
        <template #body>
            <div class="flex flex-col gap-3">
                <form class="flex flex-row gap-2" @submit.prevent="run">
                    <UInput v-model="url" class="grow" icon="i-lucide-link" :placeholder="`${rootUrl}/…`" :disabled="busy" />
                    <UButton type="submit" icon="i-lucide-play" :loading="busy" :disabled="!url.trim()">Test</UButton>
                </form>
                <p v-if="busy" class="text-sm text-muted">Running the module… {{ elapsed }}s (sites can be slow; this can take a minute)</p>

                <template v-if="result && !busy">
                    <div
                        :class="[
                            'text-sm rounded-md px-3 py-2 flex items-start gap-2',
                            result.ok && !result.pagesError ? 'bg-success/10 text-success' : result.ok ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error',
                        ]">
                        <UIcon
                            :name="result.ok && !result.pagesError ? 'i-lucide-circle-check' : result.ok ? 'i-lucide-triangle-alert' : 'i-lucide-circle-x'"
                            class="size-4 mt-0.5 shrink-0" />
                        <span v-if="result.ok && !result.pagesError">
                            Works: found the manga, {{ result.chapterCount }} chapters and {{ result.pageCount }} pages in the newest chapter.
                        </span>
                        <span v-else-if="result.ok">Found the manga and {{ result.chapterCount }} chapters, but pages failed: {{ result.pagesError }}</span>
                        <span v-else>{{ result.error }}</span>
                    </div>

                    <div v-if="result.title" class="flex flex-row gap-3">
                        <img v-if="result.coverUrl" :src="result.coverUrl" alt="" class="w-20 aspect-[2/3] object-cover rounded-md bg-elevated shrink-0" referrerpolicy="no-referrer" />
                        <div class="flex flex-col gap-1 min-w-0 text-sm">
                            <p class="font-medium text-base">{{ result.title }}</p>
                            <p v-if="result.authors" class="text-muted">By {{ result.authors }}</p>
                            <p class="text-muted">
                                Status: {{ STATUS[result.status] ?? 'unknown' }}<template v-if="result.genres"> · {{ result.genres }}</template>
                            </p>
                            <p v-if="result.summary" class="text-muted line-clamp-3">{{ result.summary }}</p>
                        </div>
                    </div>

                    <div v-if="result.chapters.length" class="flex flex-col gap-1">
                        <p class="text-sm font-medium">Chapters as Tranga will number them <span class="text-muted font-normal">(first and last few)</span></p>
                        <div class="rounded-md border border-default overflow-x-auto">
                            <table class="w-full text-xs">
                                <thead class="text-dimmed text-left">
                                    <tr><th class="px-2 py-1">Name on site</th><th class="px-2 py-1">Volume</th><th class="px-2 py-1">Chapter</th></tr>
                                </thead>
                                <tbody class="divide-y divide-default">
                                    <tr v-for="c in result.chapters" :key="c.url">
                                        <td class="px-2 py-1 truncate max-w-80" :title="c.url">{{ c.name || '(no name)' }}</td>
                                        <td class="px-2 py-1">{{ c.volume ?? '—' }}</td>
                                        <td class="px-2 py-1 font-medium">{{ c.number }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div v-if="result.samplePages.length" class="flex flex-col gap-1">
                        <p class="text-sm font-medium">First pages of the newest chapter</p>
                        <ul class="text-xs text-muted break-all">
                            <li v-for="p in result.samplePages" :key="p">{{ p }}</li>
                        </ul>
                    </div>

                    <details v-if="result.messages.length || result.requests.length" class="text-xs">
                        <summary class="cursor-pointer text-muted">Details for troubleshooting ({{ result.requests.length }} requests)</summary>
                        <div class="mt-2 flex flex-col gap-2">
                            <div v-if="result.messages.length">
                                <p class="font-medium">Module messages</p>
                                <pre class="whitespace-pre-wrap break-all bg-elevated rounded p-2">{{ result.messages.join('\n') }}</pre>
                            </div>
                            <div v-if="result.requests.length">
                                <p class="font-medium">Requests</p>
                                <pre class="whitespace-pre-wrap break-all bg-elevated rounded p-2">{{ result.requests.join('\n') }}</pre>
                            </div>
                        </div>
                    </details>
                </template>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
interface TestResult {
    ok: boolean;
    error?: string | null;
    title: string;
    coverUrl: string;
    status: string;
    authors: string;
    genres: string;
    summary: string;
    chapterCount: number;
    chapters: { name: string; number: string; volume?: number | null; url: string }[];
    pageCount: number;
    samplePages: string[];
    pagesError?: string | null;
    messages: string[];
    requests: string[];
}

const props = defineProps<{ site: string; rootUrl: string }>();
const open = defineModel<boolean>('open', { default: false });
const api = useTrangaApi();

const STATUS: Record<string, string> = { '0': 'completed', '1': 'ongoing', '2': 'hiatus', '3': 'cancelled' };
const url = ref('');
const busy = ref(false);
const elapsed = ref(0);
const result = ref<TestResult>();

watch(open, (o) => {
    if (o && props.site) result.value = undefined;
});

async function run() {
    busy.value = true;
    elapsed.value = 0;
    const timer = setInterval(() => elapsed.value++, 1000);
    try {
        result.value = await api.call<TestResult>(`v2/LuaModules/Sites/${encodeURIComponent(props.site)}/Test`, {
            method: 'POST',
            body: { url: url.value.trim() },
        });
    } catch (e) {
        result.value = {
            ok: false, error: api.messageOf(e), title: '', coverUrl: '', status: '', authors: '', genres: '', summary: '',
            chapterCount: 0, chapters: [], pageCount: 0, samplePages: [], messages: [], requests: [],
        };
    } finally {
        clearInterval(timer);
        busy.value = false;
    }
}
</script>
