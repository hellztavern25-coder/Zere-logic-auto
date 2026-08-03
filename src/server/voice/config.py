"""
ZereØ Voice DSP Configuration & Presets
Location: src/server/voice/config.py
"""

DEFAULT_SAMPLE_RATE = 44100
DEFAULT_FRAME_SIZE = 1024
DEFAULT_HOP_SIZE = 256
SOCKET_PATH = "/tmp/voicemod.sock"

PRESETS = {
    "TACTICAL_DEEP": {
        "pitch": 0.75,
        "ring_mod": 0.0,
        "gain": 1.25,
        "name": "Tactical Deep"
    },
    "CYBERNETIC": {
        "pitch": 0.85,
        "ring_mod": 45.0,
        "gain": 1.1,
        "name": "Cybernetic"
    },
    "STEWARD_CALIBRATION": {
        "pitch": 0.92,
        "ring_mod": 12.0,
        "gain": 1.0,
        "name": "Steward Calibration"
    },
    "BYPASS": {
        "pitch": 1.0,
        "ring_mod": 0.0,
        "gain": 1.0,
        "name": "Passthrough"
    }
}
