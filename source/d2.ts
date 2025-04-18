import {d2_aabb, d2_center_transform, d2_circle, d2_circle_angle, d2_clear_color, d2_fill, d2_init, d2_line, d2_line_arrow, d2_line_radius, d2_obb, d2_obb_angle, d2_point, d2_point_radius, d2_polygon, d2_polygon_cent, d2_polygon_cent_angle, d2_reset_transform, d2_stroke} from "@engine/d2.ts";
import {io_init, io_m_move, m_event_t} from "@engine/io.ts";
import {create_canvas} from "@engine/canvas.ts";
import {vec2, vec2_set, vec2_t} from "@cl/math/vec2.ts";

const canvas_el = create_canvas(document.body);
const mouse = vec2();

io_init();

io_m_move(function(event: m_event_t): void {
    if (event.target !== canvas_el) {
        return;
    }

    vec2_set(mouse, event.x - canvas_el.width / 2.0, -event.y + canvas_el.height / 2.0);
});

d2_init(canvas_el);

function center_points(points: vec2_t[]) {
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

    return [cx, cy];
}

const triangle: vec2_t[] = [vec2(-100.0, -86.6), vec2(100.0, -86.6), vec2(0.0, 86.6)];
center_points(triangle);
const quad = [vec2(-400.0, -100.0), vec2(-350.0, -200.0), vec2(-100.0, -250.0), vec2(-100.0, -200.0)];

function render() {
    d2_reset_transform();
    d2_clear_color(0.0, 0.0, 0.0);
    d2_center_transform();

    d2_fill(255.0, 0.0, 0.0);
    d2_point(0.0, 0.0);

    d2_fill(255.0, 0.0, 255.0);
    d2_point_radius(100.0, 100.0, 20.0);

    d2_stroke(255.0, 255.0, 0.0, 1.0);
    d2_line(-100.0, -100.0, -100.0, 100.0);

    d2_fill(0.0, 255.0, 0.0);
    d2_line_radius(-200.0, -100.0, -200.0, 100.0, 10.0);

    d2_stroke(255.0, 255.0, 255.0, 1.0);
    d2_circle(-100.0, 200.0, 40.0);

    d2_stroke(255.0, 0.0, 0.0, 1.0);
    d2_circle_angle(-100.0, 200.0, 40.0, performance.now() / 1000.0);

    d2_fill(255.0, 127.0, 127.0);
    d2_aabb(-300.0, 200.0, 100.0, 100.0);

    d2_fill(255.0, 255.0, 255.0);
    d2_obb(200.0, 200.0, 50.0, 50.0, performance.now() / 1000.0);

    d2_stroke(255.0, 0.0, 0.0, 1.0);
    d2_obb_angle(200.0, 200.0, 50.0, 50.0, performance.now() / 1000.0);

    d2_fill(0.0, 255.0, 127.0);
    d2_polygon_cent(triangle, -600.0, -200.0, performance.now() / 1000.0);

    d2_stroke(255.0, 0.0, 0.0, 1.0);
    d2_polygon_cent_angle(triangle[0], -600.0, -200.0, performance.now() / 1000.0);

    d2_stroke(0.0, 255.0, 255.0, 1.0);
    d2_polygon(quad);

    d2_stroke(255.0, 0.0, 0.0, 1.0);
    d2_line(-500.0, -100.0, -400.0, 400.0);

    d2_fill(255.0, 255.0, 0.0);
    d2_line_arrow(-500.0, -100.0, -400.0, 400.0, 4.0);
}

function loop() {
    render();

    requestAnimationFrame(loop);
}

loop();
