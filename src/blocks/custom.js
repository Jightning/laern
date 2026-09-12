/* Per-course block renderers.
 *
 * A course may ship `blocks.js` to register a renderer the built-ins cannot
 * express — ECE 20001's `schematic` is the standing example, since every
 * built-in figure kind is about data and a schematic is about topology and
 * symbols.
 *
 * This is a separate module from ./index.js for one reason: `import.meta.glob`
 * is a bundler feature, and ./index.js is also loaded by the Node tools
 * (validate.mjs and audit-content.mjs reach it through src/lib/index.js to ask
 * what a block is called and how it behaves at depth). A glob anywhere in that
 * import graph makes the chain unloadable outside Vite, so the registry and the
 * built-ins stay pure and the bundler-only part lives here, imported by
 * main.jsx alone.
 *
 * A course's registration may declare `notes:` and `name:` alongside `render:`,
 * so a bespoke block says how it behaves at reading depth without the engine
 * knowing anything about it.
 */
import { Blocks, U } from "./index.js";

const custom = import.meta.glob("../../courses/*/blocks.js", { eager: true });
Object.values(custom).forEach(m => { if (typeof m.default === "function") m.default(Blocks, U); });
