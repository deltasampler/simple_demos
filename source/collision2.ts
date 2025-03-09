import {vec2_t, vec3_t} from "@cl/type.ts";
import {cl_vec2, cl_vec2_add, cl_vec2_add_mul_s2, cl_vec2_copy, cl_vec2_dir, cl_vec2_dist, cl_vec2_set, cl_vec2_sub} from "@cl/vec2.ts";
import {d2_aabb2, d2_center_transform, d2_circle2, d2_clear_color, d2_fill, d2_fill_vec, d2_init, d2_line2, d2_line_arrow2, d2_line_radius2, d2_obb2, d2_polygon_cent2, d2_reset_transform, d2_stroke_vec} from "@engine/d2.ts";
import {io_init, io_kb_key_down, io_m_button_down, io_m_button_up, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {line_intersect_aabb, line_intersect_capsule, line_intersect_circle, line_intersect_convex_cent, line_intersect_line, line_intersect_obb, point_closest_aabb, point_closest_capsule, point_closest_circle, point_closest_convex_cent, point_closest_line, point_closest_obb, point_inside_aabb, point_inside_capsule, point_inside_circle, point_inside_convex_cent, point_inside_obb, sat} from "@cl/phys2.ts";
import {cl_vec3} from "@cl/vec3.ts";
import {en_create_canvas} from "@engine/canvas.ts";

const canvas_el = en_create_canvas(document.body);
d2_init(canvas_el);

const mouse = cl_vec2();

io_init();

interface collider_t {
    render(color: vec3_t): void;
    point_inside(point: vec2_t): boolean;
    rotate(angle: number): void;
    closest_point(point: vec2_t): vec2_t;
    translate(position: vec2_t): void;
    get_position(): vec2_t;
    intersect_line(a: vec2_t, b: vec2_t): vec2_t[];
};

class circle_t implements collider_t {
    position: vec2_t;
    radius: number;

    constructor(position: vec2_t, radius: number) {
        this.position = position;
        this.radius = radius;
    }

    render(color: vec3_t): void {
        d2_fill_vec(color);
        d2_circle2(this.position, this.radius);
    }

    point_inside(point: vec2_t): boolean {
        return point_inside_circle(this.position, this.radius, point);
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_circle(this.position, this.radius, point);
    }

    rotate(angle: number): void {
        return;
    }

    translate(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    get_position(): vec2_t {
        return this.position;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_circle(this.position, this.radius, a, b);
    }
}

class aabb_t implements collider_t {
    position: vec2_t;
    size: vec2_t;

    constructor(position: vec2_t, size: vec2_t) {
        this.position = position;
        this.size = size;
    }

    render(color: vec3_t): void {
        d2_fill_vec(color);
        d2_aabb2(this.position, this.size);
    }

    point_inside(point: vec2_t): boolean {
        return point_inside_aabb(this.position, this.size, point);
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_aabb(this.position, this.size, point);
    }

    rotate(angle: number): void {
        return;
    }

    translate(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    get_position(): vec2_t {
        return this.position;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_aabb(this.position, this.size, a, b);
    }
}

class obb_t implements collider_t {
    position: vec2_t;
    size: vec2_t;
    angle: number;

    constructor(position: vec2_t, size: vec2_t, angle: number) {
        this.position = position;
        this.size = size;
        this.angle = angle;
    }

    render(color: vec3_t): void {
        d2_fill_vec(color);
        d2_obb2(this.position, this.size, this.angle);
    }

    point_inside(point: vec2_t): boolean {
        return point_inside_obb(this.position, this.size, this.angle, point);
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_obb(this.position, this.size, this.angle, point);
    }

    rotate(angle: number): void {
        this.angle += angle;
    }

    translate(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    get_position(): vec2_t {
        return this.position;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_obb(this.position, this.size, this.angle, a, b);
    }
}

class capsule_t implements collider_t {
    start: vec2_t;
    end: vec2_t;
    radius: number;

    constructor(start: vec2_t, end: vec2_t, radius: number) {
        this.start = start;
        this.end = end;
        this.radius = radius;
    }

    render(color: vec3_t): void {
        d2_fill_vec(color);
        d2_line_radius2(this.start, this.end, this.radius);
    }

    point_inside(point: vec2_t): boolean {
        return point_inside_capsule(this.start, this.end, this.radius, point);
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_capsule(this.start, this.end, this.radius, point);
    }

    rotate(angle: number): void {
        return;
    }

    translate(position: vec2_t): void {
        return;
    }

    get_position(): vec2_t {
        return this.start;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_capsule(this.start, this.end, this.radius, a, b);
    }
}

class line_t implements collider_t {
    start: vec2_t;
    end: vec2_t;

    constructor(start: vec2_t, end: vec2_t) {
        this.start = start;
        this.end = end;
    }

    render(color: vec3_t): void {
        d2_stroke_vec(color, 2.0);
        d2_line2(this.start, this.end);
    }

    point_inside(point: vec2_t): boolean {
        return cl_vec2_dist(point_closest_line(this.start, this.end, point), point) <= 2.0;
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_line(this.start, this.end, point);
    }

    rotate(angle: number): void {
        return;
    }

    translate(position: vec2_t): void {
        return;
    }

    get_position(): vec2_t {
        return this.start;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_line(this.start, this.end, a, b);
    }
}

function center_points(points: vec2_t[]): vec2_t {
    let cx = 0.0, cy = 0.0;
    let area = 0.0;

    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];
        const x0 = curr[0], y0 = curr[1];
        const x1 = next[0], y1 = next[1];
        const cross = x0 * y1 - x1 * y0;

        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
        area += cross;
    }

    area *= 0.5;
    cx /= (6 * area);
    cy /= (6 * area);

    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        point[0] -= cx;
        point[1] -= cy;
    }

    return cl_vec2(cx, cy);
}

class polygon_t implements collider_t {
    points: vec2_t[];
    center: vec2_t;
    position: vec2_t;
    angle: number;

    constructor(points: vec2_t[], position: vec2_t, angle: number) {
        this.points = points;
        this.center = center_points(this.points);
        this.position = position;
        this.angle = angle;
    }

    render(color: vec3_t): void {
        d2_fill_vec(color);
        d2_polygon_cent2(this.points, this.position, this.angle);
    }

    point_inside(point: vec2_t): boolean {
        return point_inside_convex_cent(this.points, this.position, this.angle, point);
    }

    closest_point(point: vec2_t): vec2_t {
        return point_closest_convex_cent(this.points, this.position, this.angle, point);
    }

    rotate(angle: number): void {
        this.angle += angle;
    }

    translate(position: vec2_t): void {
        cl_vec2_copy(this.position, position);
    }

    get_position(): vec2_t {
        return this.position;
    }

    intersect_line(a: vec2_t, b: vec2_t): vec2_t[] {
        return line_intersect_convex_cent(this.points, this.position, this.angle, a, b);
    }
}

const start = cl_vec2(-200.0, -200.0), end = cl_vec2(100.0, -400.0);

const colliders: collider_t[] = [];
colliders.push(new circle_t(cl_vec2(400.0, -50), 50.0));
colliders.push(new aabb_t(cl_vec2(200.0, 10.0), cl_vec2(120.0)));
colliders.push(new obb_t(cl_vec2(-200.0, 10.0), cl_vec2(80.0, 160.0), 90.0));
colliders.push(new capsule_t(cl_vec2(-200.0, 200.0), cl_vec2(200.0, 400.0), 30.0));
colliders.push(new polygon_t([cl_vec2(-100.0, -86.6), cl_vec2(100.0, -86.6), cl_vec2(0.0, 86.6)], cl_vec2(200.0, -200.0), 0.0));
colliders.push(new polygon_t([cl_vec2(100.0, 0.0), cl_vec2(50.0, 86.6), cl_vec2(-50.0, 86.6), cl_vec2(-100.0, 0.0), cl_vec2(-50.0, -86.6), cl_vec2(50.0, -86.6)], cl_vec2(-500.0, -200.0), 0.0));
colliders.push(new line_t(cl_vec2(-400.0, 100.0), cl_vec2(-200.0, 300.0)));

const line = new line_t(start, end);
colliders.push(line);

const circle = new circle_t(cl_vec2(0.0), 50.0)
colliders.push(circle);

let selected: collider_t|null = null;
let start_position = cl_vec2();
let selected_pos = cl_vec2();
let capsule_part: number = 0;

io_m_move(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    cl_vec2_set(mouse, event.x - canvas_el.width / 2.0, -event.y + canvas_el.height / 2.0);

    if (selected) {
        if (selected instanceof capsule_t || selected instanceof line_t) {
            if (capsule_part === 1) {
                cl_vec2_copy(selected.start, mouse);
            } else if (capsule_part === 2) {
                cl_vec2_copy(selected.end, mouse);
            }
        } else {
            const offset = cl_vec2_sub(mouse, start_position);
            selected.translate(cl_vec2_add(selected_pos, offset));
        }
    }
});

io_m_button_down(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    for (const collider of colliders) {
        if (collider instanceof capsule_t) {
            if (point_inside_circle(collider.start, collider.radius, mouse)) {
                capsule_part = 1;
                selected = collider;
                return;
            } else if (point_inside_circle(collider.end, collider.radius, mouse)) {
                capsule_part = 2;
                selected = collider;
                return;
            } else {
                capsule_part = 0;
            }
        }

        if (collider instanceof line_t) {
            if (point_inside_circle(collider.start, 20.0, mouse)) {
                capsule_part = 1;
                selected = collider;

                return;
            } else if (point_inside_circle(collider.end, 20.0, mouse)) {
                selected = collider;
                capsule_part = 2;
                return;
            } else {
                capsule_part = 0;
            }
        }

        if (collider.point_inside(mouse)) {
            selected = collider;
            cl_vec2_copy(start_position, mouse);
            cl_vec2_copy(selected_pos, collider.get_position());

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
    for (const collider of colliders) {
        if (collider !== circle) {
            const cp = collider.closest_point(circle.position);
            const dir = cl_vec2_dir(circle.position, cp);
            const distance_to_cp = cl_vec2_dist(circle.position, cp);

            if (collider.point_inside(circle.position)) {
                cl_vec2_add_mul_s2(circle.position, dir, -(circle.radius + distance_to_cp));
            } else {
                const depth = circle.radius - distance_to_cp;

                if (depth > 0.0) {
                    cl_vec2_add_mul_s2(circle.position, dir, depth);
                }
            }
        }
    }
}

io_kb_key_down(function(event: kb_event_t): void {
    if (event.code === "KeyR") {
        resolve();
    }
});

function update(): void {
    for (const collider of colliders) {
        collider.rotate(0.001);
    }

    resolve();
}

function render(): void {
    d2_reset_transform();
    d2_clear_color(184, 242, 255);
    d2_center_transform();

    for (const collider of colliders) {
        if (collider === line) {
            collider.render(cl_vec3(89, 111, 255));
            continue;
        }

        if (collider === circle) {
            collider.render(cl_vec3(89, 111, 255));
            continue;
        }

        if (collider.point_inside(mouse)) {
            collider.render(cl_vec3(227, 227, 227));
        } else {
            collider.render(cl_vec3(209, 209, 209));
        }

        if (selected && selected instanceof polygon_t && selected !== collider && collider instanceof polygon_t) {
            const result = sat(selected.points, selected.position, selected.angle, collider.points, collider.position, collider.angle);

            if (result.collision) {
                collider.render(cl_vec3(255, 209, 209));

                d2_fill(255.0, 0.0, 0.0);
                d2_line_arrow2(cl_vec2(), result.mtv!, 4.0);
            } else {
                collider.render(cl_vec3(209, 209, 209));
            }
        } else {
            collider.render(cl_vec3(209, 209, 209));
        }
    }

    for (const collider of colliders) {
        const cp = collider.closest_point(mouse);

        if (!selected && cl_vec2_dist(cp, mouse) <= 100.0) {
            d2_stroke_vec(cl_vec3(255, 120, 120), 4.0);
            d2_line2(cp, mouse);

            d2_fill_vec(cl_vec3(255, 120, 120));
            d2_circle2(cp, 4.0);
        }

        if (collider !== line) {
            const points = collider.intersect_line(line.start, line.end);

            for (const point of points) {
                d2_fill_vec(cl_vec3(255, 120, 120));
                d2_circle2(point, 4.0);
            }
        }
    }
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
