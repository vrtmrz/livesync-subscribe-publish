import { beginWatch, fetchFiles, initializeDFM } from "./watcher.ts";
import { LiveSyncPublishOptions } from "./types.ts";
import { serveDir, serveListener } from "./deps.ts";

let fsRoot = "";
async function handler(req: Request): Promise<Response> {Í
  return await serveDir(req, {
    fsRoot: fsRoot,
  })

}

if (import.meta.main) {
  try {
    const opt = JSON.parse(Deno.readTextFileSync("config.jsonc")) as LiveSyncPublishOptions;
    if (await initializeDFM(opt)) {
      await fetchFiles();
      beginWatch();
    }
    if (opt.publishPort && opt.publishDir) {
      fsRoot = opt.publishDir;
      const port = opt.publishPort || 8080;
      const listener = Deno.listen({ port });
      serveListener(listener, handler);
    }
  } catch (ex) {
    console.log(ex);
  }
}
