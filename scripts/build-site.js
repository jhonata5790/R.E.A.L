const fs = require("node:fs");
const path = require("node:path");
const { root } = require("./site-files.js");
const { checkSite } = require("./check-site.js");
const { prepare } = require("./site-seo.js");

function listFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Link não permitido na saída: ${target}`);
        return entry.isDirectory() ? listFiles(target) : [target];
    });
}

try {
    const files = checkSite();
    const output = path.join(root, "outputs", "site");
    const knownFiles = new Set([...files, "robots.txt", "sitemap.xml"]);
    if (fs.existsSync(output)) {
        for (const existing of listFiles(output)) {
            const relative = path.relative(output, existing).split(path.sep).join("/");
            if (!knownFiles.has(relative)) throw new Error(`A saída contém um arquivo inesperado: ${relative}. Revise outputs/site antes de gerar novamente.`);
        }
    }
    fs.mkdirSync(output, { recursive: true });
    for (const file of files) {
        const target = path.join(output, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
    }
    prepare(output);
    console.log(`Publicação preparada em ${output} (${knownFiles.size} arquivos).`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
