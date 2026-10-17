/**
 * Optional login (Settings → Login). The session is an HttpOnly cookie set by the Tranga API, so the website only
 * needs to know whether the login is on and whether this browser is logged in.
 */
export interface AuthStatus {
    enabled: boolean;
    loggedIn: boolean;
    username?: string | null;
    apiKeySet: boolean;
    apiKeyCreatedUtc?: string | null;
    forcedOff: boolean;
}

const status = ref<AuthStatus | null>();
let checkedAt = 0;
let inFlight: Promise<AuthStatus | null> | undefined;

export function useAuth() {
    const config = useRuntimeConfig();
    const base = `${config.public.openFetch.api.baseURL}v2/Auth`;

    /** Current login state (cached for 30 s); null if the API is older (no login) or unreachable */
    function refresh(force = false): Promise<AuthStatus | null> {
        if (!force && status.value !== undefined && Date.now() - checkedAt < 30_000) return Promise.resolve(status.value);
        inFlight ??= $fetch<AuthStatus>(`${base}/Status`)
            .then((s) => s)
            .catch(() => null)
            .then((s) => {
                status.value = s;
                checkedAt = Date.now();
                inFlight = undefined;
                return s;
            });
        return inFlight;
    }

    function set(s: AuthStatus) {
        status.value = s;
        checkedAt = Date.now();
    }

    async function login(username: string, password: string, remember: boolean) {
        set(await $fetch<AuthStatus>(`${base}/Login`, { method: 'POST', body: { username, password, remember } }));
    }

    async function logout() {
        set(await $fetch<AuthStatus>(`${base}/Logout`, { method: 'POST' }));
        await navigateTo('/login');
    }

    return { status, refresh, set, login, logout };
}
