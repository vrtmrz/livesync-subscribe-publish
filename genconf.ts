function applyEnv<T extends Record<string, Record<string, any>>>(obj: T, prefix: string) {
    const ret = JSON.parse(JSON.stringify(obj));
    const keys = Object.keys(ret);
    for (const key of keys) {
        const envKey = `${prefix}_${key}`.toUpperCase();
        // console.log(envKey);
        if (typeof ret[key] === "object" && !Array.isArray(ret[key])) {
            ret[key] = applyEnv(ret[key], envKey);
        } else {
            const envValue = Deno.env.get(envKey);
            if (!envValue) continue;
            if (!Array.isArray(ret[key])) {
                ret[key] = envValue;
            } else {
                ret[key] = envValue.split(",");
            }
        }
    }
    return ret as T;
}
const confTemplate = JSON.parse(await Deno.readTextFile("./config.sample.jsonc"));
const newTemplate = applyEnv(confTemplate, "LSSP");
await Deno.writeTextFile("./config.jsonc", JSON.stringify(newTemplate, null, 2));
