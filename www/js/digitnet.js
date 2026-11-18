// Handwritten digit classifier: renders pen strokes to a 28x28 image (MNIST style)
// and runs a small convolutional network. Weights live in digitmodel.js.
import { MODEL } from './digitmodel.js';

function decode(o) {
  const bin = atob(o.data); const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; out[i] = v * o.scale; }
  return { shape: o.shape, w: out };
}
let P = null;
const params = () => P || (P = Object.fromEntries(Object.entries(MODEL).map(([k, v]) => [k, decode(v)])));

// x: Float32Array C*H*W -> conv3x3 SAME + relu
function conv(x, C, H, W, k, b) {
  const O = k.shape[0], out = new Float32Array(O * H * W), w = k.w, bias = b.w;
  for (let o = 0; o < O; o++) {
    const ob = o * H * W;
    for (let i = 0; i < H * W; i++) out[ob + i] = bias[o];
    for (let c = 0; c < C; c++) {
      const xb = c * H * W, wb = (o * C + c) * 9;
      for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
        const wv = w[wb + ky * 3 + kx]; if (wv === 0) continue;
        const dy = ky - 1, dx = kx - 1;
        for (let y = Math.max(0, -dy); y < Math.min(H, H - dy); y++) {
          const row = ob + y * W, src = xb + (y + dy) * W + dx;
          for (let xx = Math.max(0, -dx); xx < Math.min(W, W - dx); xx++) out[row + xx] += wv * x[src + xx];
        }
      }
    }
    for (let i = 0; i < H * W; i++) if (out[ob + i] < 0) out[ob + i] = 0;
  }
  return out;
}
function pool(x, C, H, W) {
  const h = H >> 1, w = W >> 1, out = new Float32Array(C * h * w);
  for (let c = 0; c < C; c++) for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const b = c * H * W + 2 * y * W + 2 * xx;
    out[c * h * w + y * w + xx] = Math.max(x[b], x[b + 1], x[b + W], x[b + W + 1]);
  }
  return out;
}
function dense(x, k, b, relu) {
  const [I, O] = k.shape, out = new Float32Array(O);
  for (let o = 0; o < O; o++) out[o] = b.w[o];
  for (let i = 0; i < I; i++) { const v = x[i]; if (!v) continue; const r = i * O; for (let o = 0; o < O; o++) out[o] += v * k.w[r + o]; }
  if (relu) for (let o = 0; o < O; o++) if (out[o] < 0) out[o] = 0;
  return out;
}

// img: Float32Array(784) in 0..1 -> probabilities[10]
export function classify(img) {
  const p = params();
  let x = pool(conv(img, 1, 28, 28, p.c1, p.b1), 16, 28, 28);
  x = pool(conv(x, 16, 14, 14, p.c2, p.b2), 32, 14, 14);
  x = pool(conv(x, 32, 7, 7, p.c3, p.b3), 48, 7, 7);
  x = dense(x, p.d1, p.e1, true);
  const lg = dense(x, p.d2, p.e2, false);
  const m = Math.max(...lg); const e = Array.from(lg, v => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}
export const logits = img => { const p = params(); let x = pool(conv(img, 1, 28, 28, p.c1, p.b1), 16, 28, 28); x = pool(conv(x, 16, 14, 14, p.c2, p.b2), 32, 14, 14); x = pool(conv(x, 32, 7, 7, p.c3, p.b3), 48, 7, 7); return dense(dense(x, p.d1, p.e1, true), p.d2, p.e2, false); };

// strokes: [[{x,y}...]...] -> Float32Array(784), matching tools/train_digits.py render()
let cv = null;
export function render(strokes) {
  const S = 4, N = 28 * S;
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = N; }
  const g = cv.getContext('2d', { willReadFrequently: true });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  strokes.forEach(s => s.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }));
  const size = Math.max(maxX - minX, maxY - minY, 1e-3), scale = 20 * S / size;
  const w = (maxX - minX) * scale, h = (maxY - minY) * scale, ox = (N - w) / 2, oy = (N - h) / 2;
  const lw = Math.max(1, Math.round(0.12 * 20 * S));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of strokes) {
    g.beginPath();
    s.forEach((p, i) => { const X = (p.x - minX) * scale + ox, Y = (p.y - minY) * scale + oy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    if (s.length === 1) { const X = (s[0].x - minX) * scale + ox, Y = (s[0].y - minY) * scale + oy; g.arc(X, Y, lw / 2, 0, 7); g.fill(); }
    else g.stroke();
  }
  const d = g.getImageData(0, 0, N, N).data;
  const a = new Float32Array(784);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[(y >> 2) * 28 + (x >> 2)] += d[(y * N + x) * 4] / 255 / 16;
  // centre of mass to the middle, like MNIST
  let tot = 0, cx = 0, cy = 0;
  for (let i = 0; i < 784; i++) { tot += a[i]; cx += a[i] * (i % 28); cy += a[i] * Math.floor(i / 28); }
  if (!tot) return a;
  const dx = Math.round(13.5 - cx / tot), dy = Math.round(13.5 - cy / tot);
  const b = new Float32Array(784);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) b[((y + dy + 28) % 28) * 28 + ((x + dx + 28) % 28)] = a[y * 28 + x];
  return b;
}
