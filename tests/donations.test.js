const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const root = path.join(__dirname, ".."), rules = require("../assets/js/portal/donations.js");
const html = fs.readFileSync(path.join(root, "apoie.html"), "utf8"), home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const code = fs.readFileSync(path.join(root, "assets/js/portal/donations.js"), "utf8");
const payload = html.match(/<textarea[^>]*id="pixCode"[^>]*>([^<]+)<\/textarea>/)[1];
const exact = "00020101021126580014br.gov.bcb.pix0136d8b9789a-1fa3-4b59-8534-0b8571d0c4625204000053039865802BR5922JHONATA MIRANDA SANTOS6008BRASILIA62070503***63044784";
assert.equal(payload, exact, "preserva integralmente o código enviado pelo usuário");
assert.equal(rules.crc16(payload.slice(0, -4)), "4784");
assert.equal(rules.inspect(payload).receiver, "JHONATA MIRANDA SANTOS");
assert.equal(rules.inspect(payload).key, "d8b9789a-1fa3-4b59-8534-0b8571d0c462");
assert.equal(rules.inspect(payload).openAmount, true);
for (const invalid of [payload.slice(0, -1), payload + "extra", payload.replace("SANTOS", "SANTOZ"), "x".repeat(1001)]) assert.equal(rules.inspect(invalid), null);
assert.throws(() => rules.fields("000201000201"), /inválido/);
assert.throws(() => rules.fields("9910abc"), /inválido/);
const withAmount = payload.slice(0, -8) + "54045.006304";
assert.equal(rules.inspect(withAmount + rules.crc16(withAmount)).openAmount, false);
assert.match(home, /href="apoie.html"/); assert.match(html, /<noscript>/); assert.match(html, /antes de confirmar/);
assert.doesNotMatch(html, /supabase|visitor-name|https?:\/\//i, "página não chama serviços ou exige login");
assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|\.from\(/, "não envia nem registra dados bancários");
assert.ok(require("../scripts/site-files.js").siteFiles().includes("assets/images/apoio-pix.png"));
const png = fs.readFileSync(path.join(root, "assets/images/apoio-pix.png"));
assert.equal(png.subarray(1, 4).toString(), "PNG");
assert.equal(png.readUInt32BE(16), 456); assert.equal(png.readUInt32BE(20), 456);
assert.ok(png.includes(Buffer.from("Payload-SHA256\0" + crypto.createHash("sha256").update(payload).digest("hex"))), "imagem corresponde ao código atual; regenerar QR ao alterar o Pix");
async function ui(clipboard, value = payload) {
    const elements = {
        pixCode: { value, focused: false, selected: false, focus() { this.focused = true; }, select() { this.selected = true; } },
        copyPix: { hidden: true, disabled: false, addEventListener(event, fn) { this.click = fn; } },
        pixStatus: { dataset: {}, textContent: "" }, pixQr: { hidden: false }
    };
    vm.runInNewContext(code, { TextEncoder, TextDecoder, window: { document: { getElementById: id => elements[id] }, navigator: { clipboard } } });
    if (elements.copyPix.click) await elements.copyPix.click();
    return elements;
}
(async () => {
    let copied;
    const normal = await ui({ writeText: async value => { copied = value; } });
    assert.equal(copied, payload); assert.equal(normal.copyPix.disabled, false); assert.match(normal.pixStatus.textContent, /Código copiado/);
    const rejected = await ui({ writeText: async () => { throw new Error("Bloqueado"); } });
    assert.equal(rejected.pixCode.selected, true); assert.equal(rejected.pixCode.focused, true);
    assert.equal(rejected.copyPix.disabled, false); assert.match(rejected.pixStatus.textContent, /selecionado/);
    const unsupported = await ui(undefined); assert.equal(unsupported.pixCode.selected, true);
    const corrupt = await ui({ writeText: async () => assert.fail("não pode copiar código corrompido") }, payload.slice(0, -1) + "0");
    assert.equal(corrupt.copyPix.disabled, true); assert.equal(corrupt.pixQr.hidden, true); assert.equal(corrupt.pixCode.hidden, true);
    console.log("Doações: Pix sem valor fixo, CRC, recebedor, QR correspondente, cópia exata, alternativa manual e nenhuma chamada bancária: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
