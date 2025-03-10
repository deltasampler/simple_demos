import {gl_init, gl_link_program} from "@engine/gl.ts";
import {create_canvas} from "@engine/canvas.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        const vec2 positions[4] = vec2[4](
            vec2(-0.5, 0.5),
            vec2(-0.5, -0.5),
            vec2(0.5, 0.5),
            vec2(0.5, -0.5)
        );

        void main() {
            gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        out vec4 o_frag_color;

        void main() {
            o_frag_color = vec4(1.0);
        }
    `
}) as WebGLProgram;

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function loop(): void {
    render();

    requestAnimationFrame(loop);
}

loop();
