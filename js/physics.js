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
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    world.solver.iterations = 10;
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0;
    world.defaultContactMaterial.contactEquationStiffness = 1e8;
    world.defaultContactMaterial.contactEquationRelaxation = 3;

    // Track-marble contact — friction for rolling, zero bounce
    const trackMaterial = new CANNON.Material('track');
    const marbleMaterial = new CANNON.Material('marble');
    const trackMarbleContact = new CANNON.ContactMaterial(trackMaterial, marbleMaterial, {
        friction: 0.4,
        restitution: 0,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    });
    world.addContactMaterial(trackMarbleContact);

    return { world, trackMaterial, marbleMaterial };
}

export function getWorld() { return world; }

export function stepPhysics(dt) {
    if (world) {
        world.step(1 / 60, dt, 3);
    }
}
