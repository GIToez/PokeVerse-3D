"""Give imported Pixelmon wings a Scyther-sized flutter.

Pixelmon's Scizor only twitches its wings about 5 degrees, and Mega Scizor's
wings have no keys at all. Scyther, which ships with its own model, swings
them about 25 degrees roughly ten times a second. Run again after a model is
reconverted; it rebuilds the wing tracks and leaves the rest of the clip alone.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelmon_bmd_to_glb import flutter_glb  # noqa: E402

MON = Path(__file__).resolve().parent.parent / 'public' / 'scenery' / 'mon'

# Wing beats per second for each clip the field plays.
BEATS = {'Idle': 10, 'Run': 8}

# bone: (degrees either side of rest, lag in radians behind the front wing)
WINGS = {
    'pm0212_00': {
        'UpperWing_L': (12, 0), 'UpperWing_R': (12, 0),
        'LowerWing_L': (10, 0.6), 'LowerWing_R': (10, 0.6),
    },
    'pm0212_51': {
        'LFeelera': (12, 0), 'RFeelera': (12, 0),
        'LFeelerB': (10, 0.6), 'RFeelerB': (10, 0.6),
    },
}


def main():
    names = sys.argv[1:] or list(WINGS)
    for name in names:
        rates = flutter_glb(MON / f'{name}.glb', WINGS[name], BEATS)
        print(name, ', '.join(f'{clip} {hz} beats/s' for clip, hz in rates.items()))


if __name__ == '__main__':
    main()
