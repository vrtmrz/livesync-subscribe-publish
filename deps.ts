export { decode, encode } from "https://deno.land/std@0.200.0/encoding/base64.ts";
export { posix, win32 } from "https://deno.land/std@0.200.0/path/mod.ts";
export { walk } from "https://deno.land/std@0.200.0/fs/mod.ts";

import { DirectFileManipulator, } from "./lib/src/DirectFileManipulator.ts";
export type { DirectFileManipulatorOptions, MetaEntry, ReadyEntry } from "./lib/src/DirectFileManipulator.ts";
export { getDocData } from "./lib/src/utils.ts";
export type { FilePathWithPrefix } from "./lib/src/types.ts";
export { DirectFileManipulator }

export { Logger } from "./lib/src/logger.ts";
export { LOG_LEVEL_INFO } from "./lib/src/types.ts";