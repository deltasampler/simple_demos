import {gl_init, gl_link_program} from "@engine/gl.ts";
import {en_create_canvas} from "@engine/canvas.ts";

const canvas_el = en_create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
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

        void main() {
            vec2 uv = v_tex_coord;

            o_frag_color = vec4(uv.x, 0.0, uv.y, 1.0);
        }
    `
}) as WebGLProgram;

const u_scale_x = gl.getUniformLocation(program, "u_scale_x");
const u_scale_y = gl.getUniformLocation(program, "u_scale_y");

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

function render(): void {
    const canvas_size = Math.min(canvas_el.width, canvas_el.height);

    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
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
