/* The 6 Cube · optimal solver for scrambles up to 8 moves (half-turn metric), freestanding C → WebAssembly.
 * Meet in the middle: a breadth-first ball of radius 4 around solved (46,741 states), then a depth-first
 * search of up to 4 moves from the scramble into that ball. Shortest total wins, so the answer is optimal
 * for anything ≤ 8 moves; beyond that it says so instead of guessing.
 * State: pos[id] = slot holding sticker id. A move maps every slot to its new slot (table from JS, same as lab.js). */
#define N 54
#define MOVES 18
#define CAP 131072          /* power of two, > 2 × 46,741 */
#define MAXD 4

static unsigned char PERM[MOVES * N];
static unsigned char IO[N];
static unsigned char PATH[16];
static unsigned char keys[CAP][N];
static unsigned char used[CAP], depth[CAP], via[CAP];
static unsigned char queue[60000][N];

unsigned char *perm_ptr(void) { return PERM; }
unsigned char *io_ptr(void) { return IO; }
unsigned char *path_ptr(void) { return PATH; }

static void apply(const unsigned char *s, int m, unsigned char *o) { const unsigned char *p = PERM + m * N; for (int i = 0; i < N; i++) o[i] = p[s[i]]; }
static int inv(int m) { int r = m % 3; return r == 0 ? m + 1 : r == 1 ? m - 1 : m; }
static int same(const unsigned char *a, const unsigned char *b) { for (int i = 0; i < N; i++) if (a[i] != b[i]) return 0; return 1; }
static unsigned int hash(const unsigned char *s) { unsigned int h = 2166136261u; for (int i = 0; i < N; i++) { h ^= s[i]; h *= 16777619u; } return h; }
static int find(const unsigned char *s) { unsigned int h = hash(s) & (CAP - 1); while (used[h]) { if (same(keys[h], s)) return (int)h; h = (h + 1) & (CAP - 1); } return -1 - (int)h; }
static void copy(unsigned char *d, const unsigned char *s) { for (int i = 0; i < N; i++) d[i] = s[i]; }

static int built = 0;
int build(void) {                                  /* returns the ball size */
  if (built) return built;
  unsigned char id[N]; for (int i = 0; i < N; i++) id[i] = (unsigned char)i;
  int slot = -1 - find(id); used[slot] = 1; depth[slot] = 0; via[slot] = 255; copy(keys[slot], id);
  int head = 0, tail = 0, size = 1; copy(queue[tail++], id);
  unsigned char c[N];
  while (head < tail) {
    unsigned char *s = queue[head++]; int d = depth[find(s)]; if (d >= MAXD) continue;
    for (int m = 0; m < MOVES; m++) { apply(s, m, c); int f = find(c);
      if (f < 0) { int k = -1 - f; used[k] = 1; depth[k] = (unsigned char)(d + 1); via[k] = (unsigned char)m; copy(keys[k], c); size++; if (d + 1 < MAXD) copy(queue[tail++], c); } }
  }
  return built = size;
}

/* depth-first from the scramble; best = shortest total found so far */
static unsigned char stack[MAXD + 1][N], seq[MAXD], bestSeq[MAXD], bestTail[MAXD];
static int best, bestLen, bestT;
static void dfs(int d, int limit, int last) {
  int f = find(stack[d]);
  if (f >= 0 && d + depth[f] < best) {
    best = d + depth[f]; bestLen = d; for (int i = 0; i < d; i++) bestSeq[i] = seq[i];
    /* walk the ball back to solved: undo the move that led into each state */
    unsigned char cur[N], nx[N]; copy(cur, stack[d]); bestT = 0;
    while (1) { int g = find(cur); if (depth[g] == 0) break; int m = via[g]; bestTail[bestT++] = (unsigned char)inv(m); apply(cur, inv(m), nx); copy(cur, nx); }
  }
  if (d == limit) return;
  for (int m = 0; m < MOVES; m++) { if (last >= 0 && m / 3 == last / 3) continue; seq[d] = (unsigned char)m; apply(stack[d], m, stack[d + 1]); dfs(d + 1, limit, m); }
}

/* solve the state in IO. returns the number of moves (written to PATH), or -1 if it is more than 8 away */
int solve(void) {
  build(); best = 99; bestLen = 0; bestT = 0; copy(stack[0], IO);
  for (int limit = 0; limit <= MAXD && best > limit; limit++) dfs(0, limit, -1);
  if (best > 2 * MAXD) return -1;
  int n = 0; for (int i = 0; i < bestLen; i++) PATH[n++] = bestSeq[i]; for (int i = 0; i < bestT; i++) PATH[n++] = bestTail[i];
  return n;
}
