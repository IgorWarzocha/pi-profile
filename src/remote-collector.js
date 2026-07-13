import { collect } from "./collector.js";
const machine = process.env.PI_MACHINE ?? process.argv[process.argv.indexOf("--machine") + 1] ?? "desktop";
process.stdout.write(JSON.stringify(await collect({ machine })));
