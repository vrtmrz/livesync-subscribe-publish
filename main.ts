import { beginWatch, fetchFiles, initializeDFM } from "./watcher.ts";
import { LiveSyncPublishOptions } from "./types.ts";

if (import.meta.main) {
  try {
    const opt = JSON.parse(Deno.readTextFileSync("config.jsonc")) as LiveSyncPublishOptions;
    if (initializeDFM(opt)) {
      await fetchFiles();
      beginWatch();
    }
  } catch (ex) {
    console.log(ex);
  }
}
