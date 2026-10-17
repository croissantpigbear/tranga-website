<template>
    <div v-if="info" class="rounded-lg bg-elevated p-3 flex flex-col gap-2">
        <p class="font-medium flex items-center gap-2"><UIcon name="i-lucide-file-archive" class="size-4" />Settings backup</p>
        <p class="text-sm text-muted">
            A .zip of Tranga's settings ({{ info.files.length }} files, {{ sizeText(info.totalBytes) }}): settings, file naming, schedules, the
            download queue, login, series preferences and your uploaded FMD2 modules. Use it to move to another server or undo a change.
            Your series and libraries are in the database, which the daily backup above covers.
        </p>
        <div class="flex flex-row flex-wrap gap-2">
            <UButton variant="soft" icon="i-lucide-download" :href="downloadUrl" download external>Download settings</UButton>
            <UButton variant="soft" color="warning" icon="i-lucide-upload" :loading="checking" @click="fileInput?.click()">Restore from a file…</UButton>
            <input ref="fileInput" type="file" accept=".zip,application/zip" class="hidden" @change="pick" />
        </div>
        <p v-if="error" class="text-sm text-error">{{ error }}</p>
        <UAlert
            v-if="restarting"
            color="info"
            variant="subtle"
            icon="i-lucide-loader-circle"
            :ui="{ icon: 'animate-spin' }"
            title="Settings restored, Tranga is restarting"
            :description="waited > 60 ? 'This is taking a while. If Tranga doesn\'t come back, start the tranga-api container again.' : 'This page reloads when it\'s back.'" />

        <ConfirmDialog
            v-model:open="confirmOpen"
            title="Restore these settings?"
            confirm-label="Restore and restart"
            color="warning"
            icon="i-lucide-upload"
            :action="restore">
            <p>
                The backup from <span class="font-medium">{{ preview?.createdUtc ? new Date(preview.createdUtc).toLocaleString() : 'an unknown date' }}</span>
                has {{ preview?.files.length }} files. They replace the current ones, and your FMD2 modules become exactly the backup's.
            </p>
            <p class="text-muted">
                Tranga keeps a copy of the current settings (settings-before-restore-….zip in its settings folder) and restarts, which stops
                downloads in progress for a moment. If the backup has a login in it, you'll need that login's password.
            </p>
        </ConfirmDialog>
    </div>
</template>

<script setup lang="ts">
interface BackupInfo {
    files: string[];
    totalBytes: number;
    createdUtc?: string | null;
}
const api = useTrangaApi();
const config = useRuntimeConfig();
const downloadUrl = `${config.public.openFetch.api.baseURL}v2/SettingsBackup/Download`;

/** undefined with an older API (section hidden) */
const info = ref<BackupInfo>();
onMounted(async () => {
    try {
        info.value = await api.call<BackupInfo>('v2/SettingsBackup');
    } catch {
        info.value = undefined;
    }
});

const fileInput = ref<HTMLInputElement>();
const checking = ref(false);
const error = ref('');
const confirmOpen = ref(false);
const preview = ref<BackupInfo>();
let content = '';

function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function pick(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error.value = '';
    checking.value = true;
    try {
        content = await toBase64(file);
        preview.value = await api.call<BackupInfo>('v2/SettingsBackup/Restore', { method: 'POST', body: { contentBase64: content, dryRun: true } });
        confirmOpen.value = true;
    } catch (err) {
        error.value = api.statusOf(err) === 413 ? 'That file is too big.' : api.messageOf(err);
    } finally {
        checking.value = false;
    }
}

const restarting = ref(false);
const waited = ref(0);
async function restore() {
    try {
        await api.call('v2/SettingsBackup/Restore', { method: 'POST', body: { contentBase64: content, dryRun: false } });
    } catch (err) {
        error.value = api.messageOf(err);
        throw err;
    }
    content = '';
    restarting.value = true;
    // Wait for the API to go away and come back, then reload
    await new Promise((r) => setTimeout(r, 5000));
    const timer = setInterval(async () => {
        waited.value += 3;
        try {
            await $fetch(`${config.public.openFetch.api.baseURL}v2/Auth/Status`);
            clearInterval(timer);
            window.location.reload();
        } catch {
            /* still restarting */
        }
    }, 3000);
}

function sizeText(n: number): string {
    return n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.ceil(n / 1024))} KB`;
}
</script>
