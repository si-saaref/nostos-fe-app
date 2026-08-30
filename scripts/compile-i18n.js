/**
 * Compiles the inlang project without going through Vite.
 *
 * Runs on postinstall so `tsc -b`, the editor and anything else that reads
 * `src/paraglide` find it already generated, rather than only after the first
 * `vite dev` or `vite build`.
 */
import { compile } from '@inlang/paraglide-js'

import { paraglideConfig } from '../paraglide.config.js'

await compile(paraglideConfig)
