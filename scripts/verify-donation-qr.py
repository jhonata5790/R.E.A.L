"""Independent, local-only QR decode. Optional test dependency: zxing-cpp."""
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "outputs" / "qa" / "pix-validator"))
import zxingcpp

html = (root / "apoie.html").read_text(encoding="utf-8")
expected = html.split('autocomplete="off">', 1)[1].split("</textarea>", 1)[0]
image = Image.open(root / "assets" / "images" / "apoio-pix.png")
result = zxingcpp.read_barcode(image)
assert result is not None and result.text == expected, "The QR must match the exact Copia e Cola."
# Also check the rendered QR size used on desktop and narrow phones.
for size in (228, 210, 190):
    decoded = zxingcpp.read_barcode(image.resize((size, size), Image.Resampling.NEAREST))
    assert decoded is not None and decoded.text == expected, f"Unreadable QR at {size}px."
print(f"QR decodificado de forma independente: {len(result.text)} caracteres idênticos ao Pix, inclusive em tamanhos de celular.")
