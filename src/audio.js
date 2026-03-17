export class AudioManager {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.initialized = false;
    this.ambientNodes = {};
    this.footstepTimer = 0;
    this.footstepSide = false;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);

      // Compressor to prevent clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.ratio.value = 4;
      this.compressor.connect(this.masterGain);

      // Pre-generate noise buffers to avoid per-sound allocations
      this._noiseCache = {};
      for (const type of ['white', 'pink', 'brown']) {
        for (const dur of [0.03, 0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 1.0, 1.5]) {
          this._noiseCache[`${type}_${dur}`] = this._generateNoiseBuffer(dur, type);
        }
      }

      this.initialized = true;
      this.startAmbientLoop();
    } catch (e) {
      console.warn('Audio not available');
    }
  }

  // --- Core synthesis helpers ---

  // Generate a noise buffer (white/pink/brown) — internal, called once at init
  _generateNoiseBuffer(duration, type = 'white') {
    const len = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else if (type === 'brown') {
        data[i] = (b0 = (b0 + (0.02 * white)) / 1.02) * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  // Get a cached noise buffer (reuses pre-generated buffers, no per-call allocation)
  createNoiseBuffer(duration, type = 'white') {
    const key = `${type}_${duration}`;
    if (this._noiseCache && this._noiseCache[key]) return this._noiseCache[key];
    // Fallback for uncached durations — find nearest cached
    if (this._noiseCache) {
      const prefix = `${type}_`;
      let best = null, bestDiff = Infinity;
      for (const k in this._noiseCache) {
        if (k.startsWith(prefix)) {
          const d = Math.abs(parseFloat(k.slice(prefix.length)) - duration);
          if (d < bestDiff) { bestDiff = d; best = k; }
        }
      }
      if (best) return this._noiseCache[best];
    }
    return this._generateNoiseBuffer(duration, type);
  }

  // Play filtered noise burst
  playFilteredNoise(duration, freq, Q, vol, filterType = 'lowpass', noiseType = 'white') {
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer(duration, noiseType);
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = Q;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      source.start(t);
      source.stop(t + duration);
    } catch (e) {}
  }

  // Play a shaped tone with envelope
  playEnvTone(freq, attack, decay, sustain, release, type = 'sine', vol = 0.1, detune = 0) {
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const dur = attack + decay + sustain + release;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + attack);
      gain.gain.linearRampToValueAtTime(vol * 0.6, t + attack + decay);
      gain.gain.setValueAtTime(vol * 0.6, t + attack + decay + sustain);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    } catch (e) {}
  }

  // Simple tone (legacy compat)
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    this.playEnvTone(freq, 0.005, duration * 0.3, 0, duration * 0.7, type, volume);
  }

  // --- COMBAT SOUNDS ---

  playHit() {
    // Layered impact: thud + crack + ring
    this.playFilteredNoise(0.08, 800, 1, 0.1, 'bandpass', 'brown');
    this.playFilteredNoise(0.04, 3000, 2, 0.06, 'highpass');
    this.playEnvTone(150, 0.002, 0.03, 0, 0.08, 'sine', 0.08);
    this.playEnvTone(95, 0.002, 0.05, 0, 0.06, 'triangle', 0.06);
  }

  playSwing() {
    // Whoosh: filtered noise sweep
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer(0.2, 'pink');
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
      filter.frequency.exponentialRampToValueAtTime(800, t + 0.2);
      filter.Q.value = 3;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      source.start(t);
      source.stop(t + 0.25);
    } catch (e) {}
  }

  playDamage() {
    // Crunch + low rumble
    this.playFilteredNoise(0.15, 200, 1, 0.1, 'lowpass', 'brown');
    this.playFilteredNoise(0.06, 2500, 3, 0.06, 'bandpass');
    this.playEnvTone(80, 0.005, 0.05, 0.05, 0.15, 'sawtooth', 0.07);
  }

  playPickup() {
    // Pleasant two-note chime
    this.playEnvTone(660, 0.005, 0.05, 0, 0.15, 'sine', 0.06);
    this.playEnvTone(662, 0.005, 0.05, 0, 0.15, 'sine', 0.04, 5); // slight detune for chorus
    setTimeout(() => {
      this.playEnvTone(880, 0.005, 0.05, 0, 0.2, 'sine', 0.05);
      this.playEnvTone(882, 0.005, 0.05, 0, 0.2, 'sine', 0.03, 5);
    }, 90);
  }

  playQuestComplete() {
    // Triumphant fanfare
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => {
        this.playEnvTone(n, 0.01, 0.08, 0.1, 0.2, 'sine', 0.06);
        this.playEnvTone(n * 0.5, 0.01, 0.08, 0.1, 0.2, 'triangle', 0.03);
      }, i * 140);
    });
  }

  // --- FOOTSTEPS ---

  playFootstep(onSand) {
    if (!this.initialized) return;
    this.footstepSide = !this.footstepSide;
    const pitch = this.footstepSide ? 1.0 : 0.9;
    if (onSand) {
      // Soft sandy crunch
      this.playFilteredNoise(0.08, 1200 * pitch, 0.5, 0.03, 'lowpass', 'pink');
    } else {
      // Grass/dirt step
      this.playFilteredNoise(0.06, 800 * pitch, 0.8, 0.025, 'lowpass', 'brown');
      this.playFilteredNoise(0.03, 3000 * pitch, 2, 0.01, 'highpass');
    }
  }

  // --- NPC SOUNDS ---

  playNPCShout() {
    // Vocal burst: layered sawtooths with formant filter
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      // Two oscillators for vocal quality
      for (const [freq, det] of [[280, 0], [285, 10]]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(420, t + 0.15);
        osc.frequency.linearRampToValueAtTime(350, t + 0.25);
        osc.detune.value = det;
        // Formant filter
        const formant = this.ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = 1200;
        formant.Q.value = 2;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.06, t + 0.03);
        gain.gain.setValueAtTime(0.06, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(formant);
        formant.connect(gain);
        gain.connect(this.compressor);
        osc.start(t);
        osc.stop(t + 0.35);
      }
    } catch (e) {}
  }

  playNPCAttack() {
    // Short grunt + weapon whoosh
    this.playEnvTone(160, 0.005, 0.02, 0, 0.06, 'sawtooth', 0.05);
    this.playFilteredNoise(0.05, 600, 2, 0.04, 'bandpass', 'brown');
    setTimeout(() => {
      this.playFilteredNoise(0.1, 1500, 3, 0.04, 'bandpass', 'pink');
    }, 30);
  }

  playNPCHurt() {
    // Pained yelp with formant
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 1500;
      formant.Q.value = 3;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(formant);
      formant.connect(gain);
      gain.connect(this.compressor);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  }

  playNPCDowned() {
    // Low groan - slow descending with vibrato
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
      // Vibrato
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 800;
      formant.Q.value = 2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(formant);
      formant.connect(gain);
      gain.connect(this.compressor);
      osc.start(t); lfo.start(t);
      osc.stop(t + 0.55); lfo.stop(t + 0.55);
    } catch (e) {}
  }

  playNPCRevive() {
    // Rising hopeful tones with shimmer
    this.playEnvTone(330, 0.01, 0.05, 0.05, 0.15, 'sine', 0.04);
    this.playEnvTone(332, 0.01, 0.05, 0.05, 0.15, 'sine', 0.03, 5);
    setTimeout(() => {
      this.playEnvTone(495, 0.01, 0.05, 0.05, 0.15, 'sine', 0.04);
    }, 150);
    setTimeout(() => {
      this.playEnvTone(660, 0.01, 0.05, 0.1, 0.2, 'sine', 0.04);
      this.playEnvTone(662, 0.01, 0.05, 0.1, 0.2, 'sine', 0.03, 5);
    }, 300);
  }

  playNPCHeal() {
    // Warm shimmery ascending arpeggio
    const notes = [440, 554, 659, 880];
    notes.forEach((n, i) => {
      setTimeout(() => {
        this.playEnvTone(n, 0.01, 0.05, 0.05, 0.25, 'sine', 0.035);
        this.playEnvTone(n + 2, 0.01, 0.05, 0.05, 0.25, 'sine', 0.025, 7);
      }, i * 80);
    });
  }

  playNPCKillCheer() {
    this.playEnvTone(440, 0.005, 0.03, 0, 0.1, 'square', 0.03);
    setTimeout(() => this.playEnvTone(554, 0.005, 0.03, 0, 0.1, 'square', 0.03), 60);
    setTimeout(() => this.playEnvTone(660, 0.005, 0.03, 0.05, 0.12, 'square', 0.03), 120);
  }

  // --- ENEMY SOUNDS ---

  playEnemyGrowl() {
    // Low menacing growl
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60 + Math.random() * 30, t);
      osc.frequency.linearRampToValueAtTime(45, t + 0.3);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 20 + Math.random() * 10;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 15;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 3;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      osc.start(t); lfo.start(t);
      osc.stop(t + 0.4); lfo.stop(t + 0.4);
    } catch (e) {}
  }

  playEnemyDeath() {
    // Descending screech + thud
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.4);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      filter.Q.value = 2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      osc.start(t);
      osc.stop(t + 0.45);
    } catch (e) {}
    // Body thud
    setTimeout(() => {
      this.playFilteredNoise(0.1, 120, 1, 0.06, 'lowpass', 'brown');
    }, 300);
  }

  // --- WEATHER SOUNDS ---

  playThunder() {
    if (!this.initialized) return;
    try {
      const t = this.ctx.currentTime;
      // Initial crack
      const crack = this.ctx.createBufferSource();
      crack.buffer = this.createNoiseBuffer(0.1);
      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'highpass';
      crackFilter.frequency.value = 2000;
      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.12, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      crack.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.compressor);
      crack.start(t);
      crack.stop(t + 0.15);

      // Rolling rumble
      setTimeout(() => {
        const t2 = this.ctx.currentTime;
        const rumble = this.ctx.createBufferSource();
        rumble.buffer = this.createNoiseBuffer(1.5, 'brown');
        const rumbleFilter = this.ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(300, t2);
        rumbleFilter.frequency.exponentialRampToValueAtTime(80, t2 + 1.5);
        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.08, t2);
        rumbleGain.gain.setValueAtTime(0.06, t2 + 0.3);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, t2 + 1.5);
        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(this.compressor);
        rumble.start(t2);
        rumble.stop(t2 + 1.6);
      }, 80 + Math.random() * 150);
    } catch (e) {}
  }

  // --- AMBIENT SOUNDSCAPE ---

  startAmbientLoop() {
    if (!this.initialized) return;

    // Ocean waves loop
    this.loopOceanWaves();

    // Bird calls
    this.loopBirds();

    // Insect chorus (cicadas at night)
    this.loopInsects();

    // Wind
    this.loopWind();

    // Campfire crackling
    this.loopCampfire();

    // Distant animal calls
    this.loopAnimalCalls();
  }

  loopOceanWaves() {
    const playWave = () => {
      if (this.game.state !== 2) { setTimeout(playWave, 2000); return; }
      // Check if player is near the coast
      const p = this.game.camera.position;
      const dist = Math.sqrt(p.x * p.x + p.z * p.z);
      const coastVol = Math.max(0, Math.min(0.06, (dist - 60) / 400));
      if (coastVol > 0.005) {
        try {
          const t = this.ctx.currentTime;
          const dur = 2 + Math.random() * 1.5;
          const source = this.ctx.createBufferSource();
          source.buffer = this.createNoiseBuffer(dur, 'pink');
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, t);
          filter.frequency.linearRampToValueAtTime(600, t + dur * 0.3);
          filter.frequency.exponentialRampToValueAtTime(150, t + dur);
          filter.Q.value = 1;
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(coastVol, t + dur * 0.25);
          gain.gain.linearRampToValueAtTime(coastVol * 0.7, t + dur * 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);
          source.start(t);
          source.stop(t + dur + 0.1);
        } catch (e) {}
      }
      setTimeout(playWave, 3000 + Math.random() * 2000);
    };
    setTimeout(playWave, 1000);
  }

  loopBirds() {
    const playBird = () => {
      if (this.game.state !== 2) { setTimeout(playBird, 3000); return; }
      if (!this.game.isNight && Math.random() > 0.4) {
        try {
          const t = this.ctx.currentTime;
          // Tropical bird: rapid frequency modulated chirps
          const baseFreq = 1800 + Math.random() * 1500;
          const chirpCount = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < chirpCount; i++) {
            const ct = t + i * (0.08 + Math.random() * 0.06);
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, ct);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.1 + Math.random() * 0.3), ct + 0.04);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, ct + 0.07);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, ct);
            gain.gain.linearRampToValueAtTime(0.02, ct + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
            osc.connect(gain);
            gain.connect(this.compressor);
            osc.start(ct);
            osc.stop(ct + 0.08);
          }
        } catch (e) {}
      }
      setTimeout(playBird, 2500 + Math.random() * 5000);
    };
    setTimeout(playBird, 2000);
  }

  loopInsects() {
    const playInsect = () => {
      if (this.game.state !== 2) { setTimeout(playInsect, 3000); return; }
      // Louder at night, softer during day
      const vol = this.game.isNight ? 0.02 : 0.008;
      if (Math.random() > 0.3) {
        try {
          const t = this.ctx.currentTime;
          const dur = 0.5 + Math.random() * 1.5;
          // Cicada: high frequency modulated tone
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = 4000 + Math.random() * 2000;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 30 + Math.random() * 40;
          const lfoG = this.ctx.createGain();
          lfoG.gain.value = vol * 8;
          lfo.connect(lfoG);
          const gainNode = this.ctx.createGain();
          lfoG.connect(gainNode.gain);
          gainNode.gain.setValueAtTime(vol, t);
          gainNode.gain.setValueAtTime(vol, t + dur * 0.8);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + dur);
          osc.connect(gainNode);
          gainNode.connect(this.compressor);
          osc.start(t); lfo.start(t);
          osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
        } catch (e) {}
      }
      setTimeout(playInsect, 1500 + Math.random() * 3000);
    };
    setTimeout(playInsect, 3000);
  }

  loopWind() {
    const playGust = () => {
      if (this.game.state !== 2) { setTimeout(playGust, 4000); return; }
      if (Math.random() > 0.5) {
        try {
          const t = this.ctx.currentTime;
          const dur = 1.5 + Math.random() * 2;
          const source = this.ctx.createBufferSource();
          source.buffer = this.createNoiseBuffer(dur, 'pink');
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(300 + Math.random() * 200, t);
          filter.frequency.linearRampToValueAtTime(500 + Math.random() * 300, t + dur * 0.4);
          filter.frequency.linearRampToValueAtTime(200, t + dur);
          filter.Q.value = 0.5;
          const gain = this.ctx.createGain();
          const vol = 0.015 + Math.random() * 0.01;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);
          source.start(t);
          source.stop(t + dur + 0.1);
        } catch (e) {}
      }
      setTimeout(playGust, 4000 + Math.random() * 6000);
    };
    setTimeout(playGust, 2000);
  }

  loopCampfire() {
    const playCrackle = () => {
      if (this.game.state !== 2) { setTimeout(playCrackle, 2000); return; }
      // Only play when near the village campfire (60, 20)
      const p = this.game.camera.position;
      const dx = p.x - 60, dz = p.z - 20;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const vol = Math.max(0, 0.04 - dist * 0.002);
      if (vol > 0.003) {
        // Crackling: rapid short bursts of filtered noise
        const burstCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < burstCount; i++) {
          setTimeout(() => {
            this.playFilteredNoise(0.03 + Math.random() * 0.04, 2000 + Math.random() * 2000, 2, vol, 'highpass');
            this.playFilteredNoise(0.02, 300 + Math.random() * 200, 1, vol * 0.5, 'lowpass', 'brown');
          }, i * (40 + Math.random() * 60));
        }
      }
      setTimeout(playCrackle, 300 + Math.random() * 600);
    };
    setTimeout(playCrackle, 2000);
  }

  loopAnimalCalls() {
    const playCall = () => {
      if (this.game.state !== 2) { setTimeout(playCall, 5000); return; }
      // Only during day/dusk, randomized
      if (Math.random() > 0.3 && !this.game.isNight) {
        try {
          const t = this.ctx.currentTime;
          const callType = Math.random();
          if (callType < 0.4) {
            // Gecko: two-note "tuk-ko"
            const f1 = 800 + Math.random() * 200;
            this.playEnvTone(f1, 0.005, 0.02, 0, 0.05, 'square', 0.012);
            setTimeout(() => {
              this.playEnvTone(f1 * 0.7, 0.005, 0.03, 0.02, 0.08, 'square', 0.015);
            }, 100);
          } else if (callType < 0.7) {
            // Frog croak: low modulated burst
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120 + Math.random() * 60, t);
            osc.frequency.linearRampToValueAtTime(80, t + 0.15);
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 35;
            const lfoG = this.ctx.createGain();
            lfoG.gain.value = 20;
            lfo.connect(lfoG);
            lfoG.connect(osc.frequency);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 400;
            filter.Q.value = 3;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.015, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.compressor);
            osc.start(t); lfo.start(t);
            osc.stop(t + 0.25); lfo.stop(t + 0.25);
          } else {
            // Distant howl: descending whistle
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            const startF = 600 + Math.random() * 300;
            osc.frequency.setValueAtTime(startF, t);
            osc.frequency.exponentialRampToValueAtTime(startF * 0.5, t + 0.6);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(gain);
            gain.connect(this.compressor);
            osc.start(t);
            osc.stop(t + 0.65);
          }
        } catch (e) {}
      }
      setTimeout(playCall, 6000 + Math.random() * 10000);
    };
    setTimeout(playCall, 5000);
  }

  // Called from player movement code
  updateFootsteps(dt, isMoving, isSprinting, playerPos) {
    if (!isMoving) { this.footstepTimer = 0; return; }
    const interval = isSprinting ? 0.28 : 0.45;
    this.footstepTimer += dt;
    if (this.footstepTimer >= interval) {
      this.footstepTimer = 0;
      const dist = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
      this.playFootstep(dist > 100);
    }
  }
}
