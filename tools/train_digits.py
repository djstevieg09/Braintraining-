import json, sys, time, base64
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import jax, jax.numpy as jnp, optax

rng = np.random.default_rng(0)
D = sys.argv[1]

# ---------------- stroke rendering (must match ink.js) ----------------
def render(strokes, width_k=0.12):
    pts = np.concatenate([np.asarray(s, float) for s in strokes])
    mn, mx = pts.min(0), pts.max(0)
    size = max(mx[0] - mn[0], mx[1] - mn[1], 1e-3)
    S = 4
    scale = 20 * S / size
    def draw(off):
        im = Image.new('L', (28 * S, 28 * S), 0)
        g = ImageDraw.Draw(im)
        lw = max(1, round(width_k * 20 * S))
        for s in strokes:
            p = [((x - mn[0]) * scale + off[0], (y - mn[1]) * scale + off[1]) for x, y in s]
            if len(p) == 1: p = p * 2
            g.line(p, fill=255, width=lw, joint='curve')
            for q in (p[0], p[-1]):
                g.ellipse([q[0] - lw / 2, q[1] - lw / 2, q[0] + lw / 2, q[1] + lw / 2], fill=255)
        a = np.asarray(im, np.float32).reshape(28, S, 28, S).mean((1, 3)) / 255
        return a
    w, h = (mx - mn) * scale
    a = draw(((28 * S - w) / 2, (28 * S - h) / 2))
    tot = a.sum()
    if tot > 0:
        ys, xs = np.mgrid[0:28, 0:28]
        cy, cx = (a * ys).sum() / tot, (a * xs).sum() / tot
        dx, dy = int(round(13.5 - cx)), int(round(13.5 - cy))
        a = np.roll(np.roll(a, dy, 0), dx, 1)
    return a

def jitter_strokes(strokes):
    ang = rng.uniform(-0.25, 0.25); sh = rng.uniform(-0.35, 0.35)
    sx, sy = rng.uniform(0.75, 1.25), rng.uniform(0.8, 1.2)
    out = []
    # smooth wobble field
    fx, fy = rng.uniform(1, 3, 2); ax, ay = rng.uniform(0, 5, 2); ph = rng.uniform(0, 6.28, 2)
    for s in strokes:
        s = np.asarray(s, float)
        # densify
        dense = [s[0]]
        for a, b in zip(s[:-1], s[1:]):
            n = max(1, int(np.hypot(*(b - a)) / 3))
            for k in range(1, n + 1): dense.append(a + (b - a) * k / n)
        s = np.array(dense)
        x, y = s[:, 0] - 50, s[:, 1] - 50
        x, y = x + sh * y, y
        x, y = x * np.cos(ang) - y * np.sin(ang), x * np.sin(ang) + y * np.cos(ang)
        x, y = x * sx, y * sy
        x = x + ax * np.sin(fy * y / 30 + ph[0]); y = y + ay * np.sin(fx * x / 30 + ph[1])
        x = x + rng.normal(0, 0.6, len(x)); y = y + rng.normal(0, 0.6, len(y))
        # random truncation / overshoot of stroke ends
        out.append(np.stack([x, y], 1).tolist())
    return out

shapes = json.load(open(f'{D}/shapes.json'))
def synth(n):
    X, Y = [], []
    for _ in range(n):
        d = int(rng.integers(0, 10)); v = shapes[str(d)][rng.integers(0, len(shapes[str(d)]))]
        X.append(render(jitter_strokes(v), width_k=rng.uniform(0.09, 0.16))); Y.append(d)
    return np.array(X, np.float32), np.array(Y)

t = time.time()
SX, SY = synth(24000)
VX, VY = synth(2000)
print('synth', time.time() - t)

m = np.load(f'{D}/mnist.npz')
MX = m['x_train'].astype(np.float32) / 255; MY = m['y_train']
TX = m['x_test'].astype(np.float32) / 255; TY = m['y_test']

def aug(batch):
    out = np.empty_like(batch)
    for i, a in enumerate(batch):
        ang = rng.uniform(-0.22, 0.22); sc = rng.uniform(0.85, 1.12); sh = rng.uniform(-0.3, 0.3)
        M = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]) @ np.array([[1, sh], [0, 1]]) / sc
        c = np.array([13.5, 13.5]); off = c - M @ c + rng.uniform(-1.5, 1.5, 2)
        b = ndimage.affine_transform(a, M, off, order=1)
        r = rng.random()
        if r < 0.25: b = ndimage.grey_dilation(b, size=(2, 2))
        elif r < 0.35: b = ndimage.grey_erosion(b, size=(2, 1))
        out[i] = np.clip(b, 0, 1)
    return out

# ---------------- model ----------------
def init(key):
    ks = jax.random.split(key, 5)
    he = lambda k, shp, fan: jax.random.normal(k, shp) * np.sqrt(2 / fan)
    return {
        'c1': he(ks[0], (16, 1, 3, 3), 9), 'b1': jnp.zeros(16),
        'c2': he(ks[1], (32, 16, 3, 3), 144), 'b2': jnp.zeros(32),
        'c3': he(ks[2], (48, 32, 3, 3), 288), 'b3': jnp.zeros(48),
        'd1': he(ks[3], (48 * 3 * 3, 64), 432), 'e1': jnp.zeros(64),
        'd2': he(ks[4], (64, 10), 64), 'e2': jnp.zeros(10),
    }

def conv(x, w, b):
    y = jax.lax.conv_general_dilated(x, w, (1, 1), 'SAME', dimension_numbers=('NCHW', 'OIHW', 'NCHW'))
    return jax.nn.relu(y + b[None, :, None, None])
def pool(x):
    return jax.lax.reduce_window(x, -jnp.inf, jax.lax.max, (1, 1, 2, 2), (1, 1, 2, 2), 'VALID')

def forward(p, x, drop_key=None):
    x = x[:, None]
    x = pool(conv(x, p['c1'], p['b1']))   # 14
    x = pool(conv(x, p['c2'], p['b2']))   # 7
    x = pool(conv(x, p['c3'], p['b3']))   # 3
    x = x.reshape(x.shape[0], -1)
    x = jax.nn.relu(x @ p['d1'] + p['e1'])
    if drop_key is not None:
        keep = jax.random.bernoulli(drop_key, 0.75, x.shape); x = x * keep / 0.75
    return x @ p['d2'] + p['e2']

def loss(p, x, y, k):
    lg = forward(p, x, k)
    return optax.softmax_cross_entropy_with_integer_labels(lg, y).mean()

params = init(jax.random.PRNGKey(1))
EPOCHS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
steps = EPOCHS * (len(MX) + len(SX)) // 128
opt = optax.adam(optax.cosine_decay_schedule(2e-3, steps))
st = opt.init(params)

@jax.jit
def step(p, st, x, y, k):
    l, g = jax.value_and_grad(loss)(p, x, y, k)
    u, st = opt.update(g, st, p)
    return optax.apply_updates(p, u), st, l

predict = jax.jit(lambda p, x: jnp.argmax(forward(p, x), -1))
def acc(p, X, Y): return float(np.mean(np.concatenate([np.asarray(predict(p, X[i:i + 1000])) for i in range(0, len(X), 1000)]) == Y))

AX = np.concatenate([MX, SX]); AY = np.concatenate([MY, SY])
key = jax.random.PRNGKey(2)
for ep in range(EPOCHS):
    t = time.time(); perm = rng.permutation(len(AX))
    for i in range(0, len(perm) - 127, 128):
        idx = perm[i:i + 128]
        xb = aug(AX[idx]); key, k = jax.random.split(key)
        params, st, l = step(params, st, jnp.asarray(xb), jnp.asarray(AY[idx]), k)
    print(f'epoch {ep} loss {float(l):.3f} mnist-test {acc(params, TX, TY):.4f} synth-val {acc(params, VX, VY):.4f} {time.time() - t:.0f}s', flush=True)

# ---------------- export: int8 per-tensor quantised ----------------
out = {}
for k, v in params.items():
    v = np.asarray(v, np.float32)
    s = float(np.abs(v).max() / 127) or 1.0
    q = np.clip(np.round(v / s), -127, 127).astype(np.int8)
    out[k] = {'shape': list(v.shape), 'scale': s, 'data': base64.b64encode(q.tobytes()).decode()}
json.dump(out, open(f'{D}/model.json', 'w'))
np.save(f'{D}/val_x.npy', VX[:50]); np.save(f'{D}/val_y.npy', VY[:50])
# reference logits for the JS port check
qp = {k: jnp.asarray(np.frombuffer(base64.b64decode(o['data']), np.int8).astype(np.float32).reshape(o['shape']) * o['scale']) for k, o in out.items()}
print('quantised mnist-test', acc(qp, TX, TY), 'synth-val', acc(qp, VX, VY))
np.save(f'{D}/val_logits.npy', np.asarray(forward(qp, jnp.asarray(VX[:50]))))
