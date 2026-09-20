/**
 * WebAudio 合成哀乐（G 小调葬礼进行曲风格动机）
 * [频率 Hz, 拍数] — 单文件自包含，无需任何音频资源
 */
export const DIRGE_NOTES: [number, number][] = [
  [246.94, 1.5], // Bb3
  [246.94, 0.5], // Bb3
  [246.94, 1.0], // Bb3
  [233.08, 1.0], // Bb3
  [246.94, 1.0], // Bb3
  [293.66, 2.0], // D4
  [311.13, 2.0], // Eb4
  [311.13, 1.5], // Eb4
  [349.23, 0.5], // F4
  [311.13, 1.0], // Eb4
  [293.66, 1.0], // D4
  [261.63, 2.0], // C4
  [246.94, 4.0], // Bb3
  [0, 2.0], // 休止
];

/** 每拍秒数（哀乐要慢） */
export const DIRGE_BEAT = 0.62;

/**
 * 浏览器端播放器工厂（Web 页面复用）。
 * 返回 { start, stop }；start 幂等，循环播放直到 stop。
 */
export function createDirgePlayer(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let timer: number | null = null;

  const playLoop = (): void => {
    if (!ctx) return;
    let t = ctx.currentTime + 0.05;
    for (const [freq, beats] of DIRGE_NOTES) {
      const dur = beats * DIRGE_BEAT;
      if (freq > 0) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
        gain.gain.setValueAtTime(0.12, t + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
      t += dur;
    }
    const loopMs = (t - ctx.currentTime) * 1000;
    timer = window.setTimeout(playLoop, loopMs);
  };

  return {
    start: () => {
      if (timer !== null) return;
      ctx ??= new AudioContext();
      void ctx.resume();
      playLoop();
    },
    stop: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      void ctx?.suspend();
    },
  };
}
