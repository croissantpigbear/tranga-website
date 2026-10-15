<template>
    <TrangaPage>
        <template #title>
            <p class="text-2xl font-semibold">Websites from FMD2</p>
        </template>
        <div class="max-w-5xl mx-auto w-full flex flex-col gap-5 pb-10">
            <p v-if="supported === false" class="text-sm text-warning">This needs a newer Tranga API (the FMD2 modules update).</p>

            <!-- Instructions -->
            <UCard>
                <template #header>
                    <div class="flex flex-row items-center gap-2">
                        <UIcon name="i-lucide-book-open" class="size-5 text-primary" />
                        <h2 class="font-semibold grow">How to add a website</h2>
                        <UButton size="xs" variant="ghost" color="neutral" :icon="showHelp ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="toggleHelp">
                            {{ showHelp ? 'Hide' : 'Show' }}
                        </UButton>
                    </div>
                </template>
                <div v-if="showHelp" class="flex flex-col gap-4 text-sm">
                    <p class="text-muted">
                        <a href="https://github.com/dazedcat19/FMD2" target="_blank" rel="noopener" class="text-primary hover:underline">Free Manga Downloader 2</a>
                        (FMD2) supports hundreds of manga websites using small Lua scripts, one per site. Tranga can use those scripts too.
                    </p>
                    <ol class="flex flex-col gap-3">
                        <li v-for="(step, i) in STEPS" :key="i" class="flex flex-row gap-3">
                            <span class="size-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
                            <div class="flex flex-col gap-0.5">
                                <p class="font-medium">{{ step.title }}</p>
                                <p class="text-muted">
                                    {{ step.text }}
                                    <a v-if="step.link" :href="step.link.href" target="_blank" rel="noopener" class="text-primary hover:underline">{{ step.link.label }}</a>
                                    {{ step.after }}
                                </p>
                            </div>
                        </li>
                    </ol>
                    <div class="grid grid-cols-1 min-md:grid-cols-2 gap-3">
                        <div class="rounded-md bg-success/10 p-3">
                            <p class="font-medium text-success flex items-center gap-1"><UIcon name="i-lucide-check" /> Usually works</p>
                            <ul class="text-muted list-disc pl-5 mt-1">
                                <li>Ordinary manga sites, including the common WordPress themes (Madara, MangaThemesia)</li>
                                <li>Sites with a JSON API</li>
                                <li>Pasting links to manga, checking for new chapters, downloading</li>
                            </ul>
                        </div>
                        <div class="rounded-md bg-warning/10 p-3">
                            <p class="font-medium text-warning flex items-center gap-1"><UIcon name="i-lucide-triangle-alert" /> Won't work</p>
                            <ul class="text-muted list-disc pl-5 mt-1">
                                <li>Sites that need JavaScript or a real browser to show pages</li>
                                <li>Logging in to a site (members-only chapters)</li>
                                <li>Scrambled or watermarked images that FMD2 fixes</li>
                            </ul>
                            <p class="text-xs text-muted mt-1">Tranga tells you after uploading if a module uses any of these.</p>
                        </div>
                    </div>
                    <p class="text-xs text-muted">
                        Modules run in a locked-down sandbox: they can only fetch web pages, through Tranga's usual request limits. Still, only
                        upload files from FMD2 itself. Once a site is added its name stays the same, because your manga are linked to it.
                        Deleting a module removes those links the next time Tranga starts.
                    </p>
                </div>
            </UCard>

            <!-- Upload -->
            <UCard v-if="supported !== false">
                <template #header>
                    <div class="flex flex-row items-center gap-2">
                        <UIcon name="i-lucide-upload" class="size-5 text-primary" />
                        <h2 class="font-semibold">Upload</h2>
                    </div>
                </template>
                <FmdUpload @uploaded="load" />
            </UCard>

            <!-- Sites -->
            <section v-if="overview" class="flex flex-col gap-3">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                    <UIcon name="i-lucide-globe" class="size-5" /> Added websites
                    <UBadge variant="subtle" color="neutral">{{ siteCount }}</UBadge>
                </h2>
                <p v-if="!overview.modules.length" class="text-sm text-muted">None yet. Upload a module above.</p>
                <div v-for="m in overview.modules" :key="m.fileName" class="rounded-lg border border-default p-3 flex flex-col gap-2">
                    <div class="flex flex-row flex-wrap items-center gap-2">
                        <UIcon name="i-lucide-file-code" class="size-4 text-muted" />
                        <span class="font-mono text-sm grow">{{ m.fileName }}</span>
                        <UButton size="xs" variant="soft" color="error" icon="i-lucide-trash-2" @click="askDelete('module', m.fileName, m.sites.map((s) => s.name))">Delete</UButton>
                    </div>
                    <p v-if="m.error" class="text-sm text-error flex items-start gap-1">
                        <UIcon name="i-lucide-circle-x" class="size-4 mt-0.5 shrink-0" />{{ m.error }}
                    </p>
                    <ul v-if="m.warnings.length" class="text-xs text-warning flex flex-col gap-0.5">
                        <li v-for="w in m.warnings" :key="w" class="flex items-start gap-1"><UIcon name="i-lucide-triangle-alert" class="size-3.5 mt-px shrink-0" />{{ w }}</li>
                    </ul>
                    <div v-for="s in m.sites" :key="s.name" class="rounded-md bg-elevated p-3 flex flex-col gap-2">
                        <div class="flex flex-row flex-wrap items-center gap-2">
                            <img :src="`${s.rootUrl}/favicon.ico`" alt="" class="size-5 rounded-sm" referrerpolicy="no-referrer" @error="(e) => ((e.target as HTMLElement).style.visibility = 'hidden')" />
                            <span class="font-medium">{{ s.name }}</span>
                            <a :href="s.rootUrl" target="_blank" rel="noopener" class="text-xs text-muted hover:text-primary truncate">{{ s.rootUrl }}</a>
                            <UBadge size="sm" variant="soft" color="neutral">{{ s.language }}</UBadge>
                            <span class="grow" />
                            <USwitch :model-value="s.enabled" size="sm" label="On" @update:model-value="(v: boolean) => setEnabled(s.name, v)" />
                            <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-flask-conical" @click="openTest(s)">Test</UButton>
                        </div>
                        <div class="text-xs text-muted flex flex-row flex-wrap items-center gap-2">
                            <UIcon name="i-lucide-search" class="size-3.5" />
                            <template v-if="!s.canListTitles">Search isn't possible for this site — paste links to manga on the Add manga page instead.</template>
                            <template v-else-if="s.titleListStatus === 'building'">
                                <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" /> Reading the site's title list (can take a few minutes)…
                            </template>
                            <template v-else>
                                <span v-if="s.titleCount">Search: {{ s.titleCount.toLocaleString() }} titles, read {{ formatDate(s.titleListBuiltUtc) }}.</span>
                                <span v-else>Search needs the site's title list, which hasn't been read yet.</span>
                                <span v-if="s.titleListStatus" class="text-error">Last attempt failed: {{ s.titleListStatus }}</span>
                                <UButton size="xs" variant="link" class="p-0" @click="buildTitles(s.name)">{{ s.titleCount ? 'Read again' : 'Read now' }}</UButton>
                            </template>
                        </div>
                    </div>
                </div>

                <div v-if="overview.templates.length || overview.helpers.length" class="grid grid-cols-1 min-md:grid-cols-2 gap-3">
                    <div v-for="group in libraryGroups" :key="group.kind" class="rounded-lg border border-default p-3 flex flex-col gap-1">
                        <p class="text-sm font-medium">{{ group.label }}</p>
                        <p v-if="!group.files.length" class="text-xs text-muted">None</p>
                        <div v-for="f in group.files" :key="f" class="flex flex-row items-center gap-2 text-sm">
                            <span class="font-mono grow truncate">{{ f }}</span>
                            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :aria-label="`Delete ${f}`" @click="askDelete(group.kind, f, [])" />
                        </div>
                    </div>
                </div>
                <p class="text-xs text-muted">Stored in the API container at <code>{{ overview.folder }}</code>.</p>
            </section>
        </div>

        <FmdSiteTest v-model:open="testOpen" :site="testSite.name" :root-url="testSite.rootUrl" />
        <ConfirmDialog v-model:open="confirmOpen" :title="confirm.title" confirm-label="Delete" :action="confirm.action">
            <p>{{ confirm.text }}</p>
        </ConfirmDialog>
    </TrangaPage>
</template>

<script setup lang="ts">
interface Site {
    name: string;
    moduleName: string;
    rootUrl: string;
    category: string;
    language: string;
    enabled: boolean;
    canListTitles: boolean;
    titleCount: number;
    titleListBuiltUtc?: string | null;
    titleListStatus?: string | null;
}
interface Overview {
    folder: string;
    modules: { fileName: string; error?: string | null; warnings: string[]; sites: Site[] }[];
    templates: string[];
    helpers: string[];
}

const api = useTrangaApi();
const toast = useToast();

const FMD_LUA = 'https://github.com/dazedcat19/FMD2/tree/master/lua';
const STEPS = [
    {
        title: 'Find the site\'s module',
        text: 'Open FMD2\'s',
        link: { href: `${FMD_LUA}/modules`, label: 'lua/modules folder on GitHub' },
        after: 'and find the file named after the site (e.g. Toonily.lua). Download it with the "Download raw file" button. If you have FMD2 installed, the same files are in its lua folder.',
    },
    { title: 'Upload it here', text: 'Drop the file below. Tranga loads it straight away and tells you if anything is missing or unsupported.' },
    {
        title: 'Add any template or helper it asks for',
        text: 'Many sites share a template (e.g. Madara.lua, MangaThemesia.lua). If Tranga says one is needed, get it from',
        link: { href: `${FMD_LUA}/templates`, label: 'lua/templates' },
        after: '(helpers come from lua/utils) and upload it the same way.',
    },
    { title: 'Test it', text: 'Click Test next to the site and paste a link to a manga on that site. You\'ll see the chapters Tranga finds and whether pages can be read.' },
    {
        title: 'Add manga',
        text: 'On the Add manga page, paste a link to a manga on the site, or search once Tranga has read the site\'s title list (it does this in the background after uploading). Then add it like any other.',
    },
];

const HELP_KEY = 'tranga-fmd-help';
const showHelp = ref(true);
onMounted(() => {
    try {
        showHelp.value = localStorage.getItem(HELP_KEY) !== 'hidden';
    } catch {
        /* ignore */
    }
});
function toggleHelp() {
    showHelp.value = !showHelp.value;
    try {
        localStorage.setItem(HELP_KEY, showHelp.value ? 'shown' : 'hidden');
    } catch {
        /* ignore */
    }
}

const overview = ref<Overview>();
const supported = ref<boolean>();
let timer: ReturnType<typeof setTimeout> | undefined;
async function load() {
    clearTimeout(timer);
    try {
        overview.value = await api.call<Overview>('v2/LuaModules');
        supported.value = true;
        refreshNuxtData(FetchKeys.MangaConnector.All);
        const building = overview.value.modules.some((m) => m.sites.some((s) => s.titleListStatus === 'building'));
        if (building) timer = setTimeout(load, 5000);
    } catch (e) {
        if (api.statusOf(e) === 404 || api.statusOf(e) === 405) supported.value = false;
    }
}
onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));

const siteCount = computed(() => overview.value?.modules.reduce((n, m) => n + m.sites.length, 0) ?? 0);
const libraryGroups = computed(() => [
    { kind: 'template', label: 'Templates', files: overview.value?.templates ?? [] },
    { kind: 'helper', label: 'Helpers', files: overview.value?.helpers ?? [] },
]);

async function setEnabled(name: string, enabled: boolean) {
    try {
        await api.call(`v2/LuaModules/Sites/${encodeURIComponent(name)}/Enabled/${enabled}`, { method: 'PATCH' });
    } catch (e) {
        toast.add({ title: "Couldn't change it", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    }
    await load();
}

async function buildTitles(name: string) {
    try {
        await api.call(`v2/LuaModules/Sites/${encodeURIComponent(name)}/TitleList`, { method: 'POST' });
    } catch (e) {
        toast.add({ title: "Couldn't start it", description: api.messageOf(e), color: 'error', icon: 'i-lucide-circle-x' });
    }
    await load();
}

const testOpen = ref(false);
const testSite = reactive({ name: '', rootUrl: '' });
function openTest(s: Site) {
    testSite.name = s.name;
    testSite.rootUrl = s.rootUrl;
    testOpen.value = true;
}

const confirmOpen = ref(false);
const confirm = reactive({ title: '', text: '', action: (() => Promise.resolve()) as () => Promise<unknown> });
function askDelete(kind: string, fileName: string, sites: string[]) {
    Object.assign(confirm, {
        title: `Delete ${fileName}?`,
        text:
            kind === 'module' && sites.length
                ? `${sites.join(', ')} will be removed from Tranga. Manga you added from ${sites.length === 1 ? 'it' : 'them'} lose that link the next time Tranga starts (downloaded files stay).`
                : 'Modules that need this file will stop working until it is uploaded again.',
        action: async () => {
            await api.call(`v2/LuaModules/${kind}/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
            await load();
        },
    });
    confirmOpen.value = true;
}

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

useHead({ title: 'Websites from FMD2' });
</script>
