import { DirectFileManipulator, getDocData, decode, win32, Logger, LOG_LEVEL_INFO } from "./deps.ts";
import { LiveSyncPublishOptions, ScriptDef } from "./types.ts";
import { posix, type FilePathWithPrefix, type MetaEntry, type ReadyEntry } from "./deps.ts";
import { LOG_LEVEL_NOTICE } from "./lib/src/types.ts";


let man: DirectFileManipulator;
let _localDir = "sitesrc/";
let _baseDir = "blog/";
let _script: ScriptDef;
let _keyfile = "flush.md";
export function initializeDFM(opt: LiveSyncPublishOptions) {
    try {
        _baseDir = opt.baseDir;
        _localDir = opt.localDir;
        _keyfile = opt.keyfile;
        _script = opt.script;
        const dfm = new DirectFileManipulator(opt);
        man = dfm;
        // Enumerate all docs
        return true;
    } catch (ex) {
        throw ex;
    }
}

function remotePath2LocalPath(path: string | FilePathWithPrefix): string {
    const rPath = path.substring(_baseDir.length);
    const posixPath = posix.join(_localDir, rPath);
    const os = Deno.build.os;
    if (os != "windows") {
        return posixPath;
    }
    return posixPath.split(posix.delimiter).join(win32.delimiter);
}
function isKeyFile(path: string) {
    if (!path.startsWith(_baseDir)) return false;
    if (path.substring(_baseDir.length).toLowerCase() == _keyfile.toLowerCase()) return true;
    return false;
}

async function getMTime(filename: string) {
    try {
        const f = await Deno.open(filename, { read: true });
        try {
            const stat = await Deno.fstat(f.rid);
            return ~~(stat.mtime?.getTime() ?? 0 / 1000);
        } finally {
            f.close();
        }
    } catch (ex) {
        return -1;
    }
}
function getDirName(path: string) {
    const os = Deno.build.os;
    if (os != "windows") {
        return posix.dirname(path);
    } else {
        return win32.dirname(path);
    }
}
function isReadyEntry(doc: MetaEntry | ReadyEntry): doc is ReadyEntry {
    return ("data" in doc);
}
async function fetchFile(doc: MetaEntry | ReadyEntry) {
    if (!isReadyEntry(doc)) {
        doc = await man.getByMeta(doc);
    }
    if (isReadyEntry(doc)) {
        const localPath = remotePath2LocalPath(doc.path);
        const content = getDocData(doc.data);
        try {
            const dirName = getDirName(localPath);
            await Deno.mkdir(dirName, { recursive: true });
        } catch (ex) {
            console.log(ex);
        }
        if (doc.type == "newnote") {
            Logger(`Fetched (Bin):${doc.path}`)
            await Deno.writeFile(localPath, decode(content));
        } else if (doc.type == "plain") {
            Logger(`Fetched (Plain):${doc.path}`)
            await Deno.writeTextFile(localPath, content);
        }
    } else {
        Logger(`Fetch failed:${doc.path}`)
    }
}
export async function fetchFiles() {
    const fileE = man.enumerateAllNormalDocs({ metaOnly: true });
    let fetched = false;
    for await (const doc of fileE) {
        if (doc.path.startsWith(_baseDir)) {
            const localPath = remotePath2LocalPath(doc.path);
            const mtimeLocal = await getMTime(localPath);
            const mtimeRemote = ~~((doc._deleted || doc.deleted) ? -1 : doc.mtime ?? 0 / 1000);
            Logger(`${doc.path} : ${mtimeLocal} === ${mtimeRemote}`, LOG_LEVEL_INFO)
            if (mtimeLocal < mtimeRemote) {
                await fetchFile(doc);
                fetched = true;
            }
        }
    }
    if (fetched) runScript().then(() => {/* Fire and forget */ });
}
async function runScript() {
    if (_script.cmd == "") return;
    Logger("Script called:" + _script.cmd)
    const command = new Deno.Command(
        _script.cmd, {
        args: _script.args,
        cwd: ".",
    });

    const { code, stdout, stderr } = await command.output();

    if (code === 0) {
        Logger("Script done:")
        Logger(new TextDecoder().decode(stdout));
    } else {
        Logger("Script errored:")
        Logger(new TextDecoder().decode(stderr), LOG_LEVEL_NOTICE);
    }
}
export function beginWatch() {
    man.since = "now";
    man.beginWatch(async (doc) => {
        await fetchFile(doc);
        if (isKeyFile(doc.path)) {
            runScript().then(() => {/* Fire and forget */ });
        }
    })
}
