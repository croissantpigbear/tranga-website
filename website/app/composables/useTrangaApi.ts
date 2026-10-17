/**
 * Untyped calls to the Tranga API (for endpoints not in the published schema, and for string bodies,
 * which ASP.NET only accepts as JSON).
 */
export function useTrangaApi() {
    const config = useRuntimeConfig();
    const base = config.public.openFetch.api.baseURL;
    const router = useRouter();

    function call<T = unknown>(path: string, opts: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; query?: Record<string, string> } = {}) {
        const hasBody = opts.body !== undefined;
        return $fetch<T>(`${base}${path.replace(/^\//, '')}`, {
            method: opts.method ?? 'GET',
            query: opts.query,
            body: hasBody ? JSON.stringify(opts.body) : undefined,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            // Logged out (login switched on, session ended): go to the login page
            onResponseError({ response }) {
                const route = router.currentRoute.value;
                if (response.status === 401 && !path.includes('Auth/') && route.path !== '/login')
                    router.push({ path: '/login', query: { return: route.fullPath } });
            },
        });
    }

    /** HTTP status of a failed call */
    function statusOf(e: unknown): number | undefined {
        const err = e as { status?: number; statusCode?: number; response?: { status?: number } };
        return err?.response?.status ?? err?.status ?? err?.statusCode;
    }

    /** Readable error text from a failed call */
    function messageOf(e: unknown): string {
        const err = e as { data?: unknown; message?: string };
        return typeof err?.data === 'string' && err.data ? err.data : (err?.message ?? 'Unknown error');
    }

    return { call, statusOf, messageOf };
}
