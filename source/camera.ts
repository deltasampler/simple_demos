import {cam3_compute_proj, cam3_compute_view, cam3_move_forward, cam3_move_right, cam3_new, cam3_pan, cam3_tilt, cam3_update} from "@cl/cam3";
import {mat4} from "@cl/mat4";
import {vec3} from "@cl/vec3";
import {gl_init, gl_link_program} from "@engine/gl.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {en_create_canvas} from "@engine/canvas.ts";

const canvas_el = en_create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec3 i_position;
        layout(location = 1) in vec2 i_tex_coord;
        out vec2 v_tex_coord;
        uniform mat4 u_projection;
        uniform mat4 u_view;
        uniform mat4 u_model;

        void main() {
            gl_Position = u_projection * u_view * u_model * vec4(i_position, 1.0);
            v_tex_coord = i_tex_coord;
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        in vec2 v_tex_coord;
        out vec4 o_frag_color;

        void main() {
            vec2 uv = v_tex_coord * 2.0 - 1.0;
            float edge_size = 0.8;
            float fade_width = 0.1;
            vec2 edge_dist = abs(uv) - edge_size;
            float max_dist = max(edge_dist.x, edge_dist.y);
            float edge_factor = smoothstep(0.0, fade_width, max_dist);
            vec3 edge_color = vec3(1.0, 0.0, 1.0);

            o_frag_color = vec4(edge_color, edge_factor);
        }
    `
}) as WebGLProgram;

const u_projection = gl.getUniformLocation(program, "u_projection");
const u_view = gl.getUniformLocation(program, "u_view");
const u_model = gl.getUniformLocation(program, "u_model");

const vertices = [
    // Front face
    -1.0,  1.0,  1.0,    0.0, 0.0,
    -1.0, -1.0,  1.0,    0.0, 1.0,
     1.0, -1.0,  1.0,    1.0, 1.0,
     1.0,  1.0,  1.0,    1.0, 0.0,

     // Back face
     1.0,  1.0, -1.0,    0.0, 0.0,
     1.0, -1.0, -1.0,    0.0, 1.0,
    -1.0, -1.0, -1.0,    1.0, 1.0,
    -1.0,  1.0, -1.0,    1.0, 0.0,

    // Left face
    -1.0,  1.0, -1.0,    0.0, 0.0,
    -1.0, -1.0, -1.0,    0.0, 1.0,
    -1.0, -1.0,  1.0,    1.0, 1.0,
    -1.0,  1.0,  1.0,    1.0, 0.0,

     // Right face
     1.0,  1.0,  1.0,    0.0, 0.0,
     1.0, -1.0,  1.0,    0.0, 1.0,
     1.0, -1.0, -1.0,    1.0, 1.0,
     1.0,  1.0, -1.0,    1.0, 0.0,

     // Top face
    -1.0,  1.0, -1.0,    0.0, 0.0,
    -1.0,  1.0,  1.0,    0.0, 1.0,
     1.0,  1.0,  1.0,    1.0, 1.0,
     1.0,  1.0, -1.0,    1.0, 0.0,

     // Bottom face
    -1.0, -1.0,  1.0,    0.0, 0.0,
    -1.0, -1.0, -1.0,    0.0, 1.0,
     1.0, -1.0, -1.0,    1.0, 1.0,
     1.0, -1.0,  1.0,    1.0, 0.0
];

const indices = [
    0,  1,  2,  0,  2,  3,    // Front face
    4,  5,  6,  4,  6,  7,    // Back face
    8,  9, 10,  8, 10, 11,    // Left face
   12, 13, 14, 12, 14, 15,    // Right face
   16, 17, 18, 16, 18, 19,    // Top face
   20, 21, 22, 20, 22, 23     // Bottom face
];

const index_count = indices.length;

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);

gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

const model = mat4(1.0);
const camera = cam3_new();
camera.position = vec3(5.0, 5.0, 5.0);
camera.yaw = -45;
camera.pitch = -45;

io_init();

io_m_move(function(event: m_event_t): void {
    if (document.pointerLockElement === canvas_el) {
        cam3_pan(camera, event.xd, 1.0);
        cam3_tilt(camera, event.yd, 1.0);
    }
});

io_kb_key_down(function(event: kb_event_t): void {
    if (event.code === "Backquote") {
        if (document.pointerLockElement === canvas_el) {
            document.exitPointerLock();
        } else {
            canvas_el.requestPointerLock();
        }
    }
});

function update(): void {
    if (document.pointerLockElement === canvas_el) {
        if (io_key_down("KeyA")) {
            cam3_move_right(camera, -1.0, 1.0);
        }

        if (io_key_down("KeyD")) {
            cam3_move_right(camera, 1.0, 1.0);
        }

        if (io_key_down("KeyS")) {
            cam3_move_forward(camera, -1.0, 1.0);
        }

        if (io_key_down("KeyW")) {
            cam3_move_forward(camera, 1.0, 1.0);
        }
    }

    cam3_update(camera);
    cam3_compute_proj(camera, canvas_el.width, canvas_el.height);
    cam3_compute_view(camera);
}

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u_projection, false, camera.projection);
    gl.uniformMatrix4fv(u_view, false, camera.view);
    gl.uniformMatrix4fv(u_model, false, model);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0);
}

function main_loop(): void {
    update();
    render();

    requestAnimationFrame(main_loop);
}

main_loop();
