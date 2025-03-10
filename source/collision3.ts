import {d2_center_transform, d2_circle2, d2_clear_color, d2_init, d2_obb_minmax2, d2_polygon_cent2, d2_reset_transform, d2_stroke} from "@engine/d2.ts";
import {body_box, body_circle, body_polygon, body_t, BODY_TYPE, broad_phase_naive, narrow_phase} from "@cl/phys2.ts";
import {vec2, vec2_abs, vec2_add, vec2_copy, vec2_set, vec2_sub} from "@cl/vec2.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_button_down, io_m_button_up, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {create_canvas} from "@engine/canvas.ts";
import { point_inside_obb } from "@cl/collision2";

const canvas_el = create_canvas(document.body);
d2_init(canvas_el);

const bodies: body_t[] = [];
bodies.push(body_circle(vec2(200.0, -300.0), 0.0, 50.0));
bodies.push(body_circle(vec2(), 0.0, 40.0));
bodies.push(body_box(vec2(-200.0, -100.0), 45.0, vec2(80.0, 80.0)));
bodies.push(body_box(vec2(-200.0, -100.0), 69.0, vec2(80.0, 160.0)));
bodies.push(body_polygon(vec2(-100.0, 200.0), 0.0, [vec2(-50.0, -43.3), vec2(50.0, -43.3), vec2(0.0, 43.3)]));
bodies.push(body_polygon(vec2(100.0, 200.0), 69.0, [vec2(-100.0, -86.6), vec2(100.0, -86.6), vec2(0.0, 86.6)]));
bodies.push(body_polygon(vec2(-500.0, -200.0), 0.0, [vec2(100.0, 0.0), vec2(50.0, 86.6), vec2(-50.0, 86.6), vec2(-100.0, 0.0), vec2(-50.0, -86.6), vec2(50.0, -86.6)]));

const ground = body_box(vec2(0.0, -400.0), 0.0, vec2(1400.0, 80.0));
ground.is_static = true;
bodies.push(ground);

console.log(bodies[0]);

io_init();
const mouse = vec2();
let selected: body_t|null = null;
let start_position = vec2();
let selected_pos = vec2();

io_m_move(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    vec2_set(mouse, event.x - canvas_el.width / 2.0, -event.y + canvas_el.height / 2.0);

    if (selected) {
        const offset = vec2_sub(mouse, start_position);
        vec2_copy(selected.position, vec2_add(selected_pos, offset));
    }
});

io_m_button_down(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    for (const body of bodies) {
        if (point_inside_obb(body.position, vec2_abs(vec2_sub(body.max, body.min)), body.rotation, mouse)) {
            selected = body;
            vec2_copy(start_position, mouse);
            vec2_copy(selected_pos, body.position);

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
        body.update(vec2(0.0, -10.0), 0.01);
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
