/** Sends the browser to the login page when the login is on and it isn't logged in */
export default defineNuxtRouteMiddleware(async (to) => {
    if (import.meta.server || to.path === '/login') return;
    const s = await useAuth().refresh();
    if (s?.enabled && !s.loggedIn) return navigateTo({ path: '/login', query: { return: to.fullPath } });
});
