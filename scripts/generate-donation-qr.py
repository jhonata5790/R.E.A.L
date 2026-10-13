"""Generate the QR entirely locally from the exact Copia e Cola shown on the page."""
from pathlib import Path
from html.parser import HTMLParser
from hashlib import sha256
from PIL import Image, ImageDraw, PngImagePlugin
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel


class PixCode(HTMLParser):
    collecting = False
    parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "textarea" and dict(attrs).get("id") == "pixCode":
            self.collecting = True

    def handle_data(self, data):
        if self.collecting:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "textarea":
            self.collecting = False


root = Path(__file__).resolve().parent.parent
parser = PixCode()
parser.feed((root / "apoie.html").read_text(encoding="utf-8"))
payload = "".join(parser.parts)
assert payload and payload.endswith("63044784"), "Review the Pix code before regenerating the QR."
qr = QRCode(None, QRErrorCorrectLevel.M)
qr.addData(payload)
qr.make()
modules, border, scale = qr.getModuleCount(), 4, 8
image = Image.new("RGB", ((modules + border * 2) * scale,) * 2, "white")
draw = ImageDraw.Draw(image)
for row in range(modules):
    for column in range(modules):
        if qr.isDark(row, column):
            x, y = (column + border) * scale, (row + border) * scale
            draw.rectangle((x, y, x + scale - 1, y + scale - 1), fill="black")
target = root / "assets" / "images" / "apoio-pix.png"
target.parent.mkdir(parents=True, exist_ok=True)
metadata = PngImagePlugin.PngInfo()
metadata.add_text("Payload-SHA256", sha256(payload.encode()).hexdigest())
image.save(target, pnginfo=metadata, optimize=True)
print(f"QR gerado localmente: {modules} módulos, {image.width}px, margem de 4 módulos.")
