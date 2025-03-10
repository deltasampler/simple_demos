import {create_canvas} from "@engine/canvas.ts";
import {io_init} from "@engine/io.ts";
import {d2_center_transform, d2_circle2, d2_clear_color, d2_fill, d2_init, d2_line2, d2_reset_transform, d2_stroke, d2_text} from "@engine/d2.ts";
import {circle_new} from "@cl/circle.ts";
import {vec2} from "@cl/vec2";
import { body_circle, body_t } from "@cl/body.ts";
import { bah_node_insert, bah_node_new, bah_node_t, bah_potential_pairs, pair_t } from "@cl/bah.ts";

const canvas_el = create_canvas(document.body);
d2_init(canvas_el);
io_init();

const bodies: body_t[] = [];
bodies.push(body_circle(vec2(10.0, 0.0), 0.0, 40.0));
bodies.push(body_circle(vec2(240.0, 100.0), 0.0, 50.0));
bodies.push(body_circle(vec2(300.0, 100.0), 0.0, 20.0));
bodies.push(body_circle(vec2(-200.0, -200.0), 0.0, 100.0));

const first_body = bodies[0];
const root = bah_node_new(circle_new(first_body.position, first_body.radius), null, first_body);

for (let i = 1; i < bodies.length; i += 1) {
    bah_node_insert(root, bodies[i]);
}

const pairs: pair_t[] = [];
bah_potential_pairs(root, pairs, 1000);

console.log(pairs);

function update(): void {

}

function bah_render(node: bah_node_t|null): void {
    if (!node || node.body !== null) {
        return;
    }

    d2_stroke(255, 0, 0, 1.0);
    d2_circle2(node.ba.position, node.ba.radius);
    d2_fill(255, 0, 0);
    d2_text(node.ba.position[0], node.ba.position[1], node.id.toString());

    bah_render(node.child0);
    bah_render(node.child1);
}

function render(): void {
    d2_reset_transform();
    d2_clear_color(0, 0, 0);
    d2_center_transform();

    bah_render(root);

    for (const body of bodies) {
        d2_stroke(255, 255, 255, 1.0);
        d2_circle2(body.position, body.radius);
    }

    for (const pair of pairs) {
        d2_stroke(0, 0, 255, 1.0);
        d2_line2(pair.body0.position, pair.body1.position);
    }
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
