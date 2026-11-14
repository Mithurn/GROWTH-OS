"""Usage: python3 build.py <workdir> <outdir>. Needs macOS `say`, ffmpeg, numpy, scipy, playwright."""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent
WORK = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
VOICE, RATE = 'Samantha', 170
DURATION, FPS = 28, 30
LINES = [
    (0.3, 'Somewhere in your customer data, your best buyers have gone quiet.'),
    (4.3, 'GrowthOS is an AI agent watching your customer data.'),
    (8.3, 'It finds seventy-six dormant VIPs, worth one point one lakh rupees, ready to win back.'),
    (14.3, 'Then it drafts the WhatsApp, email, or SMS campaign.'),
    (18.3, 'You approve. It sends, and tracks what converts.'),
    (22.4, "GrowthOS. Find the revenue you're losing, and win it back."),
]
DUCK = 'sidechaincompress=threshold=0.025:ratio=3.5:attack=15:release=450:makeup=1'


def run(*a):
    subprocess.run([str(x) for x in a], check=True)


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout)


def ts(s):
    return f'{int(s // 60):02d}:{s % 60:06.3f}'


WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

run('python3', ROOT / 'music.py', WORK / 'music.wav')

inputs, delays, vtt = [], [], ['WEBVTT', '']
for i, (start, text) in enumerate(LINES):
    f = WORK / f'v{i}.aiff'
    run('say', '-v', VOICE, '-r', RATE, '-o', f, text)
    d = duration(f)
    nxt = LINES[i + 1][0] if i + 1 < len(LINES) else DURATION
    print(f'line {i}: {start:.1f}s + {d:.2f}s (slot {nxt - start:.1f}s)')
    assert start + d < nxt - 0.1, f'line {i} overruns its slot'
    inputs += ['-i', f]
    delays.append(f'[{i}:a]adelay={int(start * 1000)}|{int(start * 1000)}[d{i}]')
    vtt += [f'{ts(start)} --> {ts(start + d + 0.2)}', text, '']
(OUT / 'growthos-launch.vtt').write_text('\n'.join(vtt))

n = len(LINES)
voice = ';'.join(delays) + ';' + ''.join(f'[d{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,volume=2.2,apad=whole_dur={DURATION}[vo]'
run('ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', voice, '-map', '[vo]', '-ar', 44100, '-ac', 2, WORK / 'voice.wav')

mixf = f'[1:a]asplit=2[vsc][vmix];[0:a][vsc]{DUCK}[duck];[duck][vmix]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7[a]'
run('ffmpeg', '-y', '-v', 'error', '-i', WORK / 'music.wav', '-i', WORK / 'voice.wav', '-filter_complex', mixf, '-map', '[a]', '-ar', 48000, '-t', DURATION, WORK / 'mix.wav')

frames = WORK / 'frames'
if not frames.exists() or len(list(frames.glob('f*.jpg'))) != FPS * DURATION:
    frames.mkdir(exist_ok=True)
    run('python3', ROOT / 'render.py', frames)

run('ffmpeg', '-y', '-v', 'error', '-framerate', FPS, '-i', frames / 'f%04d.jpg', '-i', WORK / 'mix.wav',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', 26, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', 128000, '-shortest', OUT / 'growthos-launch.mp4')
run('ffmpeg', '-y', '-v', 'error', '-i', OUT / 'growthos-launch.mp4', '-ss', 10, '-frames:v', 1, '-vf', 'scale=1280:-1', '-q:v', 5, OUT / 'growthos-launch-poster.jpg')
