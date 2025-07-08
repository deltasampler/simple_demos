import {cam3_compute_proj, cam3_compute_view, cam3_move_forward, cam3_move_right, cam3_new, cam3_pan, cam3_tilt, cam3_fru} from "@cl/camera/cam3.ts";
import {mat4} from "@cl/math/mat4.ts";
import {vec3, vec3_t} from "@cl/math/vec3.ts";
import {gl_init, gl_link_program} from "@engine/gl.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {create_canvas} from "@engine/canvas.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const program = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec3 i_position;
        layout(location = 1) in int i_color;
        flat out int v_color;
        uniform mat4 u_projection;
        uniform mat4 u_view;
        uniform mat4 u_model;

        void main() {
            gl_Position = u_projection * u_view * u_model * vec4(i_position, 1.0);
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
})!;

const u_projection = gl.getUniformLocation(program, "u_projection");
const u_view = gl.getUniformLocation(program, "u_view");
const u_model = gl.getUniformLocation(program, "u_model");

export enum ATTR_TYPE {
    S8, U8,
    S16, U16,
    S32, U32,
    F32
};

export const ATTR_TYPE_BYTES = [
    1, 1,
    2, 2,
    4, 4,
    4
];

export function get_attr_type_bytes(type: ATTR_TYPE): number {
    return ATTR_TYPE_BYTES[type];
}

export class attr_t {
    index: number;
    type: ATTR_TYPE;
    size: number;
    type_bytes: number;
    size_bytes: number;
    offset_bytes: number;
};

export class layout_t {
    attrs: attr_t[];
    size: number;
    size_bytes: number;
    types: ATTR_TYPE[];
    offsets: number[];
};

export function layout_new(): layout_t {
    const layout = new layout_t();
    layout.attrs = [];
    layout.size = 0;
    layout.size_bytes = 0;
    layout.types = [];
    layout.offsets = [];

    return layout;
}

export function layout_add_attr(layout: layout_t, type: ATTR_TYPE, size: number): void {
    const attr = new attr_t();
    attr.index = layout.size;
    attr.type = type;
    attr.size = size;
    attr.type_bytes = get_attr_type_bytes(type);
    attr.size_bytes = size * attr.type_bytes;
    attr.offset_bytes = layout.size_bytes;

    layout.attrs.push(attr);
    layout.size += size;
    layout.size_bytes += attr.size_bytes;

    for (let i = 0; i < size; i += 1) {
        layout.types.push(type);
        layout.offsets.push(attr.offset_bytes + i * attr.type_bytes);
    }
}

export function layout_clear(layout: layout_t): void {
    layout.attrs = [];
    layout.size = 0;
    layout.size_bytes = 0;
    layout.types = [];
    layout.offsets = [];
}

export class buffer_t {
    layout: layout_t;
    data: ArrayBuffer;
    view: DataView;
    len: number;
    cap: number;
};

export function buffer_new(layout: layout_t, cap: number): buffer_t {
    const buffer = new buffer_t();
    buffer.layout = layout;
    buffer.data = new ArrayBuffer(layout.size_bytes * cap);
    buffer.view = new DataView(buffer.data);
    buffer.len = 0;
    buffer.cap = cap;

    return buffer;
}

export function buffer_set(buffer: buffer_t, type: ATTR_TYPE, offset: number, elem: number): void {
    const view = buffer.view;

    console.log(type, offset, elem);

    switch (type) {
        case ATTR_TYPE.S8:
            view.setInt8(offset, elem);

            break;
        case ATTR_TYPE.U8:
            view.setUint8(offset, elem);

            break;
        case ATTR_TYPE.S16:
            view.setInt8(offset, elem);

            break;
        case ATTR_TYPE.U16:
            view.setUint16(offset, elem);

            break;
        case ATTR_TYPE.S32:
            view.setInt32(offset, elem, true);

            break;
        case ATTR_TYPE.U32:
            view.setUint32(offset, elem, true);

            break;
        case ATTR_TYPE.F32:
            view.setFloat32(offset, elem, true);

            break;
    }
}

export function buffer_resize(buffer: buffer_t, size: number): void {
    if (buffer.cap === size) return;

    const layout = buffer.layout;

    const data_temp = new ArrayBuffer(size * layout.size_bytes);

    new Uint8Array(data_temp).set(new Uint8Array(buffer.data).subarray(0, Math.min(buffer.len, size) * layout.size_bytes));

    buffer.data = data_temp;
    buffer.view = new DataView(data_temp);
    buffer.len = buffer.len > size ? size : buffer.len;
    buffer.cap = size;
}

export function buffer_push(buffer: buffer_t, ...elems: number[]): void {
    const layout = buffer.layout;
    const cap_req = buffer.len + elems.length;

    if (cap_req > buffer.cap) {
        buffer_resize(buffer, Math.max(cap_req, buffer.cap * 2));
    }

    for (let i = 0; i < elems.length; i += layout.size) {
        for (let j = 0; j < layout.size; j += 1) {
            const type = layout.types[j];
            const offset = buffer.len * layout.size_bytes + layout.offsets[j];
            const value = elems[i + j];

            buffer_set(buffer, type, offset, value);
        }

        buffer.len += 1;
    }
}

export function buffer_clear(buffer: buffer_t): void {
    buffer.len = 0;
}

const vertex_layout = layout_new();
layout_add_attr(vertex_layout, ATTR_TYPE.F32, 3);
layout_add_attr(vertex_layout, ATTR_TYPE.S32, 1);

const index_layout = layout_new();
layout_add_attr(index_layout, ATTR_TYPE.U32, 1);

const vertex_buffer = buffer_new(vertex_layout, 24);
const index_buffer = buffer_new(index_layout, 36);

class mesh_rdata_t {
    vao: WebGLVertexArrayObject;
    vbo: WebGLBuffer;
    ibo: WebGLBuffer;
    index_count: number;
};

function mesh_rdata_new(): mesh_rdata_t {
    const mesh_rdata = new mesh_rdata_t();
    mesh_rdata.vao = 0;
    mesh_rdata.vbo = 0;
    mesh_rdata.ibo = 0;
    mesh_rdata.index_count = 0;

    return mesh_rdata;
}

function mesh_rdata_build(mesh_rdata: mesh_rdata_t, vertex_buffer: buffer_t, index_buffer: buffer_t): void {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertex_buffer.data, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.INT, 16, 12);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index_buffer.data, gl.STATIC_DRAW);

    mesh_rdata.vao = vao;
    mesh_rdata.vbo = vbo;
    mesh_rdata.ibo = ibo;
    mesh_rdata.index_count = index_buffer.len;
}

function block_gen_face_left(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x - h, y + h, z - h, color,
        x - h, y - h, z - h, color,
        x - h, y - h, z + h, color,
        x - h, y + h, z + h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

function block_gen_face_right(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x + h, y + h, z + h, color,
        x + h, y - h, z + h, color,
        x + h, y - h, z - h, color,
        x + h, y + h, z - h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

function block_gen_face_down(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x - h, y - h, z + h, color,
        x - h, y - h, z - h, color,
        x + h, y - h, z - h, color,
        x + h, y - h, z + h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

function block_gen_face_up(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x - h, y + h, z - h, color,
        x - h, y + h, z + h, color,
        x + h, y + h, z + h, color,
        x + h, y + h, z - h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

function block_gen_face_front(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x + h, y + h, z - h, color,
        x + h, y - h, z - h, color,
        x - h, y - h, z - h, color,
        x - h, y + h, z - h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

function block_gen_face_back(vertex_buffer: buffer_t, index_buffer: buffer_t, position: vec3_t, size: number, color: number) {
    const [x, y, z] = position;
    const h = size / 2.0;
    const i = vertex_buffer.len;

    buffer_push(
        vertex_buffer,
        x - h, y + h, z + h, color,
        x - h, y - h, z + h, color,
        x + h, y - h, z + h, color,
        x + h, y + h, z + h, color
    );

    buffer_push(
        index_buffer,
        i, i + 1, i + 2,
        i, i + 2, i + 3
    );
}

const mesh_rdata = mesh_rdata_new();

block_gen_face_left(vertex_buffer, index_buffer, vec3(), 1.0, 0xff0000ff);
block_gen_face_right(vertex_buffer, index_buffer, vec3(), 1.0, 0x00ff00ff);
block_gen_face_down(vertex_buffer, index_buffer, vec3(), 1.0, 0x0000ffff);
block_gen_face_up(vertex_buffer, index_buffer, vec3(), 1.0, 0xffff00ff);
block_gen_face_front(vertex_buffer, index_buffer, vec3(), 1.0, 0xff00ffff);
block_gen_face_back(vertex_buffer, index_buffer, vec3(), 1.0, 0x00ffffff);
mesh_rdata_build(mesh_rdata, vertex_buffer, index_buffer);

const model = mat4(1.0);
const camera = cam3_new();
camera.position = vec3(5.0, 5.0, 5.0);
camera.yaw = -45;
camera.pitch = -45;

io_init();

io_m_move(function(event: m_event_t): void {
    if (document.pointerLockElement === canvas_el) {
        cam3_pan(camera, event.xd);
        cam3_tilt(camera, event.yd);
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
            cam3_move_right(camera, -1.0);
        }

        if (io_key_down("KeyD")) {
            cam3_move_right(camera, 1.0);
        }

        if (io_key_down("KeyS")) {
            cam3_move_forward(camera, -1.0);
        }

        if (io_key_down("KeyW")) {
            cam3_move_forward(camera, 1.0);
        }
    }

    cam3_fru(camera);
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
    gl.bindVertexArray(mesh_rdata.vao);
    gl.drawElements(gl.TRIANGLES, mesh_rdata.index_count, gl.UNSIGNED_INT, 0);
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
