import sys

import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR, BPM, DURATION = 44100, 120, 28
BEAT = 60 / BPM
CUTS = [4, 8, 14, 18]
HIT = 22
CHORDS = [(57, [0, 3, 7]), (53, [0, 4, 7]), (60, [0, 4, 7]), (55, [0, 4, 7])]
rng = np.random.default_rng(7)
N = SR * DURATION
mix = np.zeros((2, N))
wet = np.zeros((2, N))


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def add(buf, sig, t0, pan=0.0):
    i = int(t0 * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= N:
        return
    sig = sig[: N - i]
    buf[0, i : i + len(sig)] += sig * (1 - pan) / 2 * 1.4
    buf[1, i : i + len(sig)] += sig * (1 + pan) / 2 * 1.4


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, f):
    return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def highpass(x, f):
    return sosfilt(butter(2, f, "high", fs=SR, output="sos"), x)


def pad(root, ivs, d):
    t = tt(d)
    out = np.zeros_like(t)
    for iv in ivs:
        for det in (-0.07, 0.07):
            f = hz(root + 12 + iv) * 2 ** (det / 12)
            for h, a in ((1, 1), (2, 0.4), (3, 0.2), (4, 0.1)):
                out += a * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6))
    env = np.minimum(1, t / 0.9) * np.minimum(1, (d - t) / 0.9)
    return lowpass(out * env, 1800) / 14


def pluck(m, d=0.35):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)
    return s * np.exp(-t * 11) * 0.5


def kick():
    t = tt(0.4)
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.9


def hat():
    t = tt(0.08)
    return highpass(rng.normal(size=len(t)), 7000) * np.exp(-t * 60) * 0.12


def clap():
    t = tt(0.25)
    return highpass(rng.normal(size=len(t)), 1200) * np.exp(-t * 22) * 0.3


def bass(m, d):
    t = tt(d)
    return (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(2 * np.pi * 2 * hz(m) * t)) * np.exp(-t * 3.2) * 0.5


def whoosh(d=0.9, up=True):
    t = tt(d)
    n = rng.normal(size=len(t))
    env = (t / d) ** 2 if up else (1 - t / d) ** 2
    return lowpass(highpass(n, 400), 6000) * env * 0.22


bars = DURATION // 2
for b in range(bars):
    root, ivs = CHORDS[b % 4]
    t0 = b * 2
    gain = 0.8 if b < 2 else 1.0
    add(wet, pad(root, ivs, 2.4) * gain, t0 - 0.2)
    if 2 <= b < 11 or b >= 11:
        for beat in range(4):
            if b == 10 and beat == 3:
                continue
            add(mix, bass(root - 12, 0.5), t0 + beat * BEAT)
    for step in range(8):
        tm = t0 + step * BEAT / 2
        note = root + 12 + ivs[(step * 2) % 3] + (12 if step % 4 == 3 else 0)
        if b >= 2 and b != 10:
            add(wet, pluck(note), tm, pan=(-0.4 if step % 2 else 0.4))
            add(mix, pluck(note) * 0.35, tm, pan=(-0.4 if step % 2 else 0.4))
        elif b < 2 and step % 4 == 0:
            add(wet, pluck(root + 24 + ivs[step // 4 * 2 % 3]) * 0.6, tm)
    if b >= 2 and b != 10:
        for beat in range(4):
            add(mix, kick(), t0 + beat * BEAT)
    if b >= 4:
        for step in range(8):
            add(mix, hat() * (1.4 if step % 2 else 0.8), t0 + step * BEAT / 2 + 0.0, pan=0.3)
        for beat in (1, 3):
            add(mix, clap(), t0 + beat * BEAT)

# build into the hit: snare roll bar 9-10, riser, then a breath of silence
t_roll = 19.5
for k in range(16):
    add(mix, clap() * (0.3 + k * 0.05), t_roll + k * 0.125 + 0.0)
add(mix, whoosh(2.0, True), 20.0)
for c in CUTS:
    add(mix, whoosh(0.5, True), c - 0.5)

# the hit on the CTA
t = tt(2.5)
boom = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.2) * 1.1
add(mix, boom, HIT)
add(mix, whoosh(1.6, False), HIT, pan=0)
add(wet, pad(57, [0, 7, 12, 15], 6.0) * 1.5, HIT)
for i, m in enumerate([69, 72, 76, 81]):
    add(wet, pluck(m, 0.9) * 1.2, HIT + 0.02 + i * 0.12)

# silence dip just before the hit
dip = np.ones(N)
a, b2 = int(21.78 * SR), int(HIT * SR)
dip[a:b2] = np.linspace(1, 0.05, b2 - a)
mix *= dip
wet *= dip

ir_t = tt(1.8)
ir = [rng.normal(size=len(ir_t)) * np.exp(-ir_t * 3.2) for _ in range(2)]
out = np.stack([mix[c] + fftconvolve(wet[c], ir[c] * 0.012)[:N] + wet[c] * 0.5 for c in range(2)])
fade = np.minimum(1, (DURATION - tt(DURATION)) / 1.2) * np.minimum(1, tt(DURATION) / 0.3)
out *= fade
out /= np.abs(out).max() * 1.05
wavfile.write(sys.argv[1], SR, (out.T * 32767).astype(np.int16))
