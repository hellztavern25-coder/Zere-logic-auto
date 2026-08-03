"""
ZereØ DSP Core - Real-Time Spectral Manipulation Engine
"""
import numpy as np

class VoiceDSP:
    def __init__(self, sample_rate: int = 44100, frame_size: int = 1024, hop_size: int = 256):
        self.sample_rate = sample_rate
        self.frame_size = frame_size
        self.hop_size = hop_size
        self.window = np.hanning(frame_size)
        
        # State buffers for phase vocoder
        self.input_phase = np.zeros(frame_size // 2 + 1)
        self.output_phase = np.zeros(frame_size // 2 + 1)
        
        # Operational parameters
        self.pitch_shift = 1.0  # 1.0 = normal, 0.8 = deep/robotic, 1.25 = higher
        self.ring_mod_freq = 0.0 # Cybernetic modulation (Hz), 0.0 = disabled
        self.gain = 1.0

    def set_parameters(self, pitch: float = None, ring_mod: float = None, gain: float = None):
        if pitch is not None:
            self.pitch_shift = max(0.5, min(2.0, pitch))
        if ring_mod is not None:
            self.ring_mod_freq = max(0.0, min(1000.0, ring_mod))
        if gain is not None:
            self.gain = max(0.0, min(3.0, gain))

    def process_frame(self, in_data: np.ndarray, time_index: float) -> np.ndarray:
        """
        Process a single audio chunk (1D float32 array).
        """
        if len(in_data) < self.frame_size:
            return in_data * self.gain

        # Windowing
        windowed = in_data * self.window
        
        # FFT
        spectrum = np.fft.rfft(windowed)
        magnitude = np.abs(spectrum)
        phase = np.angle(spectrum)

        # 1. Pitch Shifting / Resampling in Frequency Domain
        if self.pitch_shift != 1.0:
            indices = np.arange(len(magnitude))
            resampled_indices = indices / self.pitch_shift
            resampled_indices = np.clip(resampled_indices, 0, len(magnitude) - 1)
            
            # Interpolate magnitude across shifted frequencies
            magnitude = np.interp(indices, resampled_indices, magnitude)

        # Reconstruct phase
        phase_diff = phase - self.input_phase
        self.input_phase = phase
        
        # Phase unwrap step adjustment
        phase_diff = phase_diff - 2 * np.pi * np.round(phase_diff / (2 * np.pi))
        self.output_phase += phase_diff * self.pitch_shift
        
        # Recombine spectrum
        modified_spectrum = magnitude * np.exp(1j * self.output_phase)
        
        # Inverse FFT
        out_frame = np.fft.irfft(modified_spectrum) * self.window

        # 2. Cybernetic / Ring Modulation Overlay (Optional DSP effect)
        if self.ring_mod_freq > 0.0:
            t = (time_index + np.arange(len(out_frame))) / self.sample_rate
            carrier = np.sin(2 * np.pi * self.ring_mod_freq * t)
            out_frame = (out_frame * 0.7) + (out_frame * carrier * 0.3)

        return (out_frame * self.gain).astype(np.float32)
