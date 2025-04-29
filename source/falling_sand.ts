import {gl_init, gl_link_program} from "@engine/gl.ts";
import {io_init, io_kb_key_down, io_m_button_down, io_m_button_up, io_m_move, io_m_wheel_scroll, kb_event_t, m_event_t, m_wheel_event_t} from "@engine/io.ts";
import {vec2, vec2_set, vec2_t} from "@cl/math/vec2.ts";
import {clamp, index2} from "@cl/math/math.ts";
import {rand_in} from "@cl/math/rand.ts";

const root_el = document.createElement("div");
document.body.append(root_el);
root_el.style.width = "100vw";
root_el.style.height = "100vh";
root_el.style.backgroundColor = "#000000";

const info_el = document.createElement("div");
root_el.append(info_el);
info_el.style.position = "absolute";
info_el.style.right = "0";
info_el.style.top = "0";
info_el.style.fontFamily = "monospace";
info_el.style.fontSize = "16px";
info_el.style.color = "#ffffff";
info_el.style.padding = "16px";
info_el.style.userSelect = "none";
info_el.innerHTML = `
    Controls:<br>
    LMB - Paint<br>
    Scroll - Brush size<br>
    1 - Erase<br>
    2 - Sand<br>
    R - Reset<br>
    Space - Pause/Unpause
`;

const canvas_el = document.createElement("canvas");
root_el.append(canvas_el);

let canvas_size = root_el.clientWidth < root_el.clientHeight ? root_el.clientWidth : root_el.clientHeight;
canvas_el.width = canvas_el.height = canvas_size;

addEventListener("resize", function(): void {
    canvas_size = root_el.clientWidth < root_el.clientHeight ? root_el.clientWidth : root_el.clientHeight;
    canvas_el.width = canvas_el.height = canvas_size;
});

const gl = gl_init(canvas_el);

const program_main = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        out vec2 v_tex_coord;

        const vec2 positions[4] = vec2[](
            vec2(-1.0, 1.0),
            vec2(-1.0, -1.0),
            vec2(1.0, 1.0),
            vec2(1.0, -1.0)
        );

        const vec2 tex_coords[4] = vec2[](
            vec2(0.0, 0.0),
            vec2(0.0, 1.0),
            vec2(1.0, 0.0),
            vec2(1.0, 1.0)
        );

        void main() {
            gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
            v_tex_coord = tex_coords[gl_VertexID];
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        out vec4 o_frag_color;
        in vec2 v_tex_coord;
        uniform sampler2D u_texture;

        void main() {
            o_frag_color = vec4(texture(u_texture, v_tex_coord).yzw, 1.0);
        }
    `
}) as WebGLProgram;

const grid_width = 256;
const grid_height = 256;
const channels = 4;
const grid_size = grid_width * grid_height * channels;
const buffer0 = new Uint8Array(grid_size);

const elements = [
    new Uint8Array([0, 64, 64, 64]),
    new Uint8Array([1, 235, 199, 141])
];

const air_color = elements[0];

function grid_set(buffer: Uint8Array, i: number, element: Uint8Array): void {
    buffer[i * channels] = element[0];
    buffer[i * channels + 1] = element[1];
    buffer[i * channels + 2] = element[2];
    buffer[i * channels + 3] = element[3];
}

function grid_clear(buffer: Uint8Array, element: Uint8Array): void {
    for (let y = 0; y < grid_height; y += 1) {
        for (let x = 0; x < grid_width; x += 1) {
            const i = index2(x, y, grid_width);

            grid_set(buffer, i, element)
        }
    }
}

function swap(buffer: Uint8Array, i0: number, i1: number): void {
    const t = buffer[i0 * 4];
    const r = buffer[i0 * 4 + 1];
    const g = buffer[i0 * 4 + 2];
    const b = buffer[i0 * 4 + 3];

    buffer[i0 * 4] = buffer[i1 * 4];
    buffer[i0 * 4 + 1] = buffer[i1 * 4 + 1];
    buffer[i0 * 4 + 2] = buffer[i1 * 4 + 2];
    buffer[i0 * 4 + 3] = buffer[i1 * 4 + 3];
    buffer[i1 * 4] = t;
    buffer[i1 * 4 + 1] = r;
    buffer[i1 * 4 + 2] = g;
    buffer[i1 * 4 + 3] = b;
}

function grid_simulate(buffer: Uint8Array): void {
    for (let x = 0; x < grid_width; x += 1) {
        for (let y = grid_height - 1; y >= 0; y -= 1) {
            const i = index2(x, y, grid_width);

            const curr = i;
            let down = ((curr + grid_width) % grid_size);
            const dir = Math.random() > 0.5 ? -1 : 1;
            let left = ((down - dir + grid_size) % grid_size);
            let right = ((down + dir) % grid_size);

            if (buffer[curr * 4] !== 0) {
                if (buffer[down * 4] === 0) {
                    swap(buffer, curr, down);
                } else if (buffer[left * 4] === 0) {
                    swap(buffer, curr, left);
                } else if (buffer[right * 4] === 0) {
                    swap(buffer, curr, right);
                }
            }
        }
    }
}

const VARY_AMOUNT = 32;

function vary_color(v: number, amount: number) {
    return clamp(v + amount, 0, 255);
}

function grid_paint(buffer: Uint8Array, point: vec2_t, size: number, element: Uint8Array): void {
    const x_center = Math.floor(point[0] / canvas_el.width * grid_width);
    const y_center = Math.floor(point[1] / canvas_el.height * grid_height);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (size <= 1) {
        const i = index2(x_center, y_center, grid_width) * 4;
        const amount = element[0] > 0 ? rand_in(-VARY_AMOUNT, VARY_AMOUNT) : 0;

        buffer[i] = element[0];
        buffer[i + 1] = vary_color(element[1], amount);
        buffer[i + 2] = vary_color(element[2], amount);
        buffer[i + 3] = vary_color(element[3], amount);
    } else {
        const radius = Math.floor(size / 2.0);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = x_center + dx;
                const y = y_center + dy;

                if (x < 0 || x >= grid_width || y < 0 || y >= grid_height) continue;

                if (dx * dx + dy * dy <= radius * radius) {
                    const i = index2(x, y, grid_width) * 4;
                    const amount = element[0] > 0 ? rand_in(-VARY_AMOUNT, VARY_AMOUNT) : 0;

                    buffer[i] = element[0];
                    buffer[i + 1] = vary_color(element[1], amount);
                    buffer[i + 2] = vary_color(element[2], amount);
                    buffer[i + 3] = vary_color(element[3], amount);
                }
            }
        }
    }
}


const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, grid_width, grid_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer0);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const mouse_pos = vec2();
let is_mouse_down = false;
let brush_size = 1;
let brush_color = elements[1];
let is_paused = false;

grid_clear(buffer0, air_color);

io_init();

io_m_button_down(function(event: m_event_t): void {
    if (event.button === 0) {
        is_mouse_down = true;
    }
});

io_kb_key_down(function(event: kb_event_t): void {
    if (event.code === "Space") {
        is_paused = !is_paused;
    }

    if (event.code === "KeyR") {
        grid_clear(buffer0, air_color);
    }

    if (event.code === "Digit1") {
        brush_color = elements[0];
    }

    if (event.code === "Digit2") {
        brush_color = elements[1];
    }
});

io_m_move(function(event: m_event_t): void {
    if (event.target === canvas_el) {
        vec2_set(mouse_pos, event.x, event.y);
    }
});

io_m_button_up(function(event: m_event_t): void {
    if (event.button === 0) {
        is_mouse_down = false;
    }
});

io_m_wheel_scroll(function(event: m_wheel_event_t): void {
    brush_size = clamp(brush_size - event.yd, 1, 32);
});

function update(): void {
    if (is_mouse_down) {
        grid_paint(buffer0, mouse_pos, brush_size, brush_color);
    }

    if (!is_paused) {
        grid_simulate(buffer0);
    }
}

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, grid_width, grid_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer0);
    gl.useProgram(program_main);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
