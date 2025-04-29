import {vec2, vec2n_add, vec2_copy, vec2n_dir, vec2_dist, vec2_dist_sq, vec2n_divs, vec2n_muls, vec2_t, vec2m_add, vec2m_addmuls} from "@cl/math/vec2.ts";
import {vec2_len_sq} from "@cl/math/vec2.ts";
import {hypot, sqrt} from "@cl/math/math.ts";
import {closest_point_convex2, closest_point_obb, point_inside_convex2, point_inside_obb, mtv_sat, compute_axes} from "@cl/collision/collision2.ts";

export function center_vertices(vertices: vec2_t[]): vec2_t[] {
    let cx = 0.0, cy = 0.0, area = 0.0;

    for (let i = 0; i < vertices.length; i++) {
        const curr = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
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

    for (let i = 0; i < vertices.length; i++) {
        const point = vertices[i];
        point[0] -= cx;
        point[1] -= cy;
    }

    return vertices;
}

export function polygon_radius(vertices: vec2_t[]): number {
    let longest = 0.0;

    for (let i = 0; i < vertices.length; i++) {
        const point = vertices[i];
        const l = vec2_len_sq(point);

        if (!longest || l > longest) {
            longest = l;
        }
    }

    return sqrt(longest);
}

export function polygon_size(vertices: vec2_t[]): vec2_t[] {
    let min_x = vertices[0][0], max_x = vertices[0][0];
    let min_y = vertices[0][1], max_y = vertices[0][1];

    for (const v of vertices) {
        if (v[0] < min_x) min_x = v[0];
        if (v[0] > max_x) max_x = v[0];
        if (v[1] < min_y) min_y = v[1];
        if (v[1] > max_y) max_y = v[1];
    }

    return [vec2(min_x, min_y), vec2(max_x, max_y)];
}

export enum BODY_TYPE {
    CIRCLE,
    BOX,
    POLYGON
};

export class body_t {
    position: vec2_t;
    rotation: number;
    radius: number;
    min: vec2_t;
    max: vec2_t;
    vertices: vec2_t[];
    type: BODY_TYPE;

    mass: number;
    acceleration: vec2_t;
    acceleration_last: vec2_t;
    accelaration_average: vec2_t;
    velocity: vec2_t;
    intertia_moment: number;
    angular_acceleration: number;
    angular_acceleration_last: number;
    angular_acceleration_average: number;
    angular_velocity: number;
    is_static: boolean;

    constructor() {
        this.mass = 1.0;
        this.acceleration = vec2();
        this.acceleration_last = vec2();
        this.accelaration_average = vec2();
        this.velocity = vec2();
        this.intertia_moment = 1.0;
        this.angular_acceleration = 0.0;
        this.angular_acceleration_last = 0.0;
        this.angular_acceleration_average = 0.0;
        this.angular_velocity = 0.0;
        this.is_static = false;
    }

    update(force: vec2_t, time_step: number): void {
        if (this.is_static) {
            return;
        }

        vec2_copy(this.acceleration_last, this.acceleration);

        vec2m_add(this.position, vec2n_muls(this.velocity, time_step));
        vec2m_add(this.position, vec2n_muls(this.acceleration_last, time_step * time_step * 0.5));

        vec2_copy(this.acceleration, vec2n_divs(force, this.mass));

        vec2_copy(this.accelaration_average, vec2n_divs(vec2n_add(this.acceleration_last, this.acceleration), 2.0));

        vec2m_add(this.velocity, vec2n_muls(this.accelaration_average, time_step));
    }

    update_angular(torque: number, time_step: number): void {
        this.angular_acceleration_last = this.angular_acceleration;

        this.rotation += this.angular_velocity * time_step + this.angular_acceleration_last * (time_step * time_step * 0.5);

        this.angular_acceleration = torque / this.intertia_moment;

        this.angular_acceleration_average = (this.angular_acceleration_last + this.angular_acceleration) / 2.0;

        this.angular_velocity += this.angular_acceleration_average * time_step;
    }


    get size(): vec2_t {
        return vec2(Math.abs(this.max[0] - this.min[0]), Math.abs(this.max[1] - this.min[1]));
    }
};

export function body_circle(position: vec2_t, rotation: number, radius: number) {
    const body = new body_t();
    body.position = position;
    body.rotation = rotation;
    body.radius = radius;
    body.min = vec2(-radius);
    body.max = vec2(radius);
    body.vertices = [];
    body.type = BODY_TYPE.CIRCLE;

    return body;
}

export function body_box(position: vec2_t, rotation: number, size: vec2_t) {
    const body = new body_t();
    body.position = position;
    body.rotation = rotation;
    body.radius = hypot(size[0] / 2.0, size[1] / 2.0);
    body.min = vec2n_divs(size, -2.0);
    body.max = vec2n_divs(size, 2.0);
    body.vertices = [];
    body.type = BODY_TYPE.BOX;

    return body;
}

export function body_polygon(position: vec2_t, rotation: number, vertices: vec2_t[]) {
    const body = new body_t();
    body.position = position;
    body.rotation = rotation;
    body.vertices = center_vertices(vertices);
    body.radius = polygon_radius(body.vertices);

    const size = polygon_size(body.vertices);
    body.min = size[0];
    body.max = size[1];

    body.type = BODY_TYPE.POLYGON;

    return body;
}

class pair_t {
    body_a: body_t;
    body_b: body_t;
};

export function overlap_circle_circle(p0: vec2_t, r0: number, p1: vec2_t, r1: number): boolean {
    return vec2_dist_sq(p0, p1) <= (r0 + r1) * (r0 + r1);
}

export function broad_phase_naive(bodies: body_t[]): pair_t[] {
    const pairs: pair_t[] = [];

    for (const body_a of bodies) {
        for (const body_b of bodies) {
            if (body_a !== body_b) {
                if (overlap_circle_circle(body_a.position, body_a.radius, body_b.position, body_b.radius)) {
                    const pair = new pair_t();
                    pair.body_a = body_a;
                    pair.body_b = body_b;
                    pairs.push(pair);
                }
            }
        }
    }

    return pairs;
}

export function narrow_phase(pairs: pair_t[]): void {
    for (const pair of pairs) {
        const body_a = pair.body_a;
        const body_b = pair.body_b;

        if (body_a.type === BODY_TYPE.CIRCLE && body_b.type === BODY_TYPE.CIRCLE) {
            const depth = body_a.radius + body_b.radius - vec2_dist(body_a.position, body_b.position);
            const dir = vec2n_dir(body_a.position, body_b.position);

            if (!body_a.is_static) {
                vec2m_addmuls(body_a.position, dir, depth / 2.0);
            }

            if (!body_b.is_static) {
                vec2m_addmuls(body_b.position, dir, -depth / 2.0);
            }
        }

        if (body_a.type === BODY_TYPE.CIRCLE && body_b.type === BODY_TYPE.BOX) {
            const cp = closest_point_obb(body_b.position, body_b.size, body_b.rotation, body_a.position);
            const is_inside = point_inside_obb(body_b.position, body_b.size, body_b.rotation, body_a.position);
            const sign = is_inside ? -1.0 : 1.0;
            const distance_to_cp = vec2_dist(body_a.position, cp) * sign;
            const depth = body_a.radius - distance_to_cp;
            const dir = vec2n_dir(body_a.position, cp);

            if (distance_to_cp < body_a.radius) {
                if (!body_a.is_static) {
                    vec2m_addmuls(body_a.position, dir, depth / 2.0 * sign);
                }

                if (!body_b.is_static) {
                    vec2m_addmuls(body_b.position, dir, -depth / 2.0 * sign);
                }
            }
        }

        if (body_a.type === BODY_TYPE.CIRCLE && body_b.type === BODY_TYPE.POLYGON) {
            const cp = closest_point_convex2(body_b.vertices, body_b.position, body_b.rotation, body_a.position);
            const is_inside = point_inside_convex2(body_b.vertices, body_b.position, body_b.rotation, body_a.position);
            const sign = is_inside ? -1.0 : 1.0;
            const distance_to_cp = vec2_dist(body_a.position, cp) * sign;
            const depth = body_a.radius - distance_to_cp;
            const dir = vec2n_dir(body_a.position, cp);

            if (distance_to_cp < body_a.radius) {
                if (!body_a.is_static) {
                    vec2m_addmuls(body_a.position, dir, depth / 2.0 * sign);
                }

                if (!body_b.is_static) {
                    vec2m_addmuls(body_b.position, dir, -depth / 2.0 * sign);
                }
            }
        }

        if (body_a.type === BODY_TYPE.BOX && body_b.type === BODY_TYPE.BOX) {
            const vertices1 = [vec2(body_a.min[0], body_a.max[1]), body_a.max, vec2(body_a.max[0], body_a.min[1]), body_a.min];
            const vertices2 = [vec2(body_b.min[0], body_b.max[1]), body_b.max, vec2(body_b.max[0], body_b.min[1]), body_b.min];
            const axes1 = compute_axes(vertices1);
            const axes2 = compute_axes(vertices2);
            const result = mtv_sat(vertices1, axes1, body_a.position, body_a.rotation, vertices2, axes2, body_b.position, body_b.rotation);

            if (result) {
                if (!body_a.is_static) {
                    vec2m_addmuls(body_a.position, result.dir, -result.depth / 2.0);
                }

                if (!body_b.is_static) {
                    vec2m_addmuls(body_b.position, result.dir, result.depth / 2.0);
                }
            }
        }

        if (body_a.type === BODY_TYPE.POLYGON && body_b.type === BODY_TYPE.POLYGON) {
            const axes1 = compute_axes(body_a.vertices);
            const axes2 = compute_axes(body_b.vertices);
            const result = mtv_sat(body_a.vertices, axes1, body_a.position, body_a.rotation, body_b.vertices, axes2, body_b.position, body_b.rotation);

            if (result) {
                if (!body_a.is_static) {
                    vec2m_addmuls(body_a.position, result.dir, -result.depth / 2.0);
                }

                if (!body_b.is_static) {
                    vec2m_addmuls(body_b.position, result.dir, result.depth / 2.0);
                }
            }
        }

        if (body_a.type === BODY_TYPE.POLYGON && body_b.type === BODY_TYPE.BOX) {
            const vertices = [vec2(body_b.min[0], body_b.max[1]), body_b.max, vec2(body_b.max[0], body_b.min[1]), body_b.min];
            const axes1 = compute_axes(body_a.vertices);
            const axes2 = compute_axes(vertices);
            const result = mtv_sat(body_a.vertices, axes1, body_a.position, body_a.rotation, vertices, axes2, body_b.position, body_b.rotation);

            if (result) {
                if (!body_a.is_static) {
                    vec2m_addmuls(body_a.position, result.dir, -result.depth / 2.0);
                }

                if (!body_b.is_static) {
                    vec2m_addmuls(body_b.position, result.dir, result.depth / 2.0);
                }
            }
        }
    }
}
