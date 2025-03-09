import {cl_cam3_compute_proj, cl_cam3_compute_view, cl_cam3_move_forward, cl_cam3_move_right, cl_cam3_new, cl_cam3_pan, cl_cam3_tilt, cl_cam3_update} from "@cl/cam3";
import {cl_mat4_ident} from "@cl/mat4";
import {cl_vec3} from "@cl/vec3";
import {gl_init, gl_link_program} from "@engine/gl.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {cl_mat4_rotate_x, cl_mat4_rotate_y, cl_mat4_rotate_z, cl_mat4_translate} from "@cl/mat4_affine.ts";
import { mat4_t, TYPE } from "@cl/type";
import {en_create_canvas} from "@engine/canvas.ts";

const canvas_el = en_create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec3 i_position;
        layout(location = 1) in vec2 i_tex_coord;
        layout(location = 2) in mat4 i_model;
        out vec2 v_tex_coord;
        uniform mat4 u_projection;
        uniform mat4 u_view;
        uniform mat4 u_model;

        void main() {
            gl_Position = u_projection * u_view * i_model * vec4(i_position, 1.0);
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

const i_position = gl.getAttribLocation(program, "i_position");
const i_tex_coord = gl.getAttribLocation(program, "i_tex_coord");
const i_model = gl.getAttribLocation(program, "i_model");
const u_projection = gl.getUniformLocation(program, "u_projection");
const u_view = gl.getUniformLocation(program, "u_view");

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

gl.enableVertexAttribArray(i_position);
gl.vertexAttribPointer(i_position, 3, gl.FLOAT, false, 20, 0);

gl.enableVertexAttribArray(i_tex_coord);
gl.vertexAttribPointer(i_tex_coord, 2, gl.FLOAT, false, 20, 12);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

const x = 100.0, y = 100.0;
const num_instances = x * y;
const matrix_data = new Float32Array(num_instances * 16);
const matrices: mat4_t[] = [];

for (let i = 0; i < num_instances; ++i) {
    matrices.push(new TYPE(
        matrix_data.buffer,
        i * 16 * 4,
        16
    ));
}

let k = 0;

for (let i = 0; i < y; i++) {
    for (let j = 0; j < x; j++) {
        const mat = matrices[k];
        cl_mat4_ident(mat);
        cl_mat4_translate(mat, cl_vec3(i * 6.0, 0.0, j * 6.0));
        k++;
    }
}

const matrix_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, matrix_buffer);
gl.bufferData(gl.ARRAY_BUFFER, matrix_data.byteLength, gl.DYNAMIC_DRAW);

for (let i = 0; i < 4; ++i) {
    const loc = i_model + i;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 4 * 16, i * 16);
    gl.vertexAttribDivisor(loc, 1);
}

const camera = cl_cam3_new();
camera.position = cl_vec3(10.0, 10.0, 10.0);
camera.yaw = 135.0;
camera.pitch = -15.0;

io_init();

io_m_move(function(event: m_event_t): void {
    if (document.pointerLockElement === canvas_el) {
        cl_cam3_pan(camera, event.xd);
        cl_cam3_tilt(camera, event.yd);
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
            cl_cam3_move_right(camera, -1.0);
        }

        if (io_key_down("KeyD")) {
            cl_cam3_move_right(camera, 1.0);
        }

        if (io_key_down("KeyS")) {
            cl_cam3_move_forward(camera, -1.0);
        }

        if (io_key_down("KeyW")) {
            cl_cam3_move_forward(camera, 1.0);
        }
    }

    cl_cam3_update(camera);
    cl_cam3_compute_proj(camera, canvas_el.width, canvas_el.height);
    cl_cam3_compute_view(camera);
}

setInterval(() => {
    for (const matrix of matrices) {
        cl_mat4_rotate_x(matrix, Math.random() / 50.0);
        cl_mat4_rotate_y(matrix, Math.random() / 50.0);
        cl_mat4_rotate_z(matrix, Math.random() / 50.0);
    }
}, 1000 / 30.0);

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
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, matrix_buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrix_data);
    gl.drawElementsInstanced(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0, num_instances);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
