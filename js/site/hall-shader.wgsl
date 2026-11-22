struct Hall {
  size: vec2f,
  time: f32,
  night: vec3f,
  plum: vec3f,
  light: vec3f,
}
@group(0) @binding(0) var<uniform> hall: Hall;

fn hash(p: vec2f) -> f32 {
  let v = fract(p * vec2f(123.34, 456.21));
  return fract((v.x + dot(v, v + 45.32)) * v.y);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = hall.time;
  let pixel = uv * hall.size;
  let grid = pixel / 13.0;
  let spread = grid - hall.size / 26.0;
  let wave = sin(length(spread * vec2f(0.44, 1.0)) * 0.57 - t * 0.65);
  let halftone = 1.0 - smoothstep(0.10 + 0.071 * wave, 0.18 + 0.071 * wave, length(fract(grid) - 0.5));

  let lantern = vec2f(0.5 + sin(t * 0.16) * 0.24, 0.44 + cos(t * 0.19) * 0.15);
  let ray = (uv - lantern) * vec2f(3.4, 1.8);
  let glow = 1.0 / (1.0 + 9.0 * dot(ray, ray));
  let moteGrid = (pixel + vec2f(t * 5.0, t * -2.8)) / 42.0;
  let cell = floor(moteGrid);
  let seed = hash(cell);
  let jitter = vec2f(seed, hash(cell + 7.0)) * 0.7 + 0.15;
  let flicker = sin(t * 1.5 + seed * 19.0);
  let grain = (1.0 - smoothstep(0.013, 0.036, distance(fract(moteGrid), jitter)))
    * step(0.69, seed) * (0.43 + 0.57 * flicker * flicker);

  var colour = mix(hall.night, hall.plum, 0.12 + halftone * (0.26 + 0.18 * glow));
  colour = mix(colour, hall.light, glow * 0.30 + grain * (0.23 + glow * 0.33));
  return vec4f(colour, 1.0);
}
