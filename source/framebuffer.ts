import {gl_init, gl_link_program} from "@engine/gl.ts";
import {create_canvas} from "@engine/canvas.ts";

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
})  as WebGLProgram;

const u_scale_x = gl.getUniformLocation(program_main, "u_scale_x");
const u_scale_y = gl.getUniformLocation(program_main, "u_scale_y");

const program_texture = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec2 i_position;
        layout(location = 1) in vec2 i_tex_coord;
        out vec2 v_tex_coord;

        void main() {
            gl_Position = vec4(i_position, 0.0, 1.0);
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
});

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

const texture_width = 4;
const texture_height = 4;
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texture_width, texture_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
gl.viewport(0, 0, texture_width, texture_height);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.useProgram(program_texture);
gl.bindVertexArray(vao);
gl.drawElements(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
