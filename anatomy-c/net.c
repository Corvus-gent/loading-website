/* The 6 Cube · anatomy · the network grower, in freestanding C → WebAssembly.
 * Grows the children of one node (cells of a lobe, synapses of a cell) and wires each child to its 3 nearest
 * neighbours. Same seeded generator as the JS fallback (mulberry32 variant), so both draw the identical brain. */
#define MAXN 64
static double OUT[MAXN * 5];          /* x, y, r, seed, act per child */
static int EDGES[MAXN * 3 * 2];       /* pairs of child indices */
double *out_ptr(void) { return OUT; }
int *edges_ptr(void) { return EDGES; }

static unsigned int st;
static double rnd(void) {             /* identical to rnd() in the page */
  st += 0x6D2B79F5u; unsigned int t = st;
  t = (t ^ (t >> 15)) * (1u | st);
  t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t;
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}
static double sqrt_(double x) { return __builtin_sqrt(x); }
static double cos_(double x);
static double sin_(double x);

/* returns the number of edges */
int grow(double px, double py, double pr, double seed, int n, double spread, double rr) {
  if (n > MAXN) n = MAXN;
  st = (unsigned int)(long long)seed;
  for (int i = 0; i < n; i++) {
    double a = rnd() * 6.283185307179586, d = sqrt_(rnd()) * pr * spread;
    OUT[i*5] = px + cos_(a) * d; OUT[i*5+1] = py + sin_(a) * d;
    OUT[i*5+2] = pr * rr * (0.6 + rnd() * 0.8); OUT[i*5+3] = seed * 31 + i + 1; OUT[i*5+4] = rnd();
  }
  int m = 0;
  for (int i = 0; i < n; i++) {                 /* 3 nearest by insertion, ties by index like a stable sort */
    int bj[3] = {-1, -1, -1}; double bd[3] = {1e300, 1e300, 1e300};
    for (int j = 0; j < n; j++) { if (j == i) continue;
      double dx = OUT[j*5] - OUT[i*5], dy = OUT[j*5+1] - OUT[i*5+1], dd = dx*dx + dy*dy;
      for (int k = 0; k < 3; k++) if (dd < bd[k]) { for (int q = 2; q > k; q--) { bd[q] = bd[q-1]; bj[q] = bj[q-1]; } bd[k] = dd; bj[k] = j; break; } }
    for (int k = 0; k < 3; k++) if (bj[k] > i) { EDGES[m*2] = i; EDGES[m*2+1] = bj[k]; m++; }
  }
  return m;
}

/* small, accurate sin/cos (range-reduced Taylor) so the module needs no libm */
static double cos_(double x) { return sin_(x + 1.5707963267948966); }
static double sin_(double x) {
  const double P = 6.283185307179586; x -= P * (double)(long long)(x / P); if (x < 0) x += P;
  if (x > 3.141592653589793) return -sin_(x - 3.141592653589793);
  if (x > 1.5707963267948966) x = 3.141592653589793 - x;
  double x2 = x*x, t = x, s = x;
  for (int k = 1; k < 12; k++) { t *= -x2 / ((2*k) * (2*k + 1)); s += t; }
  return s;
}
