import {gl_init, gl_link_program} from "@engine/gl.ts";
import {cam2_compute_proj, cam2_compute_view, cam2_move_right, cam2_move_up, cam2_new} from "@cl/cam2.ts";
import {io_init, io_key_down} from "@engine/io.ts";
import { TYPE } from "@cl/type";
import {create_canvas} from "@engine/canvas.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec2 i_position;
        layout(location = 1) in vec2 i_size;
        layout(location = 2) in float i_rotation;
        layout(location = 3) in vec4 i_color;
        out vec2 v_size;
        out vec2 v_tex_coord;
        out vec4 v_color;
        uniform mat4 u_projection;
        uniform mat4 u_view;

        const vec2 positions[4] = vec2[](
            vec2(-0.5, 0.5),
            vec2(-0.5, -0.5),
            vec2(0.5, 0.5),
            vec2(0.5, -0.5)
        );

        const vec2 tex_coords[4] = vec2[](
            vec2(0.0, 0.0),
            vec2(0.0, 1.0),
            vec2(1.0, 0.0),
            vec2(1.0, 1.0)
        );

        vec2 rotate(vec2 pos, float angle) {
            float s = sin(angle);
            float c = cos(angle);
            return vec2(
                pos.x * c - pos.y * s,
                pos.x * s + pos.y * c
            );
        }

        void main() {
            vec2 p = rotate(positions[gl_VertexID] * i_size, i_rotation) + i_position;

            gl_Position = u_projection * u_view * vec4(p, 0.0, 1.0);
            v_size = i_size;
            v_tex_coord = tex_coords[gl_VertexID];
            v_color = i_color;
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        in vec2 v_size;
        in vec2 v_tex_coord;
        in vec4 v_color;
        out vec4 o_frag_color;

        void main() {
            vec2 uv = v_tex_coord;
            vec2 border = 0.2 / v_size;
            float softness = 1.0 / v_size.x;
            float left = smoothstep(0.0, border.x, uv.x);
            float right = smoothstep(0.0, border.x, 1.0 - uv.x);
            float top = smoothstep(0.0, border.y, uv.y);
            float bottom = smoothstep(0.0, border.y, 1.0 - uv.y);
            float outline = min(min(left, right), min(top, bottom));
            vec4 outlineColor = vec4(v_color.xyz * 0.5, 1.0);

            o_frag_color = mix(outlineColor, v_color, outline);
        }
    `
})!;

const u_projection = gl.getUniformLocation(program, "u_projection")!;
const u_view = gl.getUniformLocation(program, "u_view")!;

const instance_count = 1000.0;
const instance_data = new Float32Array(instance_count * 9);
const instances: Float32Array[]= [];

function random(min: number, max: number): number {
    return Math.random() * (max - min + 1.0) + min;
}

for (let i = 0; i < instance_count; ++i) {
    instances.push(new TYPE(
        instance_data.buffer,
        i * 9 * 4,
        9
    ));
}

for (const instance of instances) {
    const px = random(-50.0, 50.0);
    const py = random(-50.0, 50.0);
    const sx = random(1.0, 4.0);
    const sy = random(1.0, 2.0);
    instance[0] = px;
    instance[1] = py;
    instance[2] = sx;
    instance[3] = sy;
    instance[4] = Math.random();
    instance[5] = Math.random();
    instance[6] = Math.random();
    instance[7] = Math.random();
    instance[8] = 1.0;
}

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instance_data), gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 36, 0);
gl.vertexAttribDivisor(0, 1);

gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 8);
gl.vertexAttribDivisor(1, 1);

gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 36, 16);
gl.vertexAttribDivisor(2, 1);

gl.enableVertexAttribArray(3);
gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 20);
gl.vertexAttribDivisor(3, 1);

const camera = cam2_new();

io_init();

setInterval(function() {
    for (const instance of instances) {
        instance[4] += Math.random() * 0.01;
    }
}, 1000.0 / 30.0);

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

    cam2_compute_proj(camera, canvas_el.width, canvas_el.height);
    cam2_compute_view(camera);
}

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u_projection, false, camera.projection);
    gl.uniformMatrix4fv(u_view, false, camera.view);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instance_data);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instance_count);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
