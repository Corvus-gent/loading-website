"""Prepare Gabe's Recraft uploads. Requires Pillow, NumPy, and SciPy."""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SOURCE = Path("hackersbay-art-raw")
OUT = Path("public/hackersbay/art")
NEAREST = Image.Resampling.NEAREST
CREW = ["deckhand", "navigator", "quartermaster", "merchant"]
POSES = ["wave", "typing", "flying", "squawk", "thumbs-up", "celebrate"]
PARTS = {
    "hat": ["tricorn", "captain", "bandana", "beanie", "crown"],
    "eyes": ["amber", "patch", "goggles", "teal", "visor"],
    "coat": ["hoodie", "trench", "vest", "captain", "sonar"],
    "item": ["laptop", "cutlass", "spyglass", "flask", "map"],
}


def artwork(name):
    return Image.open(SOURCE / name / "image.png")


def crisp(image):
    rgba = np.array(image.convert("RGBA"))
    # The uploads already have transparency. Drop the semitransparent matte
    # and clear its RGB data without touching bright pixels within each sprite.
    rgba[..., 3] = np.where(rgba[..., 3] >= 128, 255, 0)
    rgba[rgba[..., 3] == 0] = 0
    return Image.fromarray(rgba)


def crop(image, size):
    bounds = image.getbbox()
    if not bounds:
        raise ValueError("Empty sprite")
    image = image.crop(bounds)
    image.thumbnail(size, NEAREST)
    return image


def frame(image, size, border=4, bottom=False):
    width, height = size
    sprite = crop(image, (width - border * 2, height - border * 2))
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(sprite, ((width - sprite.width) // 2, height - sprite.height - border if bottom else (height - sprite.height) // 2))
    return canvas


def pair(name, image):
    image.save(OUT / (name + ".webp"), lossless=True, method=6)
    image.save(OUT / (name + ".png"), optimize=True)


def components(image, minimum=1000):
    rgba = np.array(image.convert("RGBA"))
    labels, _ = ndimage.label(rgba[..., 3] >= 75, structure=np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    found = []
    for i, (y, x) in enumerate(ndimage.find_objects(labels), 1):
        if sizes[i] >= minimum:
            found.append((i, (x.start, y.start, x.stop, y.stop)))
    return rgba, labels, found


def isolated(rgba, labels, keys):
    mask = np.isin(labels, keys)
    sprite = np.where(mask[..., None], rgba, 0)
    return crisp(Image.fromarray(sprite))


def prepare_sheets():
    rgba, labels, found = components(artwork("crew-parrots"), minimum=40000)
    assert len(found) == len(CREW)
    for name, (key, _) in zip(CREW, sorted(found, key=lambda row: row[1][0])):
        pair("crew-" + name, frame(isolated(rgba, labels, [key]), (132, 144), bottom=True))

    rgba, labels, found = components(artwork("mascot-poses"))
    main_poses = [(key, box) for key, box in found if box[2] - box[0] > 170]
    assert len(main_poses) == len(POSES)
    main_poses.sort(key=lambda row: (row[1][1] // 275, row[1][0]))
    for name, (key, _) in zip(POSES, main_poses):
        keys = [key]
        if name == "celebrate":
            keys += [i for i, box in found if box[0] > 620 and box[1] > 540 and i != key]
        pair("squawk-" + name, frame(isolated(rgba, labels, keys), (150, 150), bottom=True))

    rgba, labels, found = components(artwork("parts"), minimum=4000)
    assert len(found) == 20
    for (group, names), start, stop in zip(PARTS.items(), [0, 200, 430, 670], [200, 430, 670, 896]):
        hits = [(key, box) for key, box in found if start <= box[1] < stop]
        assert len(hits) == 5, group
        for name, (key, _) in zip(names, sorted(hits, key=lambda row: row[1][0])):
            pair(group + "-" + name, crop(isolated(rgba, labels, [key]), (92, 76)))


def prepare_scene():
    high = artwork("hero-ship").convert("RGB")
    def poster(image):
        return image.resize((672, 384), NEAREST).quantize(colors=128, dither=Image.Dither.NONE)

    pair("hero-ship", poster(high))
    mask = Image.new("L", high.size)
    d = ImageDraw.Draw(mask)
    boat = [
        (908,441),(920,438),(937,453),(979,468),(1043,500),(1104,549),
        (1164,575),(1198,598),(1227,600),(1228,625),(1214,644),
        (1196,658),(1152,659),(1091,648),(1041,632),(990,617),
        (965,600),(945,564),(927,517),(915,468),
    ]
    d.polygon(boat, fill=255)
    rgb = np.array(high)
    inside = np.array(mask) > 0
    dark_boat = (rgb[..., 0] < 117) & (rgb[..., 1] < 164) & (rgb[..., 2] < 183)
    boat_layer = high.convert("RGBA")
    boat_layer.putalpha(Image.fromarray(np.where(inside & dark_boat, 255, 0).astype("uint8")))
    boat_bounds = boat_layer.getbbox()
    # Even coordinates keep every layer aligned when the poster is halved.
    bounds = tuple(n // 2 * 2 if i < 2 else (n + 1) // 2 * 2 for i, n in enumerate(boat_bounds))
    x, y, right, bottom = bounds
    pair("hero-rowboat", crisp(boat_layer.crop(bounds).resize(((right-x)//2, (bottom-y)//2), NEAREST)))

    d.polygon([
        (890,420),(942,434),(994,453),(1050,475),(1120,527),(1190,564),
        (1250,581),(1248,665),(1180,679),(1081,673),(1007,646),(949,625),
        (912,565),(896,479),
    ], fill=255)
    d.line([(800,394), (1020,305)], fill=255, width=47)
    for x, y, r in [(956,357,16),(964,389,17),(980,432,16),(1020,402,18),(990,459,12)]:
        d.ellipse((x-r,y-r,x+r,y+r),fill=255)
    removed = np.asarray(mask) > 0
    removed[:, :791] = False
    _, nearest = ndimage.distance_transform_edt(removed, return_indices=True)
    clean = rgb[tuple(nearest)].copy()
    for y, x in zip(*np.where(removed[:596])):
        # Follow the upward diagonal of the cloud bands into intact art.
        for dx in range(8, 467, 8):
            sx, sy = x + dx, max(0, int(y - dx * .41))
            if sx >= high.width:
                break
            if not removed[sy, sx]:
                clean[y, x] = rgb[sy, sx]
                break
    for y in range(596, high.height):
        removed_x = np.flatnonzero(removed[y])
        if len(removed_x):
            clean[y, removed_x] = rgb[y, 682 + (removed_x - 682) % 216]
    pair("hero-sea", poster(Image.fromarray(clean)))
    print("Rowboat origin on 672×384 canvas:", bounds[0]//2, bounds[1]//2)


def main():
    global SOURCE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("uploads", type=Path, nargs="?", default=SOURCE)
    SOURCE = parser.parse_args().uploads
    OUT.mkdir(parents=True, exist_ok=True)
    pair("captain-squawk", frame(crisp(artwork("mascot")), (192, 230)))
    pair("captain-squawk-sitting", frame(crisp(artwork("mascot-sitting")), (192, 230)))
    pair("mutual-beak-bump", crop(crisp(artwork("mutual")), (480, 360)))
    icon = crisp(artwork("logo-icon"))
    pair("captain-icon", frame(icon, (128, 128), 8))
    pair("app-icon-192", frame(icon, (192, 192), 12))
    pair("app-icon-512", frame(icon, (512, 512), 32))
    frame(icon, (512, 512), 32).save("hackersbay-app/icon.png", optimize=True)
    coin = Image.new("RGBA", (18, 18))
    d = ImageDraw.Draw(coin)
    d.rounded_rectangle((2, 2, 16, 16), radius=3, fill="#8c4e2e")
    d.rectangle((5, 4, 13, 14), fill="#ffc66b")
    d.rectangle((4, 6, 14, 12), fill="#ffc66b")
    d.line((6, 5, 11, 5), fill="#fff4aa")
    d.line((8, 6, 8, 11), fill="#c6863e", width=2)
    pair("coin", coin)
    prepare_sheets()
    prepare_scene()


if __name__ == "__main__":
    main()
