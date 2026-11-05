import { SIGNED_IN_ATTRIBUTE, TOKEN_KEY } from "./api";

/**
 * `/` is the public home page, but a signed-in visitor goes on to My forms.
 *
 * The token is only in localStorage, so the server can't tell who is signed in
 * and the redirect has to happen in the browser. Inlined into `<head>` like
 * THEME_BOOT_SCRIPT and for the same reason: run from an effect, a signed-in
 * visitor would see the home page flash on every load. It only fires on `/`.
 *
 * On every page it also marks `<html>` with SIGNED_IN_ATTRIBUTE while a token
 * is held, so the docs' top bar shows Open my forms instead of Sign in from the
 * first paint (globals.css). Signing in and out keep the mark in step (api.ts).
 *
 * A link to `/` within the app is a client-side navigation, which doesn't run
 * this again; SignedInRedirect on the page covers that.
 *
 * A stale token still goes to `/app`, whose 401 handling clears it and sends
 * the visitor to `/login`, so the next visit to `/` shows the home page.
 */
export const HOME_REDIRECT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(TOKEN_KEY)})){document.documentElement.setAttribute(${JSON.stringify(SIGNED_IN_ATTRIBUTE)},"");if(location.pathname==="/")location.replace("/app")}}catch(e){}})()`;
