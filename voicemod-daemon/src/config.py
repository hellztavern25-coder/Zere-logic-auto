"""
ZereØ DSP Configuration & Operational Parameters
"""

DEFAULT_SAMPLE_RATE = 44100
DEFAULT_FRAME_SIZE = 1024
DEFAULT_HOP_SIZE = 256
SOCKET_PATH = "/tmp/voicemod.sock"

EFFECT_PROFILES = {
    "TACTICAL_DEEP": {
        "pitch": 0.75,
        "ring_mod": 0.0,
        "gain": 1.25,
        "description": "Deep tactical frequency shift for command clarity"
    },
    "CYBERNETIC": {
        "pitch": 0.85,
        "ring_mod": 45.0,
        "gain": 1.1,
        "description": "Subtle metallic ring modulation overlay"
    },
    "STEWARD_LOGIC": {
        "pitch": 0.92,
        "ring_mod": 12.0,
        "gain": 1.0,
        "description": "Standard Steward Voice DSP calibration"
    },
    "BYPASS": {
        "pitch": 1.0,
        "ring_mod": 0.0,
        "gain": 1.0,
        "description": "Unmodified passthrough"
    }
}
