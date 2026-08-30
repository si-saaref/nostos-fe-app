/**
 * Paraglide compiler options, shared by everything that generates
 * `src/paraglide`.
 *
 * Two things generate it: the Vite plugin (dev, build, vitest) and
 * `npm run i18n:compile`, which runs on postinstall so that `tsc -b` has a
 * module to resolve on a fresh checkout — the output directory is gitignored,
 * and CI type-checks long before anything has a reason to start Vite.
 *
 * Both read this file so they cannot drift. `strategy` is baked into the
 * generated runtime, so a second copy that fell out of sync would quietly
 * compile a locale resolver the app never uses.
 *
 * Paraglide's own convention for this is `project.inlang/paraglide.config.js`,
 * but inlang's managed `.gitignore` in that directory excludes everything
 * except `settings.json`, so a config placed there would never reach CI.
 *
 * @type {import('@inlang/paraglide-js').CompilerOptions}
 */
export const paraglideConfig = {
  project: './project.inlang',
  outdir: './src/paraglide',
  // The app is a client-only SPA with an explicit language control, so the
  // locale is remembered per device rather than carried in the URL.
  strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
  emitTsDeclarations: true,
}
