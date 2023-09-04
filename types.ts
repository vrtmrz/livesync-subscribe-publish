import { DirectFileManipulatorOptions } from "./deps.ts";
export type ScriptDef = {
    cmd: string,
    args: string[]
};
export type LiveSyncPublishOptions = DirectFileManipulatorOptions & {
    baseDir: string
    subscribeDir: string;
    resultDir: string;
    localDir: string;
    keyfile: string;
    script: ScriptDef;
    statDir: string;
    publishDir: string;
    publishPort: number;
    apiPath: string;
}

export type StatusInfo = {
    lastSeq: string
}


export const STATUS_DEFAULT = {
    lastSeq: "now"
}


