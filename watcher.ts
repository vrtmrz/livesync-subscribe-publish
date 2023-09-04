import { DirectFileManipulator, getDocData, decode, win32, Logger, LOG_LEVEL_INFO, walk } from "./deps.ts";
import { LiveSyncPublishOptions, STATUS_DEFAULT, ScriptDef } from "./types.ts";
import { posix, type FilePathWithPrefix, type MetaEntry, type ReadyEntry } from "./deps.ts";
import { LOG_LEVEL, LOG_LEVEL_NOTICE, LOG_LEVEL_VERBOSE } from "./lib/src/types.ts";


let man: DirectFileManipulator;
let _localDir = "sitesrc/";
let _subscribeDir = "blog/";
let _resultDir = "blogresult/";
let _script: ScriptDef;
let _keyfile = "flush.md";
let _statDir = "./dat";

let _stat = { ...STATUS_DEFAULT };

let reportCounter = 0;

async function mkdirForce(dirName: string) {
    try {
        await Deno.mkdir(dirName, { recursive: true });
    } catch (ex) {
        console.log(ex);
    }
}

export async function initializeDFM(opt: LiveSyncPublishOptions) {
    try {
        if (opt.baseDir) _subscribeDir = opt.baseDir;
        if (opt.subscribeDir) _subscribeDir = opt.subscribeDir;
        _localDir = opt.localDir;
        _keyfile = opt.keyfile;
        _script = opt.script;
        _statDir = opt.statDir;
        _resultDir = opt.resultDir;
        await mkdirForce(_localDir);
        await mkdirForce(_statDir);
        const dfm = new DirectFileManipulator(opt);
        man = dfm;
        await loadStatus();
        return true;
    } catch (ex) {
        throw ex;
    }
}


async function loadStatus() {
    try {
        const statFile = await Deno.readTextFile(localPathToActualPath(posix.join(_statDir, "status.json")));
        const json = JSON.parse(statFile);
        if (json) {
            _stat = { ...STATUS_DEFAULT, ...json }
        }
        Logger("Last status has been loaded");
    } catch (ex) {
        Logger(`Could not load status json`, LOG_LEVEL_NOTICE);
        Logger(ex, LOG_LEVEL_VERBOSE);
    }
}
async function saveStatus() {
    try {
        await Deno.writeTextFile(localPathToActualPath(posix.join(_statDir, "status.json")), JSON.stringify(_stat));
    } catch (ex) {
        Logger(`Could not save status json`, LOG_LEVEL_NOTICE);
        Logger(ex, LOG_LEVEL_VERBOSE);
    }
}
function isTargetFile(path: string | FilePathWithPrefix) {
    return path.startsWith(_subscribeDir);
}
function remotePath2VirtualPath(path: string | FilePathWithPrefix): string | false {
    if (!path.startsWith(_subscribeDir)) return false;
    return path.substring(_subscribeDir.length);
}
function virtualPathToLocalPath(virtualPath: string): string {
    const posixPath = posix.join(_localDir, virtualPath);
    return posixPath
}
export function localPathToActualPath(posixPath: string): string {
    const os = Deno.build.os;
    if (os != "windows") {
        return posixPath;
    }
    return posixPath.split(posix.sep).join(win32.sep);
}

export function actualPathToLocalPath(posixPath: string): string {
    const os = Deno.build.os;
    if (os != "windows") {
        return posixPath;
    }
    return posixPath.split(win32.sep).join(posix.sep);
}


function remotePath2LocalPath(path: string | FilePathWithPrefix): string {
    const vPath = remotePath2VirtualPath(path);
    if (vPath == false) throw new Error("Remote path is not belongs to base directory");
    const localPath = virtualPathToLocalPath(vPath);
    const osPath = localPathToActualPath(localPath);
    return osPath

}
function isKeyFile(path: string) {
    const vPath = remotePath2VirtualPath(path);
    if (vPath === false) return false;
    if (vPath.toLowerCase() == _keyfile.toLowerCase()) return true;
    return false;
}

async function getMTime(filename: string) {
    try {
        const stat = await Deno.stat(filename);
        return Math.ceil(stat?.mtime?.getTime() ?? 0 / 1000);
    }
    catch (ex) {
        return -1;
    }
}
export function getDirName(path: string) {
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
function isDeletedDoc(doc: MetaEntry) {
    return doc._deleted || doc?.deleted;
}
async function fetchFile(doc: MetaEntry | ReadyEntry) {
    const docPath = doc.path;
    if (isDeletedDoc(doc)) {
        return await unlinkFile(doc);
    }
    if (!isReadyEntry(doc)) {
        Logger(`FetchFile: ${docPath} is not loaded completely`);
        doc = await man.getByMeta(doc);
    }
    if (isReadyEntry(doc)) {
        Logger(`FetchFile: ${docPath} Loaded`);
        const localPath = remotePath2LocalPath(doc.path);
        const content = getDocData(doc.data);
        try {
            const dirName = getDirName(localPath);
            await Deno.mkdir(dirName, { recursive: true });
        } catch (ex) {
            console.log(ex);
        }
        if (doc.type == "newnote") {
            Logger(`FetchFile: ${docPath} fetched (bin)  :${doc.path}`)
            await Deno.writeFile(localPath, decode(content));
        } else if (doc.type == "plain") {
            Logger(`FetchFile: ${docPath} fetched (Plain):${doc.path}`)
            await Deno.writeTextFile(localPath, content);
        } else {
            Logger(`Fetch failed: ${docPath} something went wrong`);
            Logger(doc);
        }
    } else {
        Logger(`Fetch failed:${doc.path}`)
    }
}
async function unlinkFile(doc: MetaEntry | ReadyEntry) {
    const localPath = remotePath2LocalPath(doc.path);
    const deleted = isDeletedDoc(doc);
    if (deleted) {
        await Deno.remove(localPath);
    }
}
export async function fetchFiles(isDryRun = false, isPurgeUnused = false): Promise<string> {
    const report = [] as string[];
    const startDate = new Date();
    const dateStr = startDate.toLocaleString();
    const ISODate = startDate.toISOString().replace(/[-:]/g, "").replace(/T/, "-").split(".")[0]
    const outFilename = posix.join(_resultDir, `${ISODate}-${reportCounter++}.md`);

    function LLogger(msg: string | object, level?: LOG_LEVEL) {
        if (typeof msg == "string") report.push(msg);
        Logger(msg, level)
    }

    const msgDryRun = isDryRun ? " (DryRun)" : "";
    const msgPurgeUnused = isPurgeUnused ? " (Purge unused)" : "";
    const header = `FullScan${msgDryRun}${msgPurgeUnused}:`;
    LLogger(`${header} Begin at ${dateStr}`);
    if (!isDryRun && _stat && _stat.lastSeq != "now") {
        LLogger("Already fully synchronised once, finish!");
        return report.join("\n");
    }
    LLogger(`${header} Enumerating all files on the database`);
    const fileE = man.enumerateAllNormalDocs({ metaOnly: true });
    let fetched = false;
    const extras = new Set<string>();
    LLogger(`--${header} Enumerating all files on the storage`);
    const iter = walk(localPathToActualPath(posix.normalize(_localDir)), { includeDirs: false });
    for await (const walkEntry of iter) {
        extras.add(localPathToActualPath(walkEntry.path));
    }
    const usedLocalFiles = [];
    for await (const doc of fileE) {
        if (isTargetFile(doc.path)) {
            LLogger(`${header} Processing ${doc.path}`);
            const localPath = remotePath2LocalPath(doc.path);
            try {
                const mtimeLocal = await getMTime(localPath);
                const mtimeRemote = Math.ceil((doc._deleted || doc.deleted) ? -1 : doc.mtime ?? 0 / 1000);

                if (mtimeLocal < mtimeRemote) {
                    LLogger(`${header} ${doc.path} : ${mtimeLocal} <<< ${mtimeRemote}`, LOG_LEVEL_INFO)
                    if (!isDryRun) {
                        await fetchFile(doc);
                        fetched = true;
                    }
                } else if (mtimeLocal == mtimeRemote) {
                    LLogger(`${header} ${doc.path} : ${mtimeLocal} === ${mtimeRemote}`, LOG_LEVEL_INFO)
                    continue;
                } else if (mtimeRemote == -1) {
                    LLogger(`${header} ${doc.path} : ${mtimeLocal} xxx ${mtimeRemote}`, LOG_LEVEL_INFO)
                    if (!isDryRun) {
                        await unlinkFile(doc);
                        fetched = true;
                    }
                }
            } catch (ex) {
                LLogger(`${header} Something happened at processing ${doc.path}`)
            }
            const actualLocalPath = localPathToActualPath(localPath);
            if (extras.has(actualLocalPath)) {
                extras.delete(actualLocalPath);
                usedLocalFiles.push(actualLocalPath);
            }

        }
    }
    LLogger(`--${header} Enumerating Finished`);
    const extraFiles = [...extras];
    if (isPurgeUnused) {
        LLogger(`--${header} Purging unused files`);
        for (const efile of extraFiles) {
            LLogger(`${header} purging ${efile}`)
            try {
                Deno.remove(efile);
            } catch (ex) {
                LLogger(`${header} purging ${efile} failed`, LOG_LEVEL_NOTICE);
                LLogger(ex);
            }
        }
    } else {
        LLogger(`--${header} Unused files--`);
        for (const efile of extraFiles) {
            LLogger(`${header} purging ${efile}`)

        }
    }
    LLogger(`--${header} Used files--`);
    for (const efile of usedLocalFiles) {
        LLogger(`${header} ${efile}`)
    }
    LLogger(`--End of the report--`);
    if (_resultDir != "") {
        await uploadDoc(outFilename, "```\n" + report.join("\n") + "\n```");
    }
    if (fetched && !isDryRun) {
        runScript().then(() => {/* Fire and forget */ });
    }
    return report.join("\n");
}
async function uploadDoc(filename: string, note: string) {
    const mtime = Date.now();
    try {
        await man.put(filename, [note], {
            mtime: mtime,
            size: new TextEncoder().encode(note).byteLength,
            ctime: mtime
        }, "plain");
        Logger("Script: result stored into the vault");
    } catch (ex) {
        Logger("Failed to store the result to remote vault", LOG_LEVEL_NOTICE)
        Logger(ex);
    }
}
export async function runScript(): Promise<string> {
    if (_script.cmd == "") return "";
    const result = [];
    try {
        const startDate = new Date();
        const dateStr = startDate.toLocaleString();
        const ISODate = startDate.toISOString().replace(/[-:]/g, "").replace(/T/, "-").split(".")[0]
        const outFilename = posix.join(_resultDir, `${ISODate}-${reportCounter++}.md`);

        const scriptLineMessage = `Script: called ${_script.cmd} with args ${JSON.stringify(_script.args)}`;
        Logger(scriptLineMessage)
        const command = new Deno.Command(
            _script.cmd, {
            args: _script.args,
            cwd: ".",
        });
        const start = performance.now();
        const { code, stdout, stderr } = await command.output();
        const end = performance.now();
        const stdoutText = new TextDecoder().decode(stdout);
        const stderrText = new TextDecoder().decode(stderr);
        result.push(`# Script process: ${dateStr}\n`);
        result.push(`command: \`${scriptLineMessage}\``);
        if (code === 0) {
            Logger("Script: Performed successfully.")
            result.push("Script: Performed successfully.")
            Logger(stdoutText);
        } else {
            Logger("Script: Performed but with some errors.")
            result.push("Script: Performed but with some errors.")
            Logger(stderrText, LOG_LEVEL_NOTICE);
        }
        result.push(`\n- Spent ${Math.ceil(end - start) / 1000} ms`);
        result.push("## --STDOUT--\n")
        result.push("```\n" + stdoutText + "\n```");
        result.push("## --STDERR--n")
        result.push("```\n" + stderrText + "\n```");
        const strResult = result.join("\n");
        if (_resultDir != "") {
            await uploadDoc(outFilename, strResult);
        }
        return strResult;
    } catch (ex) {
        Logger(ex);
        result.push(JSON.stringify(ex, null, 2));
        return result.join("\n");
    }

}

async function processIncomingDoc(doc: ReadyEntry) {
    try {
        if (isTargetFile(doc.path)) {
            if (isKeyFile(doc.path)) {
                const docData = getDocData(doc.data);
                const isCommandRebuild = docData == "rebuild";
                const isCommandDryRun = docData == "dryrun";
                const isCommandPurge = docData == "purge";
                if (isCommandRebuild || isCommandDryRun || isCommandPurge) {
                    Logger(`Command detected!: ${docData}`);
                    if (!isCommandDryRun) _stat.lastSeq = "now";
                    await fetchFiles(isCommandDryRun, isCommandPurge);
                } else {
                    runScript().then(() => {/* Fire and forget */ });
                }
            } else {
                await fetchFile(doc);
            }
        }
        _stat.lastSeq = man.since;
        await saveStatus();
    } catch (ex) {
        Logger(ex);
    }
}
export async function followUpdates() {
    man.since = _stat.lastSeq;
    const lastSeq = await man.followUpdates(processIncomingDoc);
    _stat.lastSeq = lastSeq;
    await saveStatus()

}
export function beginWatch() {
    man.since = _stat.lastSeq;
    if (!_keyfile) {
        Logger(`Could not watch without keyfile`, LOG_LEVEL_NOTICE);
        return;
    }
    man.beginWatch(processIncomingDoc)
}
