const fs = require("node:fs"), path = require("node:path");
const { root } = require("./site-files.js");
const description = "R.E.A.L é um tabletop online para RPG. Crie mesas, organize cenas, mapas e tokens e compartilhe a visão dos jogadores em tempo real.";
function siteUrl(settings, env = process.env) {
    const configured = env.REAL_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : settings.siteUrl);
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("O endereço público deve usar HTTPS, sem senha, parâmetros ou fragmentos.");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.href;
}
const escape = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function homeHead(base, verification = "") {
    if (verification && !/^[A-Za-z0-9_-]{10,200}$/.test(verification)) throw new Error("Código de verificação do Google inválido.");
    const schema = { "@context": "https://schema.org", "@type": new URL(base).pathname === "/" ? "WebSite" : "WebPage",
        name: "R.E.A.L", alternateName: ["REAL Tabletop", "R.E.A.L Tabletop"], url: base, inLanguage: "pt-BR", description };
    return [
        `<link rel="canonical" href="${escape(base)}">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:site_name" content="R.E.A.L">`,
        `<meta property="og:title" content="R.E.A.L — Tabletop online para RPG">`,
        `<meta property="og:description" content="${escape(description)}">`,
        `<meta property="og:url" content="${escape(base)}">`,
        `<meta property="og:locale" content="pt_BR">`,
        `<meta name="twitter:card" content="summary">`,
        ...(verification ? [`<meta name="google-site-verification" content="${escape(verification)}">`] : []),
        `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`
    ].join("\n    ");
}
function robots(base, preview = false) {
    if (preview) return "User-agent: *\nDisallow: /\n";
    // Do not block the app URLs: Google needs to crawl their noindex directives.
    return "User-agent: *\nAllow: /\nDisallow: /archive/\nDisallow: /outputs/\nDisallow: /tests/\nDisallow: /scripts/\nDisallow: /supabase/\nSitemap: " + new URL("sitemap.xml", base).href + "\n";
}
function sitemap(base, preview = false) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${preview ? "" : `\n  <url><loc>${escape(base)}</loc></url>\n`}</urlset>\n`;
}
function prepare(output, settings = JSON.parse(fs.readFileSync(path.join(root, "site-config.json"), "utf8")), env = process.env) {
    const base = siteUrl(settings, env), preview = env.VERCEL_ENV === "preview";
    const target = path.join(output, "index.html"); let html = fs.readFileSync(target, "utf8");
    if (!html.includes("<!-- REAL:SEO -->")) throw new Error("Marcador SEO ausente na página inicial.");
    html = html.replace("<!-- REAL:SEO -->", homeHead(base, settings.googleVerification));
    if (preview) html = html.replace('content="index, follow, max-image-preview:large"', 'content="noindex, nofollow"');
    fs.writeFileSync(target, html);
    fs.writeFileSync(path.join(output, "robots.txt"), robots(base, preview));
    fs.writeFileSync(path.join(output, "sitemap.xml"), sitemap(base, preview));
    console.log(`SEO preparado para ${base}${preview ? " (prévia fora da busca)" : ""}`);
    return base;
}
module.exports = { siteUrl, homeHead, robots, sitemap, prepare };
