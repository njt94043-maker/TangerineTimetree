// Single reader for the __DEPLOY_ENV__ compile-time constant (F0 fork slice).
//
// __DEPLOY_ENV__ is baked in by vite.config.ts from Vercel's build-time
// VERCEL_ENV: 'production' on thegreentangerine.com, 'preview' on any branch
// deploy (that's the `cutover` fork), 'development' for a local build.
//
// Two things hang off this and must agree, so they both read it from here:
//   1. PreviewBadge — labels the build so the fork is never mistaken for live.
//   2. usePushNotifications — refuses to CREATE a push subscription off a
//      non-production origin (push_subscriptions.endpoint is UNIQUE and has no
//      origin column, so a preview subscription would double every push).

export const DEPLOY_ENV: string = __DEPLOY_ENV__;

/** True only for the production deploy (thegreentangerine.com). */
export const IS_PRODUCTION_DEPLOY: boolean = DEPLOY_ENV === 'production';
