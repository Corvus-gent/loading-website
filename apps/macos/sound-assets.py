from math import exp, pi, sin
from pathlib import Path
import struct
import sys
import wave

output = Path(sys.argv[1])
rate = 22050
cues = {
    "squawk": [(0, 660, 890, .16), (.13, 930, 560, .15)],
    "cannon": [(0, 145, 31, .52), (.02, 76, 27, .38)],
}

for name, notes in cues.items():
    samples = []
    for i in range(int(.63 * rate)):
        t = i / rate
        value = 0
        for delay, start, end, length in notes:
            p = t - delay
            if 0 <= p < length:
                phase = 2 * pi * (start * p + (end - start) * p**2 / (2 * length))
                value += sin(phase) * exp(-5 * p / length) * min(1, p * 400) * .31
        samples.append(struct.pack("<h", round(value * 32767)))
    with wave.open(str(output / (name + ".wav")), "wb") as file:
        file.setparams((1, 2, rate, len(samples), "NONE", "not compressed"))
        file.writeframes(b"".join(samples))
