import {gl_init, gl_link_program} from "@engine/gl.ts";
import {cam2_compute_proj, cam2_compute_view, cam2_move_right, cam2_move_up, cam2_new} from "@cl/camera/cam2.ts";
import {io_init, io_key_down} from "@engine/io.ts";
import {vec2} from "@cl/math/vec2";
import {vec4} from "@cl/math/vec4.ts";
import {create_canvas} from "@engine/canvas.ts";
import {gen_circle, gen_line, gen_star, poly_data_t} from "@cl/geometry/triangulation2.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec3 i_position;
        layout(location = 1) in int i_color;
        uniform mat4 u_projection;
        uniform mat4 u_view;
        flat out int v_color;

        void main() {
            gl_Position = u_projection * u_view * vec4(i_position, 1.0);
            v_color = i_color;
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        flat in int v_color;
        out vec4 o_frag_color;

        vec4 unpack256(int packed) {
            return vec4(
                (packed >> 24) & 0xFF,
                (packed >> 16) & 0xFF,
                (packed >> 8) & 0xFF,
                packed & 0xFF
            ) / 255.0;
        }

        void main() {
            o_frag_color = unpack256(v_color);
        }
    `
}) as WebGLProgram;

const u_projection = gl.getUniformLocation(program, "u_projection")!;
const u_view = gl.getUniformLocation(program, "u_view")!;

let vertices: number[] = [];
let indices: number[] = [];

const poly_data = new poly_data_t();
poly_data.vertices = vertices;
poly_data.indices = indices;
poly_data.stride = 4;

// gen_obb(vec2(), vec2(10.0), 0, 0.0, vec4(255), poly_data);
// gen_line(vec2(-20.0), 2.0, vec2(20.0), 2.0, 0.0, vec4(255), poly_data)
// gen_line_kite(vec2(-20.0), vec2(20.0), 10.0, 0.2, 0.0, vec4(255), poly_data)
// gen_line_triangle(vec2(-0.0), vec2(-20.0, -20.0), 10.0, 0.0, vec4(255), poly_data)

gen_circle(vec2(), 20.0, 8, 0.0, vec4(227, 200, 48, 255), poly_data);
gen_star(vec2(), 40.0, 35.0, 10, 0.0, vec4(217, 85, 186, 255), poly_data);
gen_line(vec2(0, -200), 6.0, vec2(0), 4.0, 0.0, vec4(49, 189, 121, 255), poly_data)

let index_count = indices.length;

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, null, gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);

gl.enableVertexAttribArray(1);
gl.vertexAttribIPointer(1, 1, gl.INT, 16, 12);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, null, gl.STATIC_DRAW);

const buffer = new ArrayBuffer(vertices.length * 4);
const view = new DataView(buffer);

for (let i = 0; i < vertices.length; i += 4) {
    view.setFloat32(i * 4, vertices[i], true);
    view.setFloat32(i * 4 + 4, vertices[i + 1], true);
    view.setFloat32(i * 4 + 8, vertices[i + 2], true);
    view.setInt32(i * 4 + 12, vertices[i + 3], true);
}

gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

const camera = cam2_new();
camera.scale = 5.0;
camera.movement_speed = 2.0;

io_init();

function update() {
    if (io_key_down("KeyA")) {
        cam2_move_right(camera, -1.0);
    }

    if (io_key_down("KeyD")) {
        cam2_move_right(camera, 1.0);
    }

    if (io_key_down("KeyS")) {
        cam2_move_up(camera, -1.0);
    }

    if (io_key_down("KeyW")) {
        cam2_move_up(camera, 1.0);
    }

    if (io_key_down("KeyQ")) {
        camera.scale -= 0.1;
    }

    if (io_key_down("KeyE")) {
        camera.scale += 0.1;
    }

    cam2_compute_proj(camera, canvas_el.width, canvas_el.height);
    cam2_compute_view(camera);
}

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u_projection, false, camera.projection);
    gl.uniformMatrix4fv(u_view, false, camera.view);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
