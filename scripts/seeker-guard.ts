import type { Plugin } from "vite";

// Fails the build if the web diary would load anything of the Seeker app
// (PLAN_SEEKER.md §0: the web diary does not change). Walks the module graph
// from src/app/diary/DiaryApp.tsx, through every import and every lazy
// import, and refuses any module under src/app/seeker/. The Seeker may import
// the diary; the diary never the Seeker.
const DIARY = "/src/app/diary/DiaryApp.tsx";
const SEEKER = "/src/app/seeker/";

export function seekerGuard(): Plugin {
  return {
    name: "seeker-guard",
    apply: "build",
    generateBundle() {
      const ids = [...this.getModuleIds()];
      const root = ids.find((id) => id.endsWith(DIARY));
      if (!root) this.error(`seeker-guard: ${DIARY} is not in the build`);
      const via = new Map<string, string>([[root!, ""]]);
      const queue = [root!];
      while (queue.length) {
        const id = queue.shift()!;
        if (id.includes(SEEKER)) {
          const chain: string[] = [];
          for (let at: string | undefined = id; at; at = via.get(at) || undefined) chain.unshift(at.slice(at.indexOf("/src/") + 1));
          this.error(`seeker-guard: the web diary reaches the Seeker app: ${chain.join(" -> ")}`);
        }
        if (id.includes("/node_modules/")) continue;
        const info = this.getModuleInfo(id);
        for (const next of [...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? [])]) {
          if (!via.has(next)) {
            via.set(next, id);
            queue.push(next);
          }
        }
      }
      console.log(`seeker-guard: the web diary's ${via.size} modules hold nothing of src/app/seeker/`);
    },
  };
}
