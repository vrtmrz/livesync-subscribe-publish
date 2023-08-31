import { DirectFileManipulatorOptions } from "./deps.ts";
export type ScriptDef = {
    cmd: string,
    args: string[]
};
export type LiveSyncPublishOptions = DirectFileManipulatorOptions & {
    baseDir: string;
    localDir: string;
    keyfile: string;
    script: ScriptDef;
}




