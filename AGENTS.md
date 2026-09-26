# Agents: start here

Read `CLAUDE.md`. It holds the build rules and the operating protocol, and (through its import) the current state in `docs/STATE.md`. Everything an agent needs is in the repo; nothing depends on chat history.

## This is NOT the stack you remember

Several dependencies are newer than most training data:

- **Next.js 16, React 19.3, Tailwind 4:** APIs and conventions differ from older majors. Read the installed package docs and types before writing code, and heed deprecation notices.
- **`@category-labs/mera` 0.2.0** was first published on 2026-07-23. There is no prior knowledge to lean on. Its API is exactly what `node_modules/@category-labs/mera/dist/*.d.ts` says; the verified surface is summarised in `docs/CONTEXT.md`.
- **Kuru** is Monad-only. Its contract surface comes from the ABI JSON in `@kuru-labs/kuru-sdk` 0.0.95 and is confirmed by fork tests, not by memory.
- **Monad is not Ethereum.** Gas is charged on the gas limit, not gas used; see the Traps section of `docs/CONTEXT.md`.
