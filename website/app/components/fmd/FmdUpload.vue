<template>
    <div class="flex flex-col gap-3">
        <label
            :class="[
                'rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors',
                dragging ? 'border-primary bg-primary/10' : 'border-default hover:border-primary/60 hover:bg-elevated/50',
            ]"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop">
            <UIcon name="i-lucide-file-up" class="size-8 text-primary" />
            <span class="font-medium">Drop .lua files here, or click to choose</span>
            <span class="text-xs text-muted">Modules, templates and helpers — several at once is fine. Tranga works out which is which.</span>
            <input ref="picker" type="file" accept=".lua" multiple class="hidden" @change="onPick" />
        </label>

        <div v-if="queue.length" class="flex flex-col gap-2">
            <div v-for="f in queue" :key="f.name" class="rounded-md bg-elevated px-3 py-2 flex flex-row flex-wrap items-center gap-2">
                <UIcon name="i-lucide-file-code" class="size-4 text-muted shrink-0" />
                <span class="text-sm font-medium grow min-w-0 truncate">{{ f.name }}</span>
                <USelect v-model="f.kind" :items="KINDS" value-key="value" size="xs" class="w-40" :disabled="busy || !!f.result" />
                <template v-if="f.result">
                    <UBadge v-if="f.result.error" color="error" variant="subtle" icon="i-lucide-circle-x">Failed</UBadge>
                    <UBadge v-else color="success" variant="subtle" icon="i-lucide-circle-check">
                        {{ f.result.sites.length ? `Added ${f.result.sites.join(', ')}` : `Saved as ${f.result.kind}` }}
                    </UBadge>
                </template>
                <UButton v-else size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :disabled="busy" @click="remove(f.name)" />
                <p v-if="f.result?.error" class="w-full text-xs text-error">{{ f.result.error }}</p>
                <ul v-if="f.result?.warnings.length" class="w-full text-xs text-warning flex flex-col gap-0.5">
                    <li v-for="w in f.result.warnings" :key="w" class="flex items-start gap-1">
                        <UIcon name="i-lucide-triangle-alert" class="size-3.5 mt-px shrink-0" />{{ w }}
                    </li>
                </ul>
            </div>
            <div class="flex flex-row items-center gap-2">
                <UButton icon="i-lucide-upload" :loading="busy" :disabled="!pending.length" @click="uploadAll">
                    Upload {{ pending.length || '' }} {{ pending.length === 1 ? 'file' : 'files' }}
                </UButton>
                <UButton variant="ghost" color="neutral" :disabled="busy" @click="queue = []">Clear list</UButton>
                <span v-if="busy" class="text-sm text-muted">Uploading {{ done }} of {{ total }}…</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
export interface UploadResult {
    fileName: string;
    kind: string;
    error?: string | null;
    sites: string[];
    warnings: string[];
}
interface QueuedFile {
    name: string;
    content: string;
    kind: string;
    result?: UploadResult;
}

const emit = defineEmits<{ (e: 'uploaded'): void }>();
const api = useTrangaApi();

const KINDS = [
    { value: 'auto', label: 'Detect automatically' },
    { value: 'module', label: 'Module (a website)' },
    { value: 'template', label: 'Template' },
    { value: 'helper', label: 'Helper (utils)' },
];

const dragging = ref(false);
const queue = ref<QueuedFile[]>([]);
const busy = ref(false);
const done = ref(0);
const total = ref(0);
const pending = computed(() => queue.value.filter((f) => !f.result));
const picker = ref<HTMLInputElement>();

async function add(files: FileList | File[]) {
    for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.lua')) continue;
        if (file.size > 1024 * 1024) continue;
        const content = await file.text();
        queue.value = [...queue.value.filter((f) => f.name !== file.name), { name: file.name, content, kind: guessKind(content) }];
    }
}
function onDrop(e: DragEvent) {
    dragging.value = false;
    if (e.dataTransfer?.files) add(e.dataTransfer.files);
}
function onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) add(input.files);
    input.value = '';
}
const remove = (name: string) => (queue.value = queue.value.filter((f) => f.name !== name));

/** Same rules as the API, so the dropdown shows what will happen */
function guessKind(content: string): string {
    if (/function\s+Init\s*\(/.test(content) && content.includes('NewWebsiteModule')) return 'module';
    if (/local\s+_M\s*=\s*\{\s*\}/.test(content) && /function\s+_M\.(GetInfo|GetPageNumber|GetNameAndLink)/.test(content)) return 'template';
    return 'helper';
}

async function uploadAll() {
    busy.value = true;
    done.value = 0;
    // Templates and helpers first, so modules that need them load
    const order = { helper: 0, template: 1, auto: 2, module: 3 } as Record<string, number>;
    const files = [...pending.value].sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2));
    total.value = files.length;
    for (const f of files) {
        try {
            f.result = await api.call<UploadResult>('v2/LuaModules/Upload', {
                method: 'POST',
                body: { fileName: f.name, content: f.content, kind: f.kind === 'auto' ? null : f.kind },
            });
        } catch (e) {
            f.result = { fileName: f.name, kind: f.kind, error: api.messageOf(e), sites: [], warnings: [] };
        }
        done.value++;
    }
    busy.value = false;
    emit('uploaded');
}
</script>
