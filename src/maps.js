// Map definitions. Every map is 180-degree rotationally symmetric so both teams get the same layout.
// Team 0 spawns at +z, team 1 at -z. The control point sits in the middle.

function builder() {
  const boxes = [];
  // B: single box. x,z = centre, w/d = footprint, h = height, c = colour, y = base height
  const B = (x, z, w, d, h, c, y = 0, o = {}) => { boxes.push({ x, y, z, w, h, d, c, ...o }); };
  // S: box plus its mirror through the origin
  const S = (x, z, w, d, h, c, y = 0, o = {}) => { B(x, z, w, d, h, c, y, o); B(-x, -z, w, d, h, c, y, o); };
  // stairs climbing from (x0,z0) in direction (dx,dz); mirrored
  const stairs = (x0, z0, dx, dz, width, n, c, rise = 0.4, run = 0.8) => {
    for (let i = 0; i < n; i++) {
      const cx = x0 + dx * (i + 0.5) * run, cz = z0 + dz * (i + 0.5) * run;
      S(cx, cz, dx ? run : width, dz ? run : width, (i + 1) * rise, c);
    }
  };
  const walls = (size, h, c) => {
    B(0, size + 0.5, size * 2 + 2, 1, h, c); B(0, -size - 0.5, size * 2 + 2, 1, h, c);
    B(size + 0.5, 0, 1, size * 2 + 2, h, c); B(-size - 0.5, 0, 1, size * 2 + 2, h, c);
  };
  return { boxes, B, S, stairs, walls };
}

function spawns(size) {
  const z = size - 3.5;
  return [
    [{ x: -4, z }, { x: 0, z }, { x: 4, z }],
    [{ x: 4, z: -z }, { x: 0, z: -z }, { x: -4, z: -z }],
  ];
}

function theLocal() {
  const { boxes, B, S, stairs, walls } = builder();
  const size = 28;
  const brick = 0x9a4f3c, cream = 0xe8d9b5, red = 0xc8102e, navy = 0x14213d, wood = 0x9c6b3f, stone = 0xb9b2a5, deck = 0x7a5533;
  walls(size, 7, 0x6f3b2e);
  // the block of buildings between each spawn and the square: three ways through
  S(-22.5, 13.5, 11, 5, 5.5, brick); S(-7, 13.5, 8, 5, 5, cream); S(7, 13.5, 8, 5, 6, red); S(22.5, 13.5, 11, 5, 5.5, navy);
  S(7, 10.6, 8, 1.2, 0.15, 0xffffff, 2.8, { ghost: true }); S(-7, 10.6, 8, 1.2, 0.15, navy, 2.8, { ghost: true });
  S(7, 10.95, 3, 0.1, 0.9, 0xffe08a, 3.4, { ghost: true, glow: true }); // "The Local" sign
  S(-22.5, 10.95, 2, 0.1, 1.2, 0xfff2c4, 1.6, { ghost: true, glow: true }); S(22.5, 10.95, 2, 0.1, 1.2, 0xfff2c4, 1.6, { ghost: true, glow: true });
  // fountain on the point
  B(0, 0, 2.4, 2.4, 0.9, stone); B(0, 0, 0.7, 0.7, 2.4, stone); B(0, 0, 1.8, 1.8, 0.1, 0x5cc7e8, 0.9, { ghost: true, glow: true });
  // picnic tables, planters, crates
  S(6.5, 3, 2.4, 1.1, 0.9, wood); S(-6.5, 3, 2.4, 1.1, 0.9, wood);
  S(0, 7.5, 5, 0.9, 1.3, stone); S(0, 7.5, 4.6, 0.6, 0.35, 0x3f8f4a, 1.3, { ghost: true });
  S(13.5, 6, 1.6, 1.6, 1.6, wood); S(-13, 4.5, 1.6, 1.6, 1.6, wood); S(-13, 4.5, 1.2, 1.2, 1.2, 0xb07a45, 1.6);
  // raised patios on both sides of the square
  S(22.5, 0, 9, 10, 2, deck);
  stairs(20, 8.2, 0, -1, 3, 4, wood); stairs(24.5, -8.2, 0, 1, 3, 4, wood);
  S(18.2, 0, 0.3, 6, 0.9, wood, 2);
  S(25, 2, 1.6, 1.6, 0.8, red, 2); // patio table
  // spawn dressing
  S(-10, 22, 3, 1.2, 1, navy); S(10, 21, 1.5, 1.5, 1.5, wood);
  // string-light poles
  S(10, 0, 0.3, 0.3, 5, 0x333333); S(10, 0, 0.5, 0.5, 0.5, 0xffe08a, 5, { ghost: true, glow: true });
  return {
    id: 'local', name: 'The Local', blurb: 'Wing night on the town square. Hold the fountain.',
    size, boxes, ground: 0xa89c8a, sky: 0xf6b67a, fog: [0xf6b67a, 40, 110],
    light: { hemi: [0xffe2bd, 0x6a5a4a, 1.25], sun: [0xffd09a, 1.3, [20, 30, 10]] },
    point: { x: 0, z: 0, r: 5.5 }, spawns: spawns(size), packs: [{ x: 14, z: -1 }, { x: -14, z: 1 }, { x: 0, z: 19 }, { x: 0, z: -19 }],
  };
}

function thriftDepot() {
  const { boxes, B, S, stairs, walls } = builder();
  const size = 26;
  const racks = [0xd96c8a, 0x5aa6c8, 0xe0b040, 0x7fb069, 0xa77bd1, 0xe07a3f];
  const shelf = 0x8d8d95, counter = 0x5b4a3a, mezz = 0x6d7480;
  walls(size, 8, 0xd8cfa8);
  // clothing racks make the lanes out of spawn
  let i = 0;
  for (const x of [4.5, -4.5, 13.5, -13.5, 21, -21]) {
    S(x, 11.5, 1.2, 7, 2.6, shelf);
    S(x, 11.5, 1.5, 6.6, 1.3, racks[i++ % racks.length], 0.9, { ghost: true });
  }
  S(9, 9, 7.8, 1.2, 3, shelf); S(9, 9, 7.4, 1.5, 1.2, racks[4], 1.2, { ghost: true });
  // checkout counters around the point
  S(6, 0, 1.1, 4.5, 1.1, counter); S(0, 6.5, 4.5, 1.1, 1.1, counter);
  S(6, 1.2, 0.6, 0.6, 0.5, 0x222222, 1.1); // till
  B(0, 0, 7, 7, 0.04, 0xb5403a, 0, { ghost: true }); B(0, 0, 5, 5, 0.05, 0xe8c66a, 0, { ghost: true }); // rug
  // mezzanines along the side walls
  S(23, 0, 6, 14, 2.4, mezz);
  stairs(16, 4, 1, 0, 3, 5, shelf); stairs(23.8, 11, 0, -1, 2.6, 5, shelf);
  S(20.2, -2, 0.3, 8, 0.9, shelf, 2.4);
  S(24.5, -4, 2, 3, 0.9, racks[0], 2.4);
  // piles of clothes (walkable), couches and bins
  S(10.5, 3.5, 2.4, 2.4, 0.45, racks[1]); S(-12, 2, 2, 2, 0.5, racks[2]); S(15, -3, 1.8, 1.8, 0.4, racks[3]);
  S(-11, 5.5, 3.2, 1.3, 1, 0x8a5a44); S(-11, 6.1, 3.2, 0.4, 0.7, 0x8a5a44, 1);
  S(14, 17, 1.6, 1.6, 1.4, 0x3d6fb5); S(-8, 19, 1.6, 1.6, 1.4, 0xc94f4f);
  // ceiling lights
  for (const x of [-14, 0, 14]) for (const z of [-14, 0, 14]) B(x, z, 4, 0.6, 0.15, 0xfffbe6, 7.4, { ghost: true, glow: true });
  return {
    id: 'thrift', name: 'Thrift Depot', blurb: 'Everything must go. Fight over the checkout.',
    size, boxes, ground: 0xc9c2b0, sky: 0x3a3a44, fog: [0x3a3a44, 50, 120],
    light: { hemi: [0xfff6e0, 0x8a8478, 1.5], sun: [0xffffff, 0.8, [5, 30, 8]] },
    point: { x: 0, z: 0, r: 5.5 }, spawns: spawns(size), packs: [{ x: -9, z: 12 }, { x: 9, z: -12 }, { x: 15, z: 1.5 }, { x: -15, z: -1.5 }],
  };
}

function serverFarm() {
  const { boxes, B, S, stairs, walls } = builder();
  const size = 28;
  const rackC = 0x1b1d2e, metal = 0x2c3050, cyan = 0x25e6ff, mag = 0xff2bd6, yel = 0xfcee0a;
  walls(size, 8, 0x14152a);
  const rack = (x, z, w, d, glow) => {
    S(x, z, w, d, 3.6, rackC);
    for (const y of [0.8, 1.7, 2.6]) S(x, z, w + 0.08, d + 0.08, 0.1, glow, y, { ghost: true, glow: true });
  };
  // firewall between spawn and the core
  S(-24, 13, 8, 2, 5.5, metal); S(-8, 13, 12, 2, 5.5, metal); S(8, 13, 12, 2, 5.5, metal); S(24, 13, 8, 2, 5.5, metal);
  S(-8, 11.95, 8, 0.1, 0.25, cyan, 3.2, { ghost: true, glow: true }); S(8, 11.95, 8, 0.1, 0.25, mag, 3.2, { ghost: true, glow: true });
  // the core: a low dais with the point on top
  B(0, 0, 13, 13, 0.5, 0x23264a); B(0, 0, 13.2, 13.2, 0.08, cyan, 0.3, { ghost: true, glow: true });
  B(0, 0, 1.6, 1.6, 3, rackC, 0.5); B(0, 0, 1.7, 1.7, 0.15, yel, 2.2, { ghost: true, glow: true });
  // server racks for cover
  rack(8.5, 5, 1.2, 4, cyan); rack(-8.5, 5, 1.2, 4, mag); rack(0, 9, 4, 1.2, yel);
  rack(14, 18, 1.2, 4, mag); rack(-12, 20, 4, 1.2, cyan);
  // side platforms overlooking the core
  S(21.5, 0, 9, 8, 2, metal); S(21.5, 0, 9.1, 8.1, 0.1, mag, 1.7, { ghost: true, glow: true });
  stairs(13.8, 0, 1, 0, 3, 4, metal); stairs(22, 7.2, 0, -1, 3, 4, metal);
  S(17.2, -2.8, 0.3, 2.4, 0.9, metal, 2); S(17.2, 2.8, 0.3, 2.4, 0.9, metal, 2);
  // pillars + signage
  S(0, 19.5, 2.5, 2.5, 6, metal); S(0, 19.5, 2.6, 2.6, 0.15, cyan, 3, { ghost: true, glow: true });
  S(27.9, 14, 0.1, 6, 1.5, yel, 4, { ghost: true, glow: true }); S(-27.9, 6, 0.1, 5, 1.2, cyan, 4.5, { ghost: true, glow: true });
  return {
    id: 'server', name: 'Server Farm', blurb: 'Neon, racks and bad deploys. Capture the core.',
    size, boxes, ground: 0x15162b, sky: 0x080814, fog: [0x080814, 30, 95],
    light: { hemi: [0x9aa6ff, 0x2a1a44, 1.5], sun: [0xff8af0, 0.7, [-10, 30, 6]] },
    point: { x: 0, z: 0, r: 5.5, y: 0.5 }, spawns: spawns(size), packs: [{ x: -15, z: -7 }, { x: 15, z: 7 }, { x: -20, z: 9 }, { x: 20, z: -9 }],
  };
}

export const MAPS = [theLocal(), thriftDepot(), serverFarm()];
