// No bank API, tracking, login or payment submission. The visitor completes Pix in their bank.
(function (scope) {
    "use strict";
    function crc16(text) {
        let crc = 0xffff;
        for (const byte of new TextEncoder().encode(text)) {
            crc ^= byte << 8;
            for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1 ^ 0x1021) & 0xffff : crc << 1 & 0xffff;
        }
        return crc.toString(16).toUpperCase().padStart(4, "0");
    }
    function fields(text) {
        const bytes = new TextEncoder().encode(text), decoder = new TextDecoder("utf-8", { fatal: true }), result = {};
        let offset = 0;
        while (offset < bytes.length) {
            const header = decoder.decode(bytes.slice(offset, offset + 4));
            if (!/^\d{4}$/.test(header)) throw new Error("Campo Pix inválido");
            const id = header.slice(0, 2), size = Number(header.slice(2)); offset += 4;
            if (offset + size > bytes.length || Object.hasOwn(result, id)) throw new Error("Campo Pix inválido");
            result[id] = decoder.decode(bytes.slice(offset, offset + size)); offset += size;
        }
        return result;
    }
    function inspect(payload) {
        try {
            if (typeof payload !== "string" || payload.length > 1000 || !/6304[0-9A-F]{4}$/.test(payload)) return null;
            const data = fields(payload), merchant = fields(data["26"] || "");
            if (data["00"] !== "01" || data["01"] !== "11" || data["53"] !== "986" || data["58"] !== "BR"
                || merchant["00"] !== "br.gov.bcb.pix" || !merchant["01"] || !data["59"] || data["63"] !== crc16(payload.slice(0, -4))) return null;
            return { receiver: data["59"], key: merchant["01"], openAmount: !Object.hasOwn(data, "54") };
        } catch { return null; }
    }
    const api = Object.freeze({ crc16, fields, inspect });
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (!scope.document) return;
    const code = scope.document.getElementById("pixCode"), button = scope.document.getElementById("copyPix"), status = scope.document.getElementById("pixStatus");
    if (!code || !button || !status) return;
    const payload = code.value, info = inspect(payload);
    button.hidden = false;
    if (!info?.openAmount || info.receiver !== "JHONATA MIRANDA SANTOS") {
        button.disabled = true; code.hidden = true;
        const qr = scope.document.getElementById("pixQr"); if (qr) qr.hidden = true;
        status.dataset.error = "true"; status.textContent = "Código Pix indisponível. Não use este QR Code; volte às mesas e tente mais tarde.";
        return;
    }
    button.addEventListener("click", async () => {
        button.disabled = true;
        try {
            if (!scope.navigator?.clipboard?.writeText) throw new Error("Copie manualmente");
            await scope.navigator.clipboard.writeText(payload);
            status.dataset.error = "false";
            status.textContent = "Código copiado! Cole no Pix do seu banco, escolha o valor e confira o recebedor.";
        } catch {
            code.focus(); code.select();
            status.dataset.error = "true";
            status.textContent = "Não foi possível copiar automaticamente. O código está selecionado: copie e cole no seu banco.";
        } finally { button.disabled = false; }
    });
})(typeof window === "undefined" ? globalThis : window);
