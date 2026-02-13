import * as CANNON from 'cannon-es';

let world;

// Collision groups
export const GROUPS = {
    TRACK: 1,
    MARBLE: 2,
    OBSTACLE: 4,
    COLLECTIBLE: 8,
    RAIL: 16
};

export function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -25, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = false;
    world.solver.iterations = 10;  // More iterations = less clipping through floors
    world.defaultContactMaterial.friction = 0.3;
    world.defaultContactMaterial.restitution = 0.3;

    // Track-marble contact — some friction for rolling, some bounce for ramps
    const trackMaterial = new CANNON.Material('track');
    const marbleMaterial = new CANNON.Material('marble');
    const trackMarbleContact = new CANNON.ContactMaterial(trackMaterial, marbleMaterial, {
        friction: 0.3,
        restitution: 0.25
    });
    world.addContactMaterial(trackMarbleContact);

    return { world, trackMaterial, marbleMaterial };
}

export function getWorld() { return world; }

export function stepPhysics(dt) {
    if (world) {
        // Fixed timestep with more sub-steps to prevent tunneling
        world.step(1 / 120, dt, 5);
    }
}
