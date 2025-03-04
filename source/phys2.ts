import {vec2_t, vec3_t} from "@cl/type.ts";
import {cl_vec2, cl_vec2_add, cl_vec2_add2, cl_vec2_copy, cl_vec2_div_s, cl_vec2_div_s2, cl_vec2_mul_s} from "@cl/vec2.ts";
import {cl_vec3} from "@cl/vec3.ts";
import {d2_center_transform, d2_circle2, d2_circle_angle2, d2_clear_color, d2_init, d2_reset_transform, d2_stroke_vec} from "@engine/d2.ts";

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

const d2 = d2_init(canvas_el);

class body_t {
    mass: number;
    acceleration: vec2_t;
    acceleration_last: vec2_t;
    accelaration_average: vec2_t;
    velocity: vec2_t;
    position: vec2_t;
    intertia_moment: number;
    angular_acceleration: number;
    angular_acceleration_last: number;
    angular_acceleration_average: number;
    angular_velocity: number;
    angle: number;
    diameter: number;

    constructor() {
        this.mass = 1.0;
        this.acceleration = cl_vec2();
        this.acceleration_last = cl_vec2();
        this.accelaration_average = cl_vec2();
        this.velocity = cl_vec2();
        this.position = cl_vec2();

        this.intertia_moment = 1.0;
        this.angular_acceleration = 0.0;
        this.angular_acceleration_last = 0.0;
        this.angular_acceleration_average = 0.0;
        this.angular_velocity = 0.0;
        this.angle = 0.0;

        this.diameter = 0.0;
    }

    update(force: vec2_t, time_step: number): void {
        cl_vec2_copy(this.acceleration_last, this.acceleration);

        cl_vec2_add2(this.position, cl_vec2_mul_s(this.velocity, time_step));
        cl_vec2_add2(this.position, cl_vec2_mul_s(this.acceleration_last, time_step * time_step * 0.5));

        cl_vec2_copy(this.acceleration, cl_vec2_div_s(force, this.mass));

        cl_vec2_copy(this.accelaration_average, cl_vec2_div_s2(cl_vec2_add(this.acceleration_last, this.acceleration), 2.0));

        cl_vec2_add2(this.velocity, cl_vec2_mul_s(this.accelaration_average, time_step));
    }

    update_angular(torque: number, time_step: number): void {
        this.angular_acceleration_last = this.angular_acceleration;

        this.angle += this.angular_velocity * time_step + this.angular_acceleration_last * (time_step * time_step * 0.5);

        this.angular_acceleration = torque / this.intertia_moment;

        this.angular_acceleration_average = (this.angular_acceleration_last + this.angular_acceleration) / 2.0;

        this.angular_velocity += this.angular_acceleration_average * time_step;
    }

    render(color: vec3_t): void {}
};

class circle_t extends body_t {
    constructor(position: vec2_t, diameter: number, mass: number) {
        super();
        this.position = position;
        this.diameter = diameter;
        this.mass = mass;
    }

    render(color: vec3_t): void {
        d2_stroke_vec(color, 1.0);
        d2_circle2(this.position, this.diameter / 2.0);
        d2_circle_angle2(this.position, this.diameter / 2.0, this.angle);
    }
};

const bodies: body_t[] = [];

bodies.push(new circle_t(cl_vec2(0.0), 100.0, 1.0));

let time = 0;
let time_last = 0;
let time_delta = 0;

let force = 0.0;

addEventListener("mousedown", function() {
    force = 100.0;
});

addEventListener("mouseup", function() {
    force = 0.0;
});

function update(): void {
    for (const body of bodies) {
        body.update(cl_vec2(0.0, -100.0), time_delta);
        body.update_angular(force, time_delta);
        body.angular_velocity *= 0.99;

        const height = -300.0;

        if (body.position[1] + body.diameter / 2.0 < height && body.velocity[1] < 0.0) {
            body.velocity[1] *= -0.9;
            body.position[1] = height - body.diameter / 2.0;
        }
    }
}

function render(): void {
    d2_reset_transform();
    d2_clear_color(0.0, 0.0, 0.0);
    d2_center_transform();

    for (const body of bodies) {
        body.render(cl_vec3(255.0, 0.0, 0.0));
    }
}

function loop(): void {
    time_last = time;
    time = performance.now();
    time_delta = (time - time_last) / 1000.0;

    update();

    render();

    requestAnimationFrame(loop);
}

loop();
