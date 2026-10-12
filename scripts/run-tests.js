const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { root } = require("./site-files.js");
const directory = process.argv[2] || "tests";
if (!["tests", "archive/rpg/tests"].includes(directory)) throw new Error("Diretório de testes não reconhecido.");
const tests = fs.readdirSync(path.join(root, directory)).filter((file) => file.endsWith(".test.js")).sort();
for (const test of tests) {
    const result = spawnSync(process.execPath, [path.join(root, directory, test)], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
}
if (!process.exitCode) console.log(`${tests.length} conjuntos de testes concluídos.`);
