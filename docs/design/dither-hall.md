# Dither in the Corvus hall

Visual reference: Yarik (@ya_demidov), “Sinking into dither / 02”:
https://www.instagram.com/reel/DeRDNmxKdi2/

The Corvus implementation is an original procedural WGSL interpretation: layered water-like normals, ordered four-tone dithering and the active realm palette. No reel media or third-party shader source is copied. The pattern is fixed in the hall's coordinates while illumination moves; this is not a reconstruction of the reference's 3D boat scene or its fractal surface-space algorithm.

The existing hall renderer lazy-loads WebGPU, stops offscreen/when hidden, respects reduced motion and retains the CSS hall on unsupported devices or device loss. Rendering is capped at approximately 30 fps.

Build: `node tools/site/build-hall-shader.mjs` (also part of build-all).
