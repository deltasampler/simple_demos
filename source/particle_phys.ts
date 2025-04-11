import {gl_init} from "@engine/gl.ts";
import {cam2_compute_proj, cam2_compute_view, cam2_move_right, cam2_move_up, cam2_new, cam2_proj_mouse, cam2_zoom} from "@cl/cam2.ts";
import {io_init, io_kb_key_down, io_key_down, io_m_button_down, io_m_button_up, io_m_move, kb_event_t, m_event_t} from "@engine/io.ts";
import {create_canvas} from "@engine/canvas.ts";
import {circle_rdata_build, circle_rdata_instance, circle_rdata_new, circle_rend_build, circle_rend_init, circle_rend_render} from "@engine/circle_rend.ts";
import {vec4} from "@cl/vec4.ts";
import {vec2, vec2_add1, vec2_add2, vec2_addmuls2, vec2_copy, vec2_dir, vec2_dir1, vec2_dist, vec2_muls1, vec2_set, vec2_sub1, vec2_zero} from "@cl/vec2.ts";
import {rand_in} from "@cl/math.ts";
import {vec2_t} from "@cl/type.ts";
import {mtv_aabb_aabb2, point_inside_aabb, point_inside_capsule, point_inside_circle} from "@cl/collision2.ts";

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

class ball_t {
    position: vec2_t;
    radius: number;
    is_static: boolean;
    drag_pos: vec2_t;
    force: vec2_t;
    acceleration: vec2_t;
    velocity: vec2_t;
    mass: number;
};

const mouse_pos = vec2();
let drag_flag = false;
const drag_pos = vec2();
let drag_ball: ball_t|null = null;
let collision_checks = 0;
const BALL_LIMIT = 4096;
const balls: ball_t[] = [];

function ball_new(position: vec2_t, radius: number) {
    const ball = new ball_t();
    ball.position = position;
    ball.radius = radius;
    ball.is_static = false;
    ball.drag_pos = vec2();
    ball.force = vec2();
    ball.acceleration = vec2();
    ball.velocity = vec2();
    ball.mass = radius;

    return ball;
}

function ball_left(ball: ball_t): number {
    return ball.position[0] - ball.radius;
}

function ball_right(ball: ball_t): number {
    return ball.position[0] + ball.radius;
}

function ball_down(ball: ball_t): number {
    return ball.position[1] - ball.radius;
}

function ball_up(ball: ball_t): number {
    return ball.position[1] + ball.radius;
}

function solve_collision(ball0: ball_t, ball1: ball_t): void {
    const depth = vec2_dist(ball0.position, ball1.position) - (ball0.radius + ball1.radius);
    const dir = vec2_dir1(ball1.position, ball0.position);

    if (depth < 0.0) {
        const mtv = {
            depth,
            dir
        }

        if (ball0.is_static && !ball1.is_static) {
            vec2_add2(ball1.position, vec2_muls1(mtv.dir, -mtv.depth));
        } else if (!ball0.is_static && ball1.is_static) {
            vec2_add2(ball0.position, vec2_muls1(mtv.dir, mtv.depth));
        } else {
            vec2_add2(ball0.position, vec2_muls1(mtv.dir, mtv.depth / 2.0));
            vec2_add2(ball1.position, vec2_muls1(mtv.dir, -mtv.depth / 2.0));
        }
    }
}

export function body_integrate(ball: ball_t, step: number): void {
    vec2_addmuls2(ball.position, ball.velocity, step);

    vec2_copy(ball.acceleration, vec2_muls1(ball.force, 1.0 / ball.mass));

    vec2_addmuls2(ball.velocity, ball.acceleration, step);

    // vec2_muls2(ball.velocity, pow(ball.damping, step));

    vec2_zero(ball.force);
}

function sap(balls: ball_t[]): void {
    const sorted_balls = balls.sort((a, b) => ball_left(a) - ball_left(b));
    collision_checks = 0;

    for (let i = 0; i < sorted_balls.length; i += 1) {
        const ball0 = sorted_balls[i];

        for (let j = i + 1; j < sorted_balls.length; j += 1) {
            const ball1 = sorted_balls[j];

            if (ball_left(ball1) > ball_right(ball0)) {
                break;
            }

            if (ball_down(ball0) < ball_up(ball1) && ball_up(ball0) > ball_down(ball1)) {
                solve_collision(ball0, ball1);
                collision_checks += 1;
            }
        }
    }
}

randomize_balls(balls);

function randomize_balls(balls: ball_t[]) {
    for (const ball of balls) {
        vec2_set(ball.position, rand_in(-64, 64), rand_in(-64, 64));
        ball.radius = rand_in(2, 8);
    }
}

io_init();

const circle_rdata = circle_rdata_new();
circle_rdata_build(circle_rdata, BALL_LIMIT);
circle_rdata.len = balls.length;

circle_rend_init();
circle_rend_build(circle_rdata);

io_m_move(function(event: m_event_t): void {
    vec2_set(mouse_pos, event.x, event.y);
    const point = cam2_proj_mouse(camera, mouse_pos, canvas_el.width, canvas_el.height);

    if (drag_flag && drag_ball) {
        vec2_copy(drag_ball.position, vec2_add1(drag_ball.drag_pos, vec2_sub1(point, drag_pos)));
    }
});

io_m_button_down(function(event: m_event_t): void {
    vec2_set(mouse_pos, event.x, event.y);

    const point = cam2_proj_mouse(camera, mouse_pos, canvas_el.width, canvas_el.height);

    for (const ball of balls) {
        if (point_inside_circle(ball.position, ball.radius, point)) {
            drag_ball = ball;
            break;
        }
    }

    if (drag_ball) {
        drag_flag = true;
        vec2_copy(drag_pos, point);
        vec2_copy(drag_ball.drag_pos, drag_ball.position);
    } else {
        balls.push(ball_new(point, rand_in(1, 4)));
    }
});

io_m_button_up(function(event: m_event_t): void {
    drag_flag = false;
    drag_ball = null;
});

io_kb_key_down(function(event: kb_event_t): void {
    if (event.code === "KeyR") {
        randomize_balls(balls);
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

    for (let i = 0; i < balls.length; i += 1) {
        const ball = balls[i];

        vec2_add2(ball.force, vec2(0, -1.0));
    }

    sap(balls);

    for (let i = 0; i < balls.length; i += 1) {
        body_integrate(balls[i], 0.01);
    }
}

gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.CULL_FACE);


function render(): void {
    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let i = 0; i < balls.length; i += 1) {
        const ball = balls[i];

        circle_rdata_instance(circle_rdata, i, ball.position, ball.radius, 0.0, vec4(170, 170, 170, 255), vec4(255, 255, 255, 255), ball.radius);
    }

    circle_rend_render(circle_rdata, camera);
    circle_rdata.len = balls.length;

    let stats = "";
    stats += `Ball count: ${balls.length}<br>`;
    stats += `Collision Checks Per Frame: ${ collision_checks }`;
    stats_el.innerHTML = stats;
}

function loop(): void {
    update();
    render();

    requestAnimationFrame(loop);
}

loop();
