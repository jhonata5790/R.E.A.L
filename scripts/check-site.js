const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { root, pages, siteFiles } = require("./site-files.js");

function checkSite() {
    const files = siteFiles();
    const published = new Set(files);
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, page), "utf8");
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            const ref = match[1];
            if (/^(?:https?:|data:|#)/.test(ref)) continue;
            const pathname = ref.split(/[?#]/)[0];
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(page), pathname));
            if (!published.has(target)) throw new Error(`${page}: recurso fora da publicação ou ausente: ${ref}`);
        }
    }
    for (const file of files.filter((name) => name.endsWith(".js"))) {
        const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
    }
    console.log(`Site conferido: ${pages.length} páginas, ${files.length} arquivos e caminhos válidos.`);
    return files;
}

if (require.main === module) {
    try { checkSite(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkSite };
