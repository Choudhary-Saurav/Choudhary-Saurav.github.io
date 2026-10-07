// Animated header backgrounds: a rotating DNA helix (home) and a drifting UMAP embedding (inner pages).
// Usage: <canvas class="hero-canvas" data-anim="helix|umap"></canvas> as the first child of .hero / .page-hero
(function () {
    const canvas = document.querySelector('.hero-canvas');
    if (!canvas) return;

    const hero = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = canvas.dataset.anim || 'helix';
    const basePairs = ['#2dd4bf', '#38bdf8', '#a78bfa', '#fbbf24'];
    const clusterColors = ['#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa'];

    // UMAP layout in a unit box: gaussian blobs plus curved "trajectory" arms
    const umapRecipe = [
        { type: 'blob', x: 0.1, y: 0.42, sx: 0.032, sy: 0.13, rot: 0.3, n: 110 },
        { type: 'blob', x: 0.2, y: 0.82, sx: 0.024, sy: 0.07, rot: 0, n: 55 },
        { type: 'arc', from: [0.18, 0.28], via: [0.32, 0.02], to: [0.46, 0.22], w: 0.011, n: 80 },
        { type: 'blob', x: 0.5, y: 0.4, sx: 0.028, sy: 0.1, rot: 0, n: 90 },
        { type: 'blob', x: 0.39, y: 0.75, sx: 0.04, sy: 0.07, rot: -0.4, n: 95 },
        { type: 'blob', x: 0.62, y: 0.66, sx: 0.019, sy: 0.055, rot: 0, n: 45 },
        { type: 'arc', from: [0.57, 0.9], via: [0.71, 1.04], to: [0.84, 0.74], w: 0.011, n: 65 },
        { type: 'blob', x: 0.76, y: 0.34, sx: 0.034, sy: 0.12, rot: 0.6, n: 105 },
        { type: 'blob', x: 0.9, y: 0.6, sx: 0.024, sy: 0.09, rot: 0, n: 70 },
        { type: 'blob', x: 0.96, y: 0.14, sx: 0.011, sy: 0.04, rot: 0, n: 28 },
    ];

    let W = 0, H = 0, raf = null, inView = true, umapPoints = [], box = null;

    function rgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    // Deterministic random so the layout is identical on every visit and resize
    function seeded(seed) {
        return function () {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
    }

    function gaussian(rand) {
        const u = Math.max(rand(), 1e-6), v = rand();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = hero.clientWidth;
        H = hero.clientHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (mode === 'umap') buildUmap();
        if (!raf) draw(performance.now() / 1000);
    }

    function buildUmap() {
        const rand = seeded(7);
        const narrow = W < 860;
        box = narrow
            ? { x: W * 0.04, y: H * 0.1, w: W * 0.92, h: H * 0.8 }
            : { x: W * 0.61, y: H * 0.14, w: W * 0.36, h: H * 0.72 };

        umapPoints = [];
        umapRecipe.forEach((c, ci) => {
            const color = clusterColors[ci % clusterColors.length];
            const cluster = { color, phase: rand() * Math.PI * 2, cx: 0, cy: 0 };
            for (let i = 0; i < c.n; i++) {
                let x, y;
                if (c.type === 'blob') {
                    const gx = gaussian(rand) * c.sx, gy = gaussian(rand) * c.sy;
                    x = c.x + gx * Math.cos(c.rot) - gy * Math.sin(c.rot);
                    y = c.y + gx * Math.sin(c.rot) + gy * Math.cos(c.rot);
                } else {
                    const t = rand();
                    const mt = 1 - t;
                    x = mt * mt * c.from[0] + 2 * mt * t * c.via[0] + t * t * c.to[0] + gaussian(rand) * c.w;
                    y = mt * mt * c.from[1] + 2 * mt * t * c.via[1] + t * t * c.to[1] + gaussian(rand) * c.w * 1.6;
                }
                umapPoints.push({
                    x, y, cluster,
                    r: 1.2 + rand() * 1.3,
                    p: rand() * Math.PI * 2,
                    s: 0.25 + rand() * 0.45,
                });
                cluster.cx += x / c.n;
                cluster.cy += y / c.n;
            }
        });
    }

    function drawUmap(time) {
        const scale = Math.min(1, H / 260);

        for (const pt of umapPoints) {
            const cl = pt.cluster;
            // Each cluster breathes gently around its centroid and drifts a little
            const breathe = 1 + 0.035 * Math.sin(time * 0.35 + cl.phase);
            const nx = cl.cx + (pt.x - cl.cx) * breathe;
            const ny = cl.cy + (pt.y - cl.cy) * breathe;
            const x = box.x + nx * box.w + 4 * Math.sin(time * 0.12 + cl.phase) + 2.2 * Math.sin(time * pt.s + pt.p);
            const y = box.y + ny * box.h + 3 * Math.cos(time * 0.1 + cl.phase) + 2.2 * Math.cos(time * pt.s * 0.9 + pt.p);

            ctx.fillStyle = rgba(cl.color, 0.72);
            ctx.beginPath();
            ctx.arc(x, y, pt.r * (0.8 + 0.4 * scale), 0, Math.PI * 2);
            ctx.fill();
        }

        // Faint axes, as on a real UMAP plot
        const ax = box.x - 14, ay = box.y + box.h + 6, len = 34;
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
        ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay - len);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + len, ay);
        ctx.stroke();
        ctx.font = '600 9px Inter, sans-serif';
        ctx.fillText('UMAP 1', ax + len + 5, ay + 3);
        ctx.save();
        ctx.translate(ax - 4, ay - len - 4);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('UMAP 2', 0, 0);
        ctx.restore();
    }

    function drawHelix(time) {
        const narrow = W < 860;
        const len = Math.hypot(W, H) * 0.62;
        const amp = Math.min(H * 0.15, 86);
        const freq = 0.021;
        const step = 15;

        ctx.save();
        ctx.translate(W * (narrow ? 0.5 : 0.66), H * 0.5);
        ctx.rotate(-0.42);

        const fadeAt = (x) => Math.pow(1 - Math.min(1, Math.abs(x) / len), 0.7);

        // Backbones
        for (const sign of [1, -1]) {
            ctx.beginPath();
            for (let x = -len; x <= len; x += 5) {
                const y = sign * amp * Math.sin(x * freq + time * 0.6);
                x === -len ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = rgba(sign > 0 ? '#2dd4bf' : '#60a5fa', 0.22);
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // Base pairs and nucleotides, back strand drawn first for depth
        let i = 0;
        for (let x = -len; x <= len; x += step, i++) {
            const phase = x * freq + time * 0.6;
            const s = Math.sin(phase), c = Math.cos(phase);
            const fade = fadeAt(x);
            const y1 = amp * s, y2 = -amp * s;

            if (i % 2 === 0) {
                ctx.strokeStyle = rgba(basePairs[(i / 2) % 4], 0.2 * fade);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
            }

            const dots = [[y1, c, '#2dd4bf'], [y2, -c, '#60a5fa']].sort((a, b) => a[1] - b[1]);
            for (const [y, z, col] of dots) {
                const depth = (z + 1) / 2;
                ctx.fillStyle = rgba(col, (0.2 + 0.65 * depth) * fade);
                ctx.beginPath();
                ctx.arc(x, y, 1.8 + depth * 3.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function draw(time) {
        ctx.clearRect(0, 0, W, H);
        mode === 'umap' ? drawUmap(time) : drawHelix(time);
    }

    function frame(ms) {
        draw(ms / 1000);
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (raf || reduceMotion || !inView || document.hidden) return;
        raf = requestAnimationFrame(frame);
    }

    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
    }

    hero.classList.add('hero--animated');

    new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        inView ? start() : stop();
    }).observe(hero);

    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.addEventListener('resize', resize);

    resize();
    start();
})();
