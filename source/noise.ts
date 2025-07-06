import {gl_init, gl_link_program} from "@engine/gl.ts";
import {create_canvas} from "@engine/canvas.ts";
import {vec3, vec3_t} from "@cl/math/vec3.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const program_main = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec2 i_position;
        layout(location = 1) in vec2 i_tex_coord;
        out vec2 v_tex_coord;
        uniform float u_scale_x;
        uniform float u_scale_y;

        void main() {
            gl_Position = vec4(i_position * vec2(u_scale_x, u_scale_y), 0.0, 1.0);
            v_tex_coord = i_tex_coord;
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        in vec2 v_tex_coord;
        out vec4 o_frag_color;
        uniform sampler2D u_texture;

        void main() {
            o_frag_color = texture(u_texture, v_tex_coord);
        }
    `
}) as WebGLProgram;

const u_scale_x = gl.getUniformLocation(program_main, "u_scale_x");
const u_scale_y = gl.getUniformLocation(program_main, "u_scale_y");

const vertices = [
    -1.0, 1.0, 0.0, 0.0,
    -1.0, -1.0, 0.0, 1.0,
    1.0, -1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 0.0
];

const indices = [
    0, 1, 2,
    0, 2, 3
];

const index_count = indices.length;

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

const grad_3: number[][] = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function build_permutation_table(seed: number): number[] {
    const p = Array.from({ length: 256 }, (_, i) => i);
    const rand = xorshift(seed);

    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }

    return p.concat(p);
}

function xorshift(seed: number): () => number {
    let x = seed || 1;

    return () => {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;

        return (x >>> 0) / 0xffffffff;
    };
}

function dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
}

export function create_simplex_noise_2d(seed: number = 0): (x: number, y: number) => number {
    const perm = build_permutation_table(seed);

    return function simplex_2d(xin: number, yin: number): number {
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;

        const x0 = xin - (i - t);
        const y0 = yin - (j - t);

        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;

        const gi0 = perm[ii + perm[jj]] % 8;
        const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
        const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;

        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;

        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * dot(grad_3[gi0], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;

        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * dot(grad_3[gi1], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;

        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * dot(grad_3[gi2], x2, y2);
        }

        return 70.0 * (n0 + n1 + n2);
    };
}

const texture_width = 1024;
const texture_height = 1024;
const channels = 3;
const size = texture_width * texture_height * channels;
const texture_data = new Uint8Array(size);

const noise_2d = create_simplex_noise_2d(Math.random() * 1337);

const scale = 0.01;
const octaves = 8;
const persistence = 0.5;
const lacunarity = 2.0;

function fractal_noise(x: number, y: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let max_value = 0;

    for (let i = 0; i < octaves; i++) {
        total += noise_2d(x * frequency, y * frequency) * amplitude;
        max_value += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return total / max_value;
}

function noise_to_color(n: number): vec3_t {
    if (n < -0.3) return vec3(0, 0, 128);
    if (n < 0.0) return vec3(0, 0, 255);
    if (n < 0.1) return vec3(240, 240, 64);
    if (n < 0.3) return vec3(32, 160, 0);
    if (n < 0.6) return vec3(128, 128, 128);

    return vec3(255, 255, 255);
}

for (let y = 0; y < texture_height; ++y) {
    for (let x = 0; x < texture_width; ++x) {
        const i = (y * texture_width + x) * channels;

        const nx = x * scale;
        const ny = y * scale;
        const n = fractal_noise(nx, ny);
        const [r, g, b] = noise_to_color(n);

        texture_data[i + 0] = r;
        texture_data[i + 1] = g;
        texture_data[i + 2] = b;
    }
}

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, texture_width, texture_height, 0, gl.RGB, gl.UNSIGNED_BYTE, texture_data);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function render(): void {
    const canvas_size = Math.min(canvas_el.width, canvas_el.height);

    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program_main);
    gl.uniform1f(u_scale_x, canvas_size / canvas_el.width);
    gl.uniform1f(u_scale_y, canvas_size / canvas_el.height);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0);
}

function loop(): void {
    render();

    requestAnimationFrame(loop);
}

loop();
