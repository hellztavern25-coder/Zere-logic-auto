# ZereØ Voice Modulation Daemon (voicemod-daemon)

High-efficiency, low-latency DSP voice modulation daemon with Phase Vocoder pitch & formant manipulation, ring modulation, async Unix domain socket IPC, and executable CLI controller (`modctl`).

## Directory Structure

```
voicemod-daemon/
├── README.md
├── requirements.txt
├── systemd/
│   └── voicemod.service
├── src/
│   ├── __init__.py
│   ├── dsp.py          # Real-time Pitch & Formant Processing Engine
│   ├── daemon.py       # Main Audio Loop & IPC Socket Listener
│   └── config.py       # Operational Parameters & Effect Profiles
└── bin/
    └── modctl          # CLI Controller to tweak parameters on the fly
```

## Quick Start

1. Install Dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Make `modctl` Executable:
   ```bash
   chmod +x bin/modctl
   ```

3. Launch Daemon:
   ```bash
   python3 src/daemon.py
   ```

4. Control DSP in Real-time via CLI:
   ```bash
   # Deep tactical pitch shift
   ./bin/modctl --pitch 0.75 --gain 1.2

   # Cybernetic ring modulation
   ./bin/modctl --pitch 0.85 --ring 45.0

   # Query status
   ./bin/modctl --status
   ```
