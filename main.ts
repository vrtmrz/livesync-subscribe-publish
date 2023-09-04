import { beginWatch, fetchFiles, followUpdates, initializeDFM, runScript } from "./watcher.ts";
import { LiveSyncPublishOptions } from "./types.ts";
import { serveDir, serveListener } from "./deps.ts";
const configFilePath = Deno.env.get("LSSP_CONFIG_PATH") ?? "./config.jsonc";

let fsRoot = "";
let apiURLPattern: URLPattern | undefined = undefined;

async function handlerAPI(req: Request): Promise<Response | false> {
  if (!apiURLPattern) return false;

  const match = apiURLPattern.exec(req.url);
  if (match) {
    const param = match.pathname.groups.param ?? "";
    try {
      if (param == "update") {
        await followUpdates();
        return new Response("OK", { status: 200 });
      } if (param == "rebuild") {
        const result = await fetchFiles();
        return new Response(result, { status: 200 });
      } if (param == "run") {
        const result = await runScript()
        return new Response(result, { status: 200 });
      }
    } catch (ex) {
      return new Response("Internal server error", { status: 500 });
    }
  }
  return false;
}

async function handlerFs(req: Request): Promise<Response> {
  return await serveDir(req, {
    fsRoot: fsRoot,
  })
}
async function handler(req: Request): Promise<Response> {
  return (await handlerAPI(req)) || handlerFs(req);
}

if (import.meta.main) {
  try {
    console.log(`LiveSync Subscribe Publisher starting with ${configFilePath}`);
    const opt = JSON.parse(Deno.readTextFileSync(configFilePath)) as LiveSyncPublishOptions;
    console.log(`Options: watch:${opt.keyfile}, publish:${opt.publishDir}, api:${opt.apiPath}, port:${opt.publishPort}`)
    if (await initializeDFM(opt)) {
      await fetchFiles();
      if (opt.keyfile) {
        beginWatch();
      }
    }
    if (opt.publishDir) {
      fsRoot = opt.publishDir;
    }
    if (opt.apiPath) {
      apiURLPattern = new URLPattern({ pathname: `${opt.apiPath}/:param` })
    }
    if (opt.publishPort) {
      const port = opt.publishPort || 8080;
      const listener = Deno.listen({ port });
      serveListener(listener, handler);
    }
  } catch (ex) {
    console.log(ex);
  }
}
