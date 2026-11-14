"""Usage: python voice.py <workdir> <voice> <speed>. Reads <workdir>/lines.json, writes <workdir>/v<i>.wav.
Needs kokoro-onnx, numpy, soundfile and the Kokoro v1.0 model files in $KOKORO_DIR."""
import json
import os
import pathlib
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

WORK = pathlib.Path(sys.argv[1])
VOICE, SPEED = sys.argv[2], float(sys.argv[3])
MODEL_DIR = pathlib.Path(os.environ['KOKORO_DIR'])
SILENCE_DB, EDGE_PAD_S = -45, 0.04

tts = Kokoro(str(MODEL_DIR / 'kokoro-v1.0.onnx'), str(MODEL_DIR / 'voices-v1.0.bin'))
lang = 'en-gb' if VOICE.startswith('b') else 'en-us'


def trim(a, sr):
    loud = np.flatnonzero(np.abs(a) > 10 ** (SILENCE_DB / 20))
    pad = int(EDGE_PAD_S * sr)
    return a[max(loud[0] - pad, 0):loud[-1] + pad]


for i, text in enumerate(json.loads((WORK / 'lines.json').read_text())):
    audio, sr = tts.create(text, voice=VOICE, speed=SPEED, lang=lang)
    sf.write(WORK / f'v{i}.wav', trim(audio, sr), sr)
