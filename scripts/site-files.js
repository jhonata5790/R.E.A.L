// Lista explícita: somente estes arquivos fazem parte do site publicado.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pages = ["index.html", "mesa.html", "mesa-jogador.html"];
const assetDirectories = ["assets/css", "assets/js/portal", "assets/js/shared", "assets/js/tabletop"];

function siteFiles() {
    return [...pages, ...assetDirectories.flatMap((directory) =>
        fs.readdirSync(path.join(root, directory), { withFileTypes: true })
            .filter((entry) => entry.isFile() && /\.(?:js|css)$/.test(entry.name))
            .map((entry) => `${directory}/${entry.name}`)
    )].sort();
}

module.exports = { root, pages, siteFiles };
