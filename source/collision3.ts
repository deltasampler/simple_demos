import {d2_center_transform, d2_circle2, d2_clear_color, d2_init, d2_obb_minmax2, d2_polygon_cent2, d2_reset_transform, d2_stroke} from "@engine/d2.ts";
import {body_box, body_circle, body_polygon, body_t, BODY_TYPE, broad_phase_naive, narrow_phase, point_inside_obb} from "@cl/phys2.ts";
import {cl_vec2, cl_vec2_abs, cl_vec2_add, cl_vec2_copy, cl_vec2_set, cl_vec2_sub} from "@cl/vec2.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_button_down, io_m_button_up, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {en_create_canvas} from "@engine/canvas.ts";

const canvas_el = en_create_canvas(document.body);
d2_init(canvas_el);

const bodies: body_t[] = [];
bodies.push(body_circle(cl_vec2(200.0, -300.0), 0.0, 50.0));
bodies.push(body_circle(cl_vec2(), 0.0, 40.0));
bodies.push(body_box(cl_vec2(-200.0, -100.0), 45.0, cl_vec2(80.0, 80.0)));
bodies.push(body_box(cl_vec2(-200.0, -100.0), 69.0, cl_vec2(80.0, 160.0)));
bodies.push(body_polygon(cl_vec2(-100.0, 200.0), 0.0, [cl_vec2(-50.0, -43.3), cl_vec2(50.0, -43.3), cl_vec2(0.0, 43.3)]));
bodies.push(body_polygon(cl_vec2(100.0, 200.0), 69.0, [cl_vec2(-100.0, -86.6), cl_vec2(100.0, -86.6), cl_vec2(0.0, 86.6)]));
bodies.push(body_polygon(cl_vec2(-500.0, -200.0), 0.0, [cl_vec2(100.0, 0.0), cl_vec2(50.0, 86.6), cl_vec2(-50.0, 86.6), cl_vec2(-100.0, 0.0), cl_vec2(-50.0, -86.6), cl_vec2(50.0, -86.6)]));

const ground = body_box(cl_vec2(0.0, -400.0), 0.0, cl_vec2(1400.0, 80.0));
ground.is_static = true;
bodies.push(ground);

console.log(bodies[0]);

io_init();
const mouse = cl_vec2();
let selected: body_t|null = null;
let start_position = cl_vec2();
let selected_pos = cl_vec2();

io_m_move(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    cl_vec2_set(mouse, event.x - canvas_el.width / 2.0, -event.y + canvas_el.height / 2.0);

    if (selected) {
        const offset = cl_vec2_sub(mouse, start_position);
        cl_vec2_copy(selected.position, cl_vec2_add(selected_pos, offset));
    }
});

io_m_button_down(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    for (const body of bodies) {
        if (point_inside_obb(body.position, cl_vec2_abs(cl_vec2_sub(body.max, body.min)), body.rotation, mouse)) {
            selected = body;
            cl_vec2_copy(start_position, mouse);
            cl_vec2_copy(selected_pos, body.position);

            return;
        }
    }
});

io_m_button_up(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    selected = null;
});

function resolve() {
    for (const body of bodies) {
        body.update(cl_vec2(0.0, -10.0), 0.01);
    }

    const pairs = broad_phase_naive(bodies);
    narrow_phase(pairs);
}

io_kb_key_down(function(event: kb_event_t): void {
    // if (event.code === "KeyR") {
        // resolve();
    // }
});

function update(): void {
    // for (const body of bodies) {
    //     body.rotation += 0.01;
    // }

    if (io_key_down("KeyR")) {
        resolve();
    }
}

function render(): void {
    d2_reset_transform();
    d2_clear_color(0, 0, 0);
    d2_center_transform();

    for (const body of bodies) {
        if (body.type === BODY_TYPE.CIRCLE) {
            d2_stroke(217, 217, 217, 2.0);
            d2_circle2(body.position, body.radius);
        } else if (body.type === BODY_TYPE.BOX) {
            d2_stroke(217, 217, 217, 2.0);
            d2_obb_minmax2(body.min, body.max, body.position, body.rotation);
        } else if (body.type === BODY_TYPE.POLYGON) {
            d2_stroke(217, 217, 217, 2.0);
            d2_polygon_cent2(body.vertices, body.position, body.rotation);
        }

        // d2_stroke(255, 0, 0, 1.0);
        // d2_circle2(body.position, body.radius);

        // d2_stroke(0, 0, 255, 1.0);
        // d2_obb_minmax2(body.min, body.max, body.position, body.rotation);
    }
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
