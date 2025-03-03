import { vec2_t, vec3_t } from "@cl/type";
import {cl_vec2, cl_vec2_add2, cl_vec2_copy, cl_vec2_dist, cl_vec2_len, cl_vec2_mul_s, cl_vec2_set, cl_vec2_sub, cl_vec2_unit} from "@cl/vec2.ts";
import {cl_vec3} from "@cl/vec3.ts";
import {d2_circle, d2_clear_color_rgb, d2_init, d2_line, d2_rect, d2_stroke} from "@engine/d2.ts";
import {io_init, io_m_button_down, io_m_button_up, io_m_move, m_event_t} from "@engine/io.ts";
import {cl_abs, cl_clamp, cl_hypot} from "@cl/math.ts";

document.body.style.margin = "0";
document.body.style.height = "100vh";
document.body.style.overflow = "hidden";

const canvas_el = document.createElement("canvas");
canvas_el.width = document.body.clientWidth;
canvas_el.height = document.body.clientHeight;
document.body.append(canvas_el);

addEventListener("resize", function(): void {
    canvas_el.width = document.body.clientWidth;
    canvas_el.height = document.body.clientHeight;
});

function closest_point_on_line(start: vec2_t, end: vec2_t, point: vec2_t): vec2_t {
    const bax = end[0] - start[0];
    const bay = end[1] - start[1];
    const pax = point[0] - start[0];
    const pay = point[1] - start[1];
    const t = (bax * pax + bay * pay) / (bax * bax + bay * bay);
    const tc = cl_clamp(t, 0.0, 1.0);

    return cl_vec2(start[0] + bax * tc, start[1] + bay * tc);
}

interface collider_t {
    point_inside(point: vec2_t): boolean;
    point_closest(point: vec2_t): vec2_t;
    render(color: vec3_t): void;
    move(position: vec2_t): void;
    move2(position: vec2_t): void;
};

class circle_t implements collider_t {
    position: vec2_t;
    diameter: number;

    constructor(position: vec2_t, diameter: number) {
        this.position = position;
        this.diameter = diameter;
    }

    point_inside(point: vec2_t): boolean {
        const dx = this.position[0] - point[0];
        const dy = this.position[1] - point[1];
        const r = this.diameter / 2.0;

        return (dx * dx + dy * dy) <= (r * r);
    }

    point_closest(point: vec2_t): vec2_t {
        const dx = this.position[0] - point[0];
        const dy = this.position[1] - point[1];
        const l = cl_hypot(dx, dy);
        const nx = dx / l;
        const ny = dy / l;
        const r = this.diameter / 2.0;

        return cl_vec2(this.position[0] - nx * r, this.position[1] - ny * r);
    }

    move(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    move2(position: vec2_t): void {
        cl_vec2_add2(this.position, position);
    }

    render(color: vec3_t): void {
        d2_circle(this.position, this.diameter);
        d2_stroke(color, 1.0);
    }
};

class aabb_t implements collider_t {
    position: vec2_t;
    size: vec2_t;

    constructor(position: vec2_t, size: vec2_t) {
        this.position = position;
        this.size = size;
    }

    point_inside(point: vec2_t): boolean {
        const x = this.position[0], y = this.position[1];
        const hsx = this.size[0] / 2.0, hsy = this.size[1] / 2.0;
        const minx = x - hsx, miny = y - hsy;
        const maxx = x + hsx, maxy = y + hsy;
        const px = point[0], py = point[1];

        return px >= minx && px <= maxx && py >= miny && py <= maxy;
    }

    point_closest(point: vec2_t): vec2_t {
        const x = this.position[0], y = this.position[1];
        const hsx = this.size[0] / 2.0, hsy = this.size[1] / 2.0;
        const minx = x - hsx, miny = y - hsy;
        const maxx = x + hsx, maxy = y + hsy;
        const px = point[0], py = point[1];

        if (px >= minx && px <= maxx && py >= miny && py <= maxy) {
            const cx = cl_abs(minx - point[0]) < cl_abs(maxx - point[0]) ? minx : maxx;
            const cy = cl_abs(miny - point[1]) < cl_abs(maxy - point[1]) ? miny : maxy;
            const a = closest_point_on_line(cl_vec2(minx, cy), cl_vec2(maxx, cy), point)
            const b = closest_point_on_line(cl_vec2(cx, miny), cl_vec2(cx, maxy), point);

            if (cl_vec2_dist(a, point) < cl_vec2_dist(b, point)) {
                return a;
            }

            return b;
        }

        const a = closest_point_on_line(cl_vec2(minx, maxy), cl_vec2(maxx, maxy), point)
        const b = closest_point_on_line(cl_vec2(maxx, miny), cl_vec2(maxx, maxy), point);

        return cl_vec2(a[0], b[1]);
    }

    move(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    move2(position: vec2_t): void {
        cl_vec2_add2(this.position, position);
    }

    render(color: vec3_t): void {
        d2_rect(this.position, this.size);
        d2_stroke(color, 1.0);
    }
};

class line_t implements collider_t {
    start: vec2_t;
    end: vec2_t;
    diameter: number;

    constructor(start: vec2_t, end: vec2_t, diameter: number) {
        this.start = start;
        this.end = end;
        this.diameter = diameter;
    }

    point_inside(point: vec2_t): boolean {
        return false;
    }

    point_closest(point: vec2_t): vec2_t {
        const tp = closest_point_on_line(this.start, this.end, point);
        const dx = tp[0] - point[0];
        const dy = tp[1] - point[1];
        const l = cl_hypot(dx, dy);
        const nx = dx / l;
        const ny = dy / l;
        const r = this.diameter / 2.0;

        return cl_vec2(tp[0] - nx * r, tp[1] - ny * r);
    }

    move(position: vec2_t): void {
        return;
    }

    move2(position: vec2_t): void {
        return;
    }
    
    render(color: vec3_t): void {
        d2_line(this.start, this.end);
        d2_stroke(color, 1.0);
        d2_circle(this.start, this.diameter);
        d2_stroke(color, 1.0);
        d2_circle(this.end, this.diameter);
        d2_stroke(color, 1.0);
    }
};

const colliders: collider_t[] = [];
colliders.push(new circle_t(cl_vec2(-200.0, 200.0), 100.0));
colliders.push(new aabb_t(cl_vec2(200.0, 200.0), cl_vec2(100.0, 100.0)));
colliders.push(new aabb_t(cl_vec2(-200.0, -200.0), cl_vec2(100.0, 200.0)));
colliders.push(new aabb_t(cl_vec2(200.0, 0.0), cl_vec2(200.0, 100.0)));

const start = cl_vec2(-400.0, 0.0);
const end = cl_vec2(-300.0, -400.0)

colliders.push(new line_t(start, end, 50.0));
colliders.push(new circle_t(start, 50.0));
colliders.push(new circle_t(end, 50.0));

const d2 = d2_init(canvas_el);
const mouse = cl_vec2();
let selected: collider_t|null;

io_init();

io_m_move(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    cl_vec2_set(mouse, event.x - canvas_el.width / 2.0, -event.y + canvas_el.height / 2.0);

    if (selected) {
        selected.move(mouse)

        if (selected instanceof circle_t) {
            for (const collider of colliders) {
                if (collider === selected) {
                    continue;
                }

                const p = collider.point_closest(selected.position);
                const d = cl_vec2_sub(selected.position, p);
                const n = cl_vec2_unit(d);
                const l = cl_vec2_len(d);

                if (l <= selected.diameter / 2.0) {
                    collider.move2(cl_vec2_mul_s(n, l - selected.diameter / 2.0));
                }
            }
        }
    }
});

io_m_button_down(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    for (const collider of colliders) {
        if (collider.point_inside(mouse)) {
            selected = collider;

            break;
        }
    }
});

io_m_button_up(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    if (selected) {
        selected = null;
    }
});

function render(): void {
    d2.resetTransform();
    d2_clear_color_rgb(0.0, 0.0, 0.0);
    d2.translate(canvas_el.width / 2.0, canvas_el.height / 2.0);
    d2.scale(1.0, -1.0);

    for (const collider of colliders) {
        let color;

        if (collider.point_inside(mouse)) {
            color = cl_vec3(255.0, 0.0, 0.0);
        } else {
            color = cl_vec3(255.0, 255.0, 255.0);
        }

        const closest_point = collider.point_closest(mouse);

        collider.render(color);

        if (cl_vec2_dist(closest_point, mouse) < 200.0) {
            d2_line(mouse, closest_point);
            d2_stroke(cl_vec3(255.0, 0.0, 255.0), 1.0);
        }
    }
}

function loop(): void {
    render();

    requestAnimationFrame(loop);
}

loop();
