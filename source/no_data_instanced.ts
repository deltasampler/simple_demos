import {gl_init, gl_link_program} from "@engine/gl.ts";
import {cl_cam2_compute_proj, cl_cam2_compute_view, cl_cam2_move_right, cl_cam2_move_up, cl_cam2_new} from "@cl/cam2.ts";
import {TYPE, vec2_t} from "@cl/type";
import {cl_vec2_set} from "@cl/vec2";
import {io_init, io_key_down} from "@engine/io.ts";
import {en_create_canvas} from "@engine/canvas.ts";

function random(min: number, max: number): number {
    return Math.random() * (max - min + 1.0) + min;
}

const canvas_el = en_create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec2 i_position;
        uniform mat4 u_projection;
        uniform mat4 u_view;

        const vec2 positions[4] = vec2[4](
            vec2(-0.5, 0.5),
            vec2(-0.5, -0.5),
            vec2(0.5, 0.5),
            vec2(0.5, -0.5)
        );

        void main() {
            gl_Position = u_projection * u_view * vec4(positions[gl_VertexID] + i_position, 0.0, 1.0);
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        out vec4 o_frag_color;

        void main() {
            o_frag_color = vec4(1.0);
        }
    `
})!;

const u_projection = gl.getUniformLocation(program, "u_projection")!;
const u_view = gl.getUniformLocation(program, "u_view")!;

const x = 20, y = 20;
const num_instances = x * y;
const position_data = new Float32Array(num_instances * 2);
const positions: vec2_t[] = [];

for (let i = 0; i < num_instances; ++i) {
    positions.push(new TYPE(
        position_data.buffer,
        i * 2 * 4,
        2
    ));
}

for (const pos of positions) {
    cl_vec2_set(pos, random(-20.0, 20.0), random(-20.0, 20.0));
}

const position_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
gl.bufferData(gl.ARRAY_BUFFER, position_data, gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(0, 1);

const camera = cl_cam2_new();

io_init();

function update() {
    if (io_key_down("KeyA")) {
        cl_cam2_move_right(camera, -1.0);
    }

    if (io_key_down("KeyD")) {
        cl_cam2_move_right(camera, 1.0);
    }

    if (io_key_down("KeyS")) {
        cl_cam2_move_up(camera, -1.0);
    }

    if (io_key_down("KeyW")) {
        cl_cam2_move_up(camera, 1.0);
    }

    cl_cam2_compute_proj(camera, canvas_el.width, canvas_el.height);
    cl_cam2_compute_view(camera);
}

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u_projection, false, camera.projection);
    gl.uniformMatrix4fv(u_view, false, camera.view);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, num_instances);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
