// Imagens sintéticas para conferir mapa, tokens e prévias sem usar arquivos pessoais.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const output = path.join(__dirname, "..", "outputs", "demo-assets");
fs.mkdirSync(output, { recursive: true });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name); const header = Buffer.alloc(4); header.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([header, type, data, crc]); }
function png(width, height, pixel) {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const color = pixel(x, y); raw.set(color, y * (width * 4 + 1) + 1 + x * 4); }
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const rooms = [[60,50,250,135], [370,50,660,135], [60,245,250,355], [370,245,660,355], [230,125,430,270]];
fs.writeFileSync(path.join(output, "mapa-demonstracao.png"), png(720,405,(x,y) => {
    for (const [l,t,r,b] of rooms) if (x >= l && x <= r && y >= t && y <= b) {
        if (x < l+5 || x > r-5 || y < t+5 || y > b-5) return [150,120,143,255];
        return x % 30 === 0 || y % 30 === 0 ? [66,55,70,255] : [41,33,47,255];
    }
    return [15,11,19,255];
}));
fs.writeFileSync(path.join(output, "token-demonstracao.png"), png(96,96,(x,y) => {
    const distance = Math.hypot(x-48,y-48);
    if (distance > 44) return [0,0,0,0];
    if (distance > 39) return [116,218,170,255];
    if (Math.hypot(x-48,y-35) < 12 || (y > 51 && Math.hypot((x-48)/1.4,y-68) < 19)) return [230,239,227,255];
    return [35,74,65,255];
}));
console.log(output);
