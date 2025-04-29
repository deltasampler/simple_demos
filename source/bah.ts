import {gl_init} from "@engine/gl.ts";
import {cam2_compute_proj, cam2_compute_view, cam2_move_right, cam2_move_up, cam2_new, cam2_proj_mouse, cam2_zoom} from "@cl/camera/cam2.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_button_down, io_m_button_up, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {create_canvas} from "@engine/canvas.ts";
import {obb_rdata_build, obb_rdata_instance, obb_rdata_new, obb_rend_build, obb_rend_init, obb_rend_render} from "@engine/obb_rend.ts";
import {vec4} from "@cl/math/vec4.ts";
import {vec2, vec2n_add, vec2_copy, vec2n_muls, vec2_set, vec2n_sub, vec2_t, vec2m_add} from "@cl/math/vec2.ts";
import {rand_in} from "@cl/math/rand.ts";
import {mtv_aabb_aabb2, overlap_aabb_aabb_min_max2, point_inside_aabb} from "@cl/collision/collision2.ts";

const canvas_el = create_canvas(document.body);
const gl = gl_init(canvas_el);

const stats_el = document.createElement("div");
stats_el.style.position = "absolute";
stats_el.style.left = "0";
stats_el.style.top = "0";
stats_el.style.width = "100vw";
stats_el.style.height = "100vh";
stats_el.style.fontSize = "16px";
stats_el.style.color = "#ffffff";
stats_el.style.padding = "16px";
stats_el.style.fontFamily = "monospace";

document.body.append(stats_el);

const camera = cam2_new();
camera.scale = 10;
camera.movement_speed = 2.0;

const mouse_pos = vec2();
let drag_flag = false;
const drag_pos = vec2();
let drag_box: box_t|null = null;
let use_bah = true;
let collision_checks = 0;
const WORLD_SIZE = 1024;

class box_t {
    position: vec2_t;
    size: vec2_t;
    is_static: boolean;
    drag_pos: vec2_t;
};

function box_new(position: vec2_t, size: vec2_t) {
    const box = new box_t();
    box.position = position;
    box.size = size;
    box.is_static = false;
    box.drag_pos = vec2();

    return box;
}

function box_left(box: box_t): number {
    return box.position[0] - box.size[0] / 2.0;
}

function box_right(box: box_t): number {
    return box.position[0] + box.size[0] / 2.0;
}

function box_down(box: box_t): number {
    return box.position[1] - box.size[1] / 2.0;
}

function box_up(box: box_t): number {
    return box.position[1] + box.size[1] / 2.0;
}

function expand_bits(v: number): number {
    v = (v * 0x00010001) & 0xFF0000FF;
    v = (v * 0x00000101) & 0x0F00F00F;
    v = (v * 0x00000011) & 0xC30C30C3;
    v = (v * 0x00000005) & 0x49249249;

    return v;
}


function normalize_cworld_oord(val: number): number {
    return (val + WORLD_SIZE / 2) / WORLD_SIZE;
};

function calc_morton_code(x: number, y: number): number {
    x = normalize_cworld_oord(x);
    y = normalize_cworld_oord(y);
    
    x = Math.min(Math.max(x, 0.0), 1.0);
    y = Math.min(Math.max(y, 0.0), 1.0);
    
    x = Math.min(Math.floor(x * 1023), 1023);
    y = Math.min(Math.floor(y * 1023), 1023);
    
    const xx = expand_bits(x);
    const yy = expand_bits(y);

    return xx | (yy << 1);
}

class bah_node_t {
    min: vec2_t;
    max: vec2_t;
    left: bah_node_t|null;
    right: bah_node_t|null;
    id: number;
}

function bah_node_is_leaf(node: bah_node_t) {
    return node.id > -1;
}

function get_split_pos(start: number, end: number): number {
    return Math.floor((start + end) / 2.0);
}

function create_leaf(box: box_t, id: number) {
    const node = new bah_node_t();
    node.min = vec2(box_left(box), box_down(box));
    node.max = vec2(box_right(box), box_up(box));
    node.left = null;
    node.right = null;
    node.id = id;

    return node;
}

type morton_type = {
    box_id: number;
    morton: number;
};

function create_sub_tree(list: morton_type[], start: number, end: number, boxes: box_t[]): bah_node_t {
    if (start === end) {
        const box_id = list[start].box_id;

        return create_leaf(boxes[box_id], box_id);
    }

    const m = get_split_pos(start, end);
    const node = new bah_node_t();
    node.left = create_sub_tree(list, start, m, boxes);
    node.right = create_sub_tree(list, m + 1, end, boxes);
    node.min = vec2();
    node.max = vec2();
    node.min[0] = Math.min(node.left.min[0], node.right.min[0]);
    node.min[1] = Math.min(node.left.min[1], node.right.min[1]);
    node.max[0] = Math.max(node.left.max[0], node.right.max[0]);
    node.max[1] = Math.max(node.left.max[1], node.right.max[1]);
    node.id = -1;

    return node;
}

function create_tree(boxes: box_t[]): bah_node_t {
    const list: morton_type[] = [];

    for (let i = 0; i < boxes.length; i += 1) {
        const box = boxes[i];
        const center = box.position;
        const morton = calc_morton_code(center[0], center[1]);
        list.push({
            box_id: i,
            morton
        });
    }

    list.sort((a, b) => a.morton - b.morton);

    return create_sub_tree(list, 0, list.length - 1, boxes);
}

function solve_collision(box0: box_t, box1: box_t): void {
    const mtv = mtv_aabb_aabb2(box0.position, box0.size, box1.position, box1.size);

    if (mtv) {
        if (box0.is_static && !box1.is_static) {
            vec2m_add(box1.position, vec2n_muls(mtv.dir, -mtv.depth));
        } else if (!box0.is_static && box1.is_static) {
            vec2m_add(box0.position, vec2n_muls(mtv.dir, mtv.depth));
        } else {
            vec2m_add(box0.position, vec2n_muls(mtv.dir, mtv.depth / 2.0));
            vec2m_add(box1.position, vec2n_muls(mtv.dir, -mtv.depth / 2.0));
        }
    }
}

function find_collisions(box_id: number, box: box_t, node: bah_node_t, boxes: box_t[]): void {
    if (!overlap_aabb_aabb_min_max2(vec2(box_left(box), box_down(box)), vec2(box_right(box), box_up(box)), node.min, node.max)) {
        return;
    }

    if (bah_node_is_leaf(node)) {
        if (node.id !== box_id) {
            solve_collision(box, boxes[node.id]);
            collision_checks += 1;
        }

        return;
    }

    find_collisions(box_id, box, node.left, boxes);
    find_collisions(box_id, box, node.right, boxes);
}

function bah(root: bah_node_t, boxes: box_t[]): void {
    collision_checks = 0;

    for (let i = 0; i < boxes.length; i += 1) {
        find_collisions(i, boxes[i], root, boxes);
    }
}

function brute_force(boxes: box_t[]): void {
    collision_checks = 0;

    for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
            solve_collision(boxes[i], boxes[j]);
            collision_checks += 1;
        }
    }
}

const box_count = 4096;
const boxes: box_t[] = [];

for (let i = 0; i < box_count; i += 1) {
    boxes.push(box_new(vec2(rand_in(-16, 16), rand_in(-16, 16)), vec2(rand_in(1, 4), rand_in(1, 4))));
}

randomize_boxes(boxes);

function randomize_boxes(boxes: box_t[]) {
    for (const box of boxes) {
        vec2_set(box.position, rand_in(-512, 512), rand_in(-512, 512));
        vec2_set(box.size, rand_in(2, 4), rand_in(2, 4));
    }

    const b0 = boxes[0];
    vec2_set(b0.size, 32, 128);
    b0.is_static = true;

    const b1 = boxes[1];
    vec2_set(b1.size, 128, 32);
    b1.is_static = true;
}

io_init();

const obb_rdata = obb_rdata_new();
obb_rdata_build(obb_rdata, box_count);

obb_rend_init();
obb_rend_build(obb_rdata);

io_m_move(function(event: m_event_t): void {
    vec2_set(mouse_pos, event.x, event.y);
    const point = cam2_proj_mouse(camera, mouse_pos, canvas_el.width, canvas_el.height);

    if (drag_flag && drag_box) {
        vec2_copy(drag_box.position, vec2n_add(drag_box.drag_pos, vec2n_sub(point, drag_pos)));
    }
});

io_m_button_down(function(event: m_event_t): void {
    vec2_set(mouse_pos, event.x, event.y);

    const point = cam2_proj_mouse(camera, mouse_pos, canvas_el.width, canvas_el.height);

    for (const box of boxes) {
        if (point_inside_aabb(box.position, box.size, point)) {
            drag_box = box;
            break;
        }
    }

    if (drag_box) {
        drag_flag = true;
        vec2_copy(drag_pos, point);
        vec2_copy(drag_box.drag_pos, drag_box.position);
    }
});

io_m_button_up(function(event: m_event_t): void {
    drag_flag = false;
    drag_box = null;
});

io_kb_key_down(function(event: kb_event_t): void {
    if (event.code === "KeyR") {
        randomize_boxes(boxes);
    }

    if (event.code === "Digit1") {
        use_bah = true;
    }

    if (event.code === "Digit2") {
        use_bah = false;
    }
});

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
        cam2_zoom(camera, -1.0);
    }

    if (io_key_down("KeyE")) {
        cam2_zoom(camera, 1.0);
    }

    cam2_compute_proj(camera, canvas_el.width, canvas_el.height);
    cam2_compute_view(camera);

    if (use_bah) {
        const root = create_tree(boxes);
        bah(root, boxes);
    } else {
        brute_force(boxes);
    }
}

function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let i = 0; i < box_count; i += 1) {
        const box = boxes[i];

        obb_rdata_instance(obb_rdata, i, box.position, box.size, 0, 0, vec4(170, 170, 170, 255), vec4(255, 0, 255, 255), 0.1);
    }

    obb_rend_render(obb_rdata, camera);

    let stats = "";
    stats += `Box count: ${box_count}<br>`;
    stats += `Method: ${ use_bah ? "Bounding Area Hierarchy" : "Brute Force" }<br>`;
    stats += `Collision Checks Per Frame: ${ collision_checks }`;
    stats_el.innerHTML = stats;
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
