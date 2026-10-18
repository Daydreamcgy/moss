"""Generate the Moss app icon: a light squircle tile with a serif M.

Usage: python tools/make-icon.py [A|B|C|D]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONTS = r"C:\Windows\Fonts"
S = 1024

VARIANTS = {
    "A": dict(font=f"{FONTS}\\georgiab.ttf", bg=(252, 252, 250), fg=(28, 28, 26), scale=0.60),
    "B": dict(font=f"{FONTS}\\georgiai.ttf", bg=(252, 252, 250), fg=(28, 28, 26), scale=0.62),
    "C": dict(font=f"{FONTS}\\georgiaz.ttf", bg=(252, 252, 250), fg=(28, 28, 26), scale=0.60),
    "D": dict(font=f"{FONTS}\\constanb.ttf", bg=(252, 252, 250), fg=(28, 28, 26), scale=0.60),
}


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def build(spec, letter="M"):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    bg = spec["bg"]
    top = tuple(min(255, c + 3) for c in bg)
    gradient = Image.new("RGBA", (1, S))
    for y in range(S):
        t = y / (S - 1)
        gradient.putpixel((0, y), tuple(int(top[i] + (bg[i] - top[i]) * t) for i in range(3)) + (255,))
    img.paste(gradient.resize((S, S)), (0, 0), rounded_mask(S, int(S * 0.225)))

    border = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [1, 1, S - 2, S - 2], radius=int(S * 0.225), outline=(0, 0, 0, 24), width=max(2, S // 340)
    )
    img.alpha_composite(border)

    font = ImageFont.truetype(spec["font"], int(S * spec["scale"]))
    draw = ImageDraw.Draw(img)
    box = draw.textbbox((0, 0), letter, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((S - w) / 2 - box[0], (S - h) / 2 - box[1] - S * 0.005),
        letter,
        font=font,
        fill=spec["fg"] + (255,),
    )
    return img


def main():
    variant = (sys.argv[1] if len(sys.argv) > 1 else "A").upper()
    if variant not in VARIANTS:
        variant = "A"

    spec = VARIANTS[variant]
    icon = build(spec)

    os.makedirs("build", exist_ok=True)
    os.makedirs("public", exist_ok=True)

    icon.save("build/icon.png")
    icon.resize((256, 256), Image.LANCZOS).save("public/icon.png")
    icon.save(
        "build/icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # Transparent glyph marks for the sidebar wordmark (one per theme family).
    for name, color in (("mark-dark", (28, 28, 26)), ("mark-light", (232, 231, 224))):
        mark = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        glyph = ImageFont.truetype(spec["font"], 210)
        draw = ImageDraw.Draw(mark)
        box = draw.textbbox((0, 0), "M", font=glyph)
        w, h = box[2] - box[0], box[3] - box[1]
        draw.text(
            ((256 - w) / 2 - box[0], (256 - h) / 2 - box[1] - 6),
            "M",
            font=glyph,
            fill=color + (255,),
        )
        mark.save(f"public/{name}.png")

    print(f"icon variant {variant}: build/icon.*, public/icon.png, public/mark-*.png")


if __name__ == "__main__":
    main()
