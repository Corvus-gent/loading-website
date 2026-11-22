struct Hall {
  size: vec2f,
  time: f32,
  night: vec3f,
  plum: vec3f,
  light: vec3f,
}
@group(0) @binding(0) var<uniform> hall: Hall;

// A surface-anchored ordered pattern: lighting moves, dots do not shimmer.
fn bayer2(p: vec2u) -> f32 {
  return f32(((p.x ^ p.y) & 1u) * 2u + (p.y & 1u));
}
fn threshold(p: vec2f) -> f32 {
  let cell = vec2u(floor(max(p, vec2f(0.0))));
  return (4.0 * bayer2(cell) + bayer2(cell / 2u) + 0.5) / 16.0;
}
fn water(p: vec2f, t: f32) -> f32 {
  let swell = sin(p.x * 1.9 + p.y * 2.7 - t * 0.32);
  let ripples = sin(p.x * 4.1 - p.y * 3.3 + swell * 1.1 + t * 0.24);
  let detail = sin(p.x * 8.7 + p.y * 7.2 + ripples * 0.6 - t * 0.18);
  return swell * 0.57 + ripples * 0.29 + detail * 0.14;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = hall.time;
  let pixel = uv * hall.size;
  let aspect = hall.size.x / max(hall.size.y, 1.0);
  let surface = (uv - 0.5) * vec2f(aspect, 1.0);
  let height = water(surface, t);
  let normal = normalize(vec3f(
    (height - water(surface + vec2f(0.025, 0.0), t)) * 12.0,
    (height - water(surface + vec2f(0.0, 0.025), t)) * 12.0,
    1.0
  ));
  let light = normalize(vec3f(-0.5, -0.6, 1.0));
  let diffuse = max(0.0, dot(normal, light));
  let crest = pow(diffuse, 9.0);
  let edge = smoothstep(0.0, 0.22, uv.y) * (1.0 - smoothstep(0.65, 1.0, uv.y));
  let brightness = clamp((0.14 + diffuse * 0.42 + crest * 0.38) * edge, 0.0, 1.0);
  // Four tonal levels in the current Corvus palette, never a screen-sized texture.
  let levels = brightness * 3.0;
  let tone = (floor(levels) + step(threshold(pixel / 1.7), fract(levels))) / 3.0;
  let ink = mix(hall.night, hall.plum, 0.12);
  let highlight = mix(hall.plum, hall.light, 0.42);
  return vec4f(mix(ink, highlight, tone * 0.66), 1.0);
}
