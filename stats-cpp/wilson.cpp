// The 6 Cube · Monte Carlo confidence in C++ → WebAssembly (freestanding, no std).
// Wilson score interval for a binomial proportion: the honest error bar on "k hits out of n".
namespace {
  double out[3];
  inline double sqrt_(double x) { return __builtin_sqrt(x); }
}
extern "C" {
  double *out_ptr() { return out; }
  // writes [estimate, low, high] for k successes in n trials at z (1.96 = 95%)
  void wilson(double k, double n, double z) {
    if (n <= 0) { out[0] = out[1] = out[2] = 0; return; }
    const double p = k / n, z2 = z * z, den = 1 + z2 / n;
    const double centre = (p + z2 / (2 * n)) / den;
    const double half = z * sqrt_(p * (1 - p) / n + z2 / (4 * n * n)) / den;
    out[0] = p; out[1] = centre - half < 0 ? 0 : centre - half; out[2] = centre + half > 1 ? 1 : centre + half;
  }
}
