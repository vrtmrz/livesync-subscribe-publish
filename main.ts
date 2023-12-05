import { beginWatch, fetchFiles, followUpdates, initializeDFM, resetSequence, runScript } from "./watcher.ts";
import { LiveSyncPublishOptions } from "./types.ts";
import { serveDir, serveListener } from "./deps.ts";
const configFilePath = Deno.env.get("LSSP_CONFIG_PATH") ?? "./config.jsonc";

let fsRoot = "";
let apiURLPattern: URLPattern | undefined = undefined;
const apiMenu = `<html>
<body>
<h2> Normal Operation </h2>
<ul>
<li><a href="update" target="_blank">Update: Fetch all changed files since the previous fetching.</a></li>
<li><a href="run" target="_blank">Run: Run the script</a></li>
<li><a href="build" target="_blank">Build: Update and Run.</a></li>
</ul>
<h2> A Bit Dangerous Operation </h2>
<ul>
<li><a href="rebuild" target="_blank">Rebuild: Fetch all again and rerun the script.</a></li>
<li><a href="forcebuild" target="_blank">ForceBuild: Rebuild force.</a></li>
<li><a href="resetseq" target="_blank">Reset seq: Reset the fetching checkpoint to let us "fetch" again from the beginning.</a></li>
</ul>
</body>
</html>
`
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
        await resetSequence();
        const result = await fetchFiles();
        return new Response(result, { status: 200 });
      } if (param == "run") {
        const result = await runScript()
        return new Response(result, { status: 200 });
      } if (param == "forcebuild") {
        const result = await fetchFiles(false, false, true);
        return new Response(result, { status: 200 });
      } if (param == "resetseq") {
        const result = await resetSequence()
        return new Response(result, { status: 200 });
      } else if (param == "build") {
        await followUpdates();
        const result = await runScript()
        return new Response(result, { status: 200 });
      } else if (param == "menu") {
        return new Response(apiMenu, { headers: { "content-type": "text/html; charset=UTF-8" }, status: 200 });
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
    if (opt.publishPort) {
      const port = opt.publishPort || 8080;
      const listener = Deno.listen({ port });
      console.log(`Listen started at ${port}`)
      serveListener(listener, handler);
    }
    if (await initializeDFM(opt)) {
      await fetchFiles();
      if (opt.keyfile) {
        beginWatch().then(e => console.log(e));
      }
    }
    if (opt.publishDir) {
      fsRoot = opt.publishDir;
    }
    if (opt.apiPath) {
      apiURLPattern = new URLPattern({ pathname: `${opt.apiPath}/:param` })
    }

  } catch (ex) {
    console.log(ex);
  }
}
