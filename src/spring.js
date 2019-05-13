/** springFactory
 * modified from https://hackernoon.com/the-spring-factory-4c3d988e7129
 *
 * Generate a physically realistic easing curve for a damped mass-spring system.
 *
 * Required:
 *   damping (zeta): [0, 1)
 *   stiffness: 0...inf
 *
 * Optional:
 *   initial_position: -1..1, default 1
 *   initial_velocity: -inf..+inf, default 0
 *
 * Return: f(t), t in 0..1
 */
function springFactory(args) {
    args = args || {};

    var zeta = args.damping,
        k = args.stiffness,
        y0 = nvl(args.initial_position, 1),
        v0 = args.initial_velocity || 0;

    var A = y0;

    var B, omega;

    // If v0 is 0, an analytical solution exists, otherwise,
    // we need to numerically solve it.
    if (Math.abs(v0) < 1e-6) {
        B = zeta * y0 / Math.sqrt(1 - zeta * zeta);
        omega = computeOmega(A, B, k, zeta);
    } else {
        var result = numericallySolveOmegaAndB({
            zeta: zeta,
            k: k,
            y0: y0,
            // Modified from original to add factor PI/2 to keep velocity
            //  self-consistent.
            v0: v0 / Math.PI / 2,
        });

        B = result.B;
        omega = result.omega;
    }

    omega *= 2 * Math.PI;
    var omega_d = omega * Math.sqrt(1 - zeta * zeta);

    return function(t) {
        var sinusoid = A * Math.cos(omega_d * t) + B * Math.sin(omega_d * t);
        return Math.exp(-t * zeta * omega) * sinusoid;
    };
}

function computeOmega(A, B, k, zeta) {

    // Haven't quite figured out why yet, but to ensure same behavior of
    // k when argument of arctangent is negative, need to subtract pi
    // otherwise an extra halfcycle occurs. 
    //
    // It has someting to do with -atan(-x) = atan(x),
    // the range of atan being (-pi/2, pi/2) which is a difference of pi 
    //
    // The other way to look at it is that for every integer k there is a
    // solution and the 0 point for k is arbitrary, we just want it to be
    // equal to the thing that gives us the same number of halfcycles as k.
    if (A * B < 0 && k >= 1) {
        k--;
    }

    return (-Math.atan(A / B) + Math.PI * k) / (2 * Math.PI * Math.sqrt(1 - zeta * zeta));
}


// Resolve recursive definition of omega an B using bisection method
function numericallySolveOmegaAndB(args) {
    args = args || {};

    var zeta = args.zeta,
        k = args.k,
        y0 = nvl(args.y0, 1),
        v0 = args.v0 || 0;

    // See https://en.wikipedia.org/wiki/Damping#Under-damping_.280_.E2.89.A4_.CE.B6_.3C_1.29
    // B and omega are recursively defined in solution. Know omega in terms of B, will numerically
    // solve for B.

    function errorfn(B, omega) {
        var omega_d = omega * Math.sqrt(1 - zeta * zeta);
        return B - ((zeta * omega * y0) + v0) / omega_d;
    }

    var A = y0,
        B = zeta; // initial guess that's pretty close

    var omega, error, direction;

    function step() {
        omega = computeOmega(A, B, k, zeta);
        error = errorfn(B, omega);
        direction = -Math.sign(error);
    }

    step();

    var tolerence = 1e-6;
    var lower, upper;

    var ct = 0,
        maxct = 1e3;

    if (direction > 0) {
        while (direction > 0) {
            ct++;

            if (ct > maxct) {
                break;
            }

            lower = B;

            B *= 2;
            step();
        }

        upper = B;
    } else {
        upper = B;

        B *= -1;

        while (direction < 0) {
            ct++;

            if (ct > maxct) {
                break;
            }

            lower = B;

            B *= 2;
            step();
        }

        lower = B;
    }

    while (Math.abs(error) > tolerence) {
        ct++;

        if (ct > maxct) {
            break;
        }

        B = (upper + lower) / 2;
        step();

        if (direction > 0) {
            lower = B;
        } else {
            upper = B;
        }
    }

    return {
        omega: omega,
        B: B,
    };
}

function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}

function nvl(x, ifnull) {
    return x === undefined || x === null ? ifnull : x;
}

export {
    springFactory,
}
