#include "canvas2d.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>

#define STB_TRUETYPE_IMPLEMENTATION
#define STBTT_STATIC
#include "../third_party/stb_truetype.h"
#include "font_data.h"

#define MAXPTS 16384
#define MAXSUB 1024
#define MAXGRAD 64
#define TWO_PI 6.28318530717958647692f

typedef struct { float x, y; } Pt;
typedef struct { float x0, y0, x1, y1; int dir; } Edge;

typedef struct {
  int type; /* 0 linear 1 radial */
  float x0, y0, x1, y1, r0, r1, dx, dy, len2;
  int n; float off[8]; uint8_t sc[8][4];
  uint32_t lut[256]; int lut_ok; int rowconst;
} Grad;

typedef struct {
  int mode; /* 0 solid, 1 gradient */
  int r, g, b; int a256; /* solid color & alpha 0..256 */
  int gid; int galpha256;
} Paint;

typedef struct {
  float m[6];
  int fr, fg, fb; float fa; int fgrad;
  int sr, sg, sb; float sa; int sgrad;
  float lw, alpha, fsize; int bold, align, base;
  float dash_on, dash_period;
  int cap;
  int cx0, cy0, cx1, cy1;
} St;

static uint32_t *FB;
static int g_w = FB_W, g_h = FB_H;
static float g_base = 1.0f;
static St cur, stack[64];
static int sp = 0;

static Pt pts[MAXPTS];
static int subs[MAXSUB + 1], sub_closed[MAXSUB];
static int nsub = 0, npts = 0, sub_open = 0;
static float start_x, start_y;

static Grad grads[MAXGRAD];
static int grad_n = 0;

static Edge edges[MAXPTS + MAXSUB];
static uint16_t acc[FB_W + 4];

static stbtt_fontinfo font;
static int font_ok = 0;

void cv_init(uint32_t *fb, int w, int h) {
  FB = fb; g_w = w; g_h = h; g_base = (float)w / FB_W;
  memset(&cur, 0, sizeof(cur));
  cur.m[0] = g_base; cur.m[3] = g_base;
  cur.fr = cur.fg = cur.fb = 0; cur.fa = 1; cur.fgrad = -1;
  cur.sr = cur.sg = cur.sb = 0; cur.sa = 1; cur.sgrad = -1;
  cur.lw = 1; cur.alpha = 1; cur.fsize = 10; cur.bold = 0;
  cur.cx0 = 0; cur.cy0 = 0; cur.cx1 = g_w; cur.cy1 = g_h;
  sp = 0; nsub = 0; npts = 0; sub_open = 0;
  if (!font_ok) font_ok = stbtt_InitFont(&font, font_ttf, stbtt_GetFontOffsetForIndex(font_ttf, 0));
}

void cv_frame_begin(void) {
  grad_n = 0; sp = 0;
  memset(cur.m, 0, sizeof(cur.m)); cur.m[0] = g_base; cur.m[3] = g_base;
  cur.alpha = 1; cur.cx0 = 0; cur.cy0 = 0; cur.cx1 = g_w; cur.cy1 = g_h;
}

void cv_clear(uint8_t r, uint8_t g, uint8_t b) {
  uint32_t c = ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
  for (int y = 0; y < g_h; y++) for (int x = 0; x < g_w; x++) FB[y * FB_W + x] = c;
}

/* ---------- state ---------- */
void cv_save(void) { if (sp < 63) stack[sp++] = cur; }
void cv_restore(void) { if (sp > 0) cur = stack[--sp]; }
void cv_translate(float x, float y) {
  cur.m[4] += cur.m[0] * x + cur.m[2] * y;
  cur.m[5] += cur.m[1] * x + cur.m[3] * y;
}
void cv_scale(float x, float y) {
  cur.m[0] *= x; cur.m[1] *= x; cur.m[2] *= y; cur.m[3] *= y;
}
void cv_rotate(float a) {
  float c = cosf(a), s = sinf(a);
  float a0 = cur.m[0], b0 = cur.m[1], c0 = cur.m[2], d0 = cur.m[3];
  cur.m[0] = a0 * c + c0 * s; cur.m[1] = b0 * c + d0 * s;
  cur.m[2] = -a0 * s + c0 * c; cur.m[3] = -b0 * s + d0 * c;
}
void cv_set_fill(uint8_t r, uint8_t g, uint8_t b, float a) { cur.fr = r; cur.fg = g; cur.fb = b; cur.fa = a; cur.fgrad = -1; }
void cv_set_stroke(uint8_t r, uint8_t g, uint8_t b, float a) { cur.sr = r; cur.sg = g; cur.sb = b; cur.sa = a; cur.sgrad = -1; }
void cv_set_fill_grad(int id) { cur.fgrad = (id >= 0 && id < MAXGRAD) ? id : -1; }
void cv_set_stroke_grad(int id) { cur.sgrad = (id >= 0 && id < MAXGRAD) ? id : -1; }
void cv_set_line_width(float w) { if (w > 0) cur.lw = w; }
float cv_get_line_width(void) { return cur.lw; }
void cv_set_alpha(float a) { if (a >= 0 && a <= 1) cur.alpha = a; }
float cv_get_alpha(void) { return cur.alpha; }
void cv_set_font(float size, int bold) { cur.fsize = size; cur.bold = bold; }
void cv_set_align(int a) { cur.align = a; }
void cv_set_baseline(int b) { cur.base = b; }
void cv_set_dash(float on, float period) { cur.dash_on = on; cur.dash_period = period; }
void cv_set_cap(int c) { cur.cap = c; }

static inline float xf(float x, float y) { return cur.m[0] * x + cur.m[2] * y + cur.m[4]; }
static inline float yf(float x, float y) { return cur.m[1] * x + cur.m[3] * y + cur.m[5]; }
static float mscale(void) { return sqrtf(fabsf(cur.m[0] * cur.m[3] - cur.m[1] * cur.m[2])); }

/* ---------- gradients ---------- */
int cv_new_linear(float x0, float y0, float x1, float y1) {
  if (grad_n >= MAXGRAD) grad_n = 0;
  Grad *g = &grads[grad_n]; memset(g, 0, sizeof(*g));
  g->type = 0;
  g->x0 = xf(x0, y0); g->y0 = yf(x0, y0); g->x1 = xf(x1, y1); g->y1 = yf(x1, y1);
  g->dx = g->x1 - g->x0; g->dy = g->y1 - g->y0; g->len2 = g->dx * g->dx + g->dy * g->dy;
  if (g->len2 < 1e-6f) g->len2 = 1e-6f;
  g->rowconst = fabsf(g->dx) < 1e-4f;
  return grad_n++;
}
int cv_new_radial(float x0, float y0, float r0, float x1, float y1, float r1) {
  if (grad_n >= MAXGRAD) grad_n = 0;
  Grad *g = &grads[grad_n]; memset(g, 0, sizeof(*g));
  float s = mscale();
  g->type = 1; g->x0 = xf(x0, y0); g->y0 = yf(x0, y0);
  g->x1 = xf(x1, y1); g->y1 = yf(x1, y1); g->r0 = r0 * s; g->r1 = r1 * s;
  if (g->r1 - g->r0 < 1e-4f) g->r1 = g->r0 + 1e-4f;
  return grad_n++;
}
void cv_grad_stop(int id, float off, uint8_t r, uint8_t g, uint8_t b, float a) {
  if (id < 0 || id >= MAXGRAD) return;
  Grad *gr = &grads[id];
  if (gr->n >= 8) return;
  gr->off[gr->n] = off; gr->sc[gr->n][0] = r; gr->sc[gr->n][1] = g; gr->sc[gr->n][2] = b;
  gr->sc[gr->n][3] = (uint8_t)(a * 255.0f + 0.5f); gr->n++; gr->lut_ok = 0;
}
static void build_lut(Grad *g) {
  for (int i = 0; i < 256; i++) {
    float t = i / 255.0f; int a = 0, r = 0, gg = 0, b = 0;
    if (g->n == 0) { a = 0; }
    else if (t <= g->off[0]) { r = g->sc[0][0]; gg = g->sc[0][1]; b = g->sc[0][2]; a = g->sc[0][3]; }
    else if (t >= g->off[g->n - 1]) { int k = g->n - 1; r = g->sc[k][0]; gg = g->sc[k][1]; b = g->sc[k][2]; a = g->sc[k][3]; }
    else {
      for (int k = 0; k < g->n - 1; k++) {
        if (t >= g->off[k] && t <= g->off[k + 1]) {
          float span = g->off[k + 1] - g->off[k]; float u = span > 1e-6f ? (t - g->off[k]) / span : 0;
          r = (int)(g->sc[k][0] + (g->sc[k + 1][0] - g->sc[k][0]) * u);
          gg = (int)(g->sc[k][1] + (g->sc[k + 1][1] - g->sc[k][1]) * u);
          b = (int)(g->sc[k][2] + (g->sc[k + 1][2] - g->sc[k][2]) * u);
          a = (int)(g->sc[k][3] + (g->sc[k + 1][3] - g->sc[k][3]) * u);
          break;
        }
      }
    }
    g->lut[i] = ((uint32_t)a << 24) | ((uint32_t)r << 16) | ((uint32_t)gg << 8) | (uint32_t)b;
  }
  g->lut_ok = 1;
}
static inline uint32_t grad_at(Grad *g, float px, float py) {
  float t;
  if (g->type == 0) t = ((px - g->x0) * g->dx + (py - g->y0) * g->dy) / g->len2;
  else { float dx = px - g->x1, dy = py - g->y1; t = (sqrtf(dx * dx + dy * dy) - g->r0) / (g->r1 - g->r0); }
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return g->lut[(int)(t * 255.0f + 0.5f)];
}

/* ---------- paint ---------- */
static Paint make_fill_paint(void) {
  Paint p; memset(&p, 0, sizeof(p));
  if (cur.fgrad >= 0 && grads[cur.fgrad].n > 0) {
    p.mode = 1; p.gid = cur.fgrad; p.galpha256 = (int)(cur.alpha * 256.0f + 0.5f);
    if (!grads[p.gid].lut_ok) build_lut(&grads[p.gid]);
  } else { p.r = cur.fr; p.g = cur.fg; p.b = cur.fb; p.a256 = (int)(cur.fa * cur.alpha * 256.0f + 0.5f); }
  return p;
}
static Paint make_stroke_paint(float extra) {
  Paint p; memset(&p, 0, sizeof(p));
  if (cur.sgrad >= 0 && grads[cur.sgrad].n > 0) {
    p.mode = 1; p.gid = cur.sgrad; p.galpha256 = (int)(cur.alpha * extra * 256.0f + 0.5f);
    if (!grads[p.gid].lut_ok) build_lut(&grads[p.gid]);
  } else { p.r = cur.sr; p.g = cur.sg; p.b = cur.sb; p.a256 = (int)(cur.sa * cur.alpha * extra * 256.0f + 0.5f); }
  return p;
}
/* per-row prepare: vertical linear gradients are constant along the row */
static inline void prep_row(Paint *p, int y) {
  if (p->mode == 1 && grads[p->gid].rowconst) {
    uint32_t c = grad_at(&grads[p->gid], 0, y + 0.5f);
    int a = (int)((((c >> 24) & 255) * p->galpha256 * 257 + 32768) >> 16);
    p->r = (c >> 16) & 255; p->g = (c >> 8) & 255; p->b = c & 255; p->a256 = a;
    p->mode = 2; /* solid-from-gradient */
  }
}
static inline void blend(uint32_t *d, int r, int g, int b, int a) {
  if (a >= 256) { *d = ((uint32_t)r << 16) | ((uint32_t)g << 8) | (uint32_t)b; return; }
  if (a <= 0) return;
  uint32_t o = *d; int dr = (o >> 16) & 255, dg = (o >> 8) & 255, db = o & 255;
  dr += ((r - dr) * a) >> 8; dg += ((g - dg) * a) >> 8; db += ((b - db) * a) >> 8;
  *d = ((uint32_t)dr << 16) | ((uint32_t)dg << 8) | (uint32_t)db;
}
static inline void paint_px(const Paint *p, int x, int y, int cov256) {
  uint32_t *d = &FB[y * FB_W + x];
  if (p->mode == 1) {
    uint32_t c = grad_at(&grads[p->gid], x + 0.5f, y + 0.5f);
    int a = (int)((((c >> 24) & 255) * p->galpha256 * 257 + 32768) >> 16);
    a = (a * cov256) >> 8;
    blend(d, (c >> 16) & 255, (c >> 8) & 255, c & 255, a);
  } else {
    blend(d, p->r, p->g, p->b, (p->a256 * cov256) >> 8);
  }
}
/* horizontal span with fractional end coverage, in float x */
static void span(int y, float xa, float xb, float cov, const Paint *p) {
  if (y < cur.cy0 || y >= cur.cy1 || xb <= xa) return;
  if (xa < cur.cx0) xa = (float)cur.cx0;
  if (xb > cur.cx1) xb = (float)cur.cx1;
  if (xb <= xa) return;
  int ix0 = (int)floorf(xa), ix1 = (int)floorf(xb);
  int c256 = (int)(cov * 256.0f + 0.5f);
  if (ix0 == ix1) { paint_px(p, ix0, y, (int)((xb - xa) * c256)); return; }
  int lcov = (int)((ix0 + 1 - xa) * c256);
  if (lcov > 0) paint_px(p, ix0, y, lcov);
  int xs = ix0 + 1, xe = ix1;
  if (xe > xs) {
    if (p->mode != 1 && (p->a256 * c256 >> 8) >= 256) {
      uint32_t col = ((uint32_t)p->r << 16) | ((uint32_t)p->g << 8) | (uint32_t)p->b;
      uint32_t *row = &FB[y * FB_W];
      for (int x = xs; x < xe; x++) row[x] = col;
    } else if (p->mode != 1) {
      int a = (p->a256 * c256) >> 8;
      uint32_t *row = &FB[y * FB_W];
      for (int x = xs; x < xe; x++) blend(&row[x], p->r, p->g, p->b, a);
    } else {
      for (int x = xs; x < xe; x++) paint_px(p, x, y, c256);
    }
  }
  int rcov = (int)((xb - ix1) * c256);
  if (rcov > 0 && ix1 < cur.cx1) paint_px(p, ix1, y, rcov);
}

/* ---------- path ---------- */
void cv_begin_path(void) { nsub = 0; npts = 0; sub_open = 0; }
static void ensure_sub(float dx, float dy) {
  if (!sub_open && nsub < MAXSUB && npts < MAXPTS) {
    subs[nsub] = npts; sub_closed[nsub] = 0; nsub++; sub_open = 1;
    pts[npts].x = dx; pts[npts].y = dy; npts++;
  }
}
void cv_move_to(float x, float y) {
  float dx = xf(x, y), dy = yf(x, y);
  start_x = dx; start_y = dy; sub_open = 0;
  ensure_sub(dx, dy);
}
static void add_dev(float dx, float dy) {
  if (!sub_open) { ensure_sub(dx, dy); return; }
  if (npts < MAXPTS) { pts[npts].x = dx; pts[npts].y = dy; npts++; }
}
void cv_line_to(float x, float y) {
  float dx = xf(x, y), dy = yf(x, y);
  if (!sub_open) { start_x = dx; start_y = dy; }
  add_dev(dx, dy);
}
void cv_close_path(void) {
  if (sub_open && nsub > 0) { sub_closed[nsub - 1] = 1; sub_open = 0; }
}
void cv_quad_to(float cx, float cy, float x, float y) {
  if (!sub_open) { cv_move_to(cx, cy); }
  float p0x = pts[npts - 1].x, p0y = pts[npts - 1].y;
  float c1x = xf(cx, cy), c1y = yf(cx, cy), p2x = xf(x, y), p2y = yf(x, y);
  for (int i = 1; i <= 8; i++) {
    float t = i / 8.0f, u = 1 - t;
    add_dev(u * u * p0x + 2 * u * t * c1x + t * t * p2x, u * u * p0y + 2 * u * t * c1y + t * t * p2y);
  }
}
void cv_bezier_to(float c1x, float c1y, float c2x, float c2y, float x, float y) {
  if (!sub_open) { cv_move_to(c1x, c1y); }
  float p0x = pts[npts - 1].x, p0y = pts[npts - 1].y;
  float a1x = xf(c1x, c1y), a1y = yf(c1x, c1y), a2x = xf(c2x, c2y), a2y = yf(c2x, c2y), p3x = xf(x, y), p3y = yf(x, y);
  for (int i = 1; i <= 10; i++) {
    float t = i / 10.0f, u = 1 - t;
    float b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    add_dev(b0 * p0x + b1 * a1x + b2 * a2x + b3 * p3x, b0 * p0y + b1 * a1y + b2 * a2y + b3 * p3y);
  }
}
void cv_ellipse(float x, float y, float rx, float ry, float rot, float a0, float a1, int ccw) {
  if (!ccw) { if (a1 < a0) a1 += TWO_PI * ceilf((a0 - a1) / TWO_PI); if (a1 - a0 > TWO_PI) a1 = a0 + TWO_PI; }
  else { if (a1 > a0) a1 -= TWO_PI * ceilf((a1 - a0) / TWO_PI); if (a0 - a1 > TWO_PI) a1 = a0 - TWO_PI; }
  float sweep = fabsf(a1 - a0);
  float rr = (rx > ry ? rx : ry) * mscale();
  float full = rr * 1.2f + 8.0f; if (full < 12) full = 12; if (full > 120) full = 120;
  int n = (int)ceilf(sweep / TWO_PI * full); if (n < 2) n = 2;
  float cr = cosf(rot), sr = sinf(rot);
  for (int i = 0; i <= n; i++) {
    float t = a0 + (a1 - a0) * ((float)i / n);
    float ex = rx * cosf(t), ey = ry * sinf(t);
    float ux = x + ex * cr - ey * sr, uy = y + ex * sr + ey * cr;
    if (i == 0) cv_line_to(ux, uy); else add_dev(xf(ux, uy), yf(ux, uy));
  }
}
void cv_arc(float x, float y, float r, float a0, float a1, int ccw) { cv_ellipse(x, y, r, r, 0, a0, a1, ccw); }
void cv_rect(float x, float y, float w, float h) {
  cv_move_to(x, y); cv_line_to(x + w, y); cv_line_to(x + w, y + h); cv_line_to(x, y + h); cv_close_path();
}

/* ---------- scanline polygon fill ---------- */
static int edge_cmp(const void *a, const void *b) {
  float d = ((const Edge *)a)->y0 - ((const Edge *)b)->y0;
  return d < 0 ? -1 : d > 0 ? 1 : 0;
}
static void fill_polys(const Pt *P, const int *S, int ns, int total, const Paint *pp) {
  int ne = 0; float miny = 1e9f, maxy = -1e9f;
  for (int s = 0; s < ns; s++) {
    int a = S[s], b = (s + 1 < ns) ? S[s + 1] : total;
    if (b - a < 2) continue;
    for (int i = a; i < b; i++) {
      const Pt *p0 = &P[i], *p1 = &P[(i + 1 < b) ? i + 1 : a];
      if (p0->y == p1->y) continue;
      Edge *e = &edges[ne++];
      if (p0->y < p1->y) { e->x0 = p0->x; e->y0 = p0->y; e->x1 = p1->x; e->y1 = p1->y; e->dir = 1; }
      else { e->x0 = p1->x; e->y0 = p1->y; e->x1 = p0->x; e->y1 = p0->y; e->dir = -1; }
      if (e->y0 < miny) miny = e->y0;
      if (e->y1 > maxy) maxy = e->y1;
    }
  }
  if (ne == 0) return;
  qsort(edges, ne, sizeof(Edge), edge_cmp);
  int y0 = (int)floorf(miny), y1 = (int)ceilf(maxy);
  if (y0 < cur.cy0) y0 = cur.cy0;
  if (y1 > cur.cy1) y1 = cur.cy1;
  int aa = (y1 - y0) <= 48; /* vertical 2x supersampling for small shapes */
  int nextE = 0, nact = 0;
  static int act[MAXPTS + MAXSUB];
  static float xs[512]; static int ds[512];
  /* skip edges that end before y0 */
  for (int y = y0; y < y1; y++) {
    Paint p = *pp; prep_row(&p, y);
    int nsamp = aa ? 2 : 1;
    int minx = FB_W, maxx = -1;
    for (int sS = 0; sS < nsamp; sS++) {
      float yc = y + (aa ? (sS + 0.5f) * 0.5f : 0.5f);
      while (nextE < ne && edges[nextE].y0 <= yc) act[nact++] = nextE++;
      int k = 0, nx = 0;
      for (int i = 0; i < nact; i++) {
        Edge *e = &edges[act[i]];
        if (e->y1 <= yc) continue;
        act[k++] = act[i];
        if (nx < 512) {
          float t = (yc - e->y0) / (e->y1 - e->y0);
          float x = e->x0 + (e->x1 - e->x0) * t;
          int j = nx++;
          while (j > 0 && xs[j - 1] > x) { xs[j] = xs[j - 1]; ds[j] = ds[j - 1]; j--; }
          xs[j] = x; ds[j] = e->dir;
        }
      }
      nact = k;
      int wind = 0;
      for (int i = 0; i + 1 < nx; i++) {
        wind += ds[i];
        if (wind != 0) {
          float xa = xs[i], xb = xs[i + 1];
          if (!aa) span(y, xa, xb, 1.0f, &p);
          else {
            if (xa < cur.cx0) xa = (float)cur.cx0;
            if (xb > cur.cx1) xb = (float)cur.cx1;
            if (xb <= xa) continue;
            int ix0 = (int)floorf(xa), ix1 = (int)floorf(xb);
            if (ix0 < minx) minx = ix0;
            if (ix1 > maxx) maxx = ix1;
            if (ix0 == ix1) { acc[ix0] += (uint16_t)((xb - xa) * 128.0f); }
            else {
              acc[ix0] += (uint16_t)((ix0 + 1 - xa) * 128.0f);
              for (int x = ix0 + 1; x < ix1; x++) acc[x] += 128;
              if (ix1 < cur.cx1) acc[ix1] += (uint16_t)((xb - ix1) * 128.0f);
            }
          }
        }
      }
    }
    if (aa && maxx >= minx && y >= cur.cy0 && y < cur.cy1) {
      if (maxx >= cur.cx1) maxx = cur.cx1 - 1;
      for (int x = minx; x <= maxx; x++) {
        int a = acc[x]; acc[x] = 0;
        if (a > 0) paint_px(&p, x, y, a > 256 ? 256 : a);
      }
    }
  }
}

void cv_fill(void) {
  if (nsub == 0) return;
  Paint p = make_fill_paint();
  int starts[MAXSUB + 1];
  for (int i = 0; i < nsub; i++) starts[i] = subs[i];
  fill_polys(pts, starts, nsub, npts, &p);
}

/* ---------- stroke ---------- */
static Pt spts[MAXPTS];
static int sstart[MAXSUB * 2];
static int s_n, s_subs;

static void add_quad(float ax, float ay, float bx, float by, float hw) {
  float dx = bx - ax, dy = by - ay, len = sqrtf(dx * dx + dy * dy);
  if (len < 1e-4f || s_n + 4 > MAXPTS || s_subs >= MAXSUB * 2) return;
  float nx = -dy / len * hw, ny = dx / len * hw;
  sstart[s_subs++] = s_n;
  spts[s_n++] = (Pt){ ax + nx, ay + ny }; spts[s_n++] = (Pt){ bx + nx, by + ny };
  spts[s_n++] = (Pt){ bx - nx, by - ny }; spts[s_n++] = (Pt){ ax - nx, ay - ny };
}
static void add_disc(float cx, float cy, float r) {
  int n = (int)(r * 2.0f) + 8; if (n > 20) n = 20;
  if (s_n + n > MAXPTS || s_subs >= MAXSUB * 2) return;
  sstart[s_subs++] = s_n;
  for (int i = 0; i < n; i++) { float a = -TWO_PI * i / n; spts[s_n++] = (Pt){ cx + cosf(a) * r, cy + sinf(a) * r }; }
}
static void add_seg_dashed(float ax, float ay, float bx, float by, float hw, float on, float period, float *phase) {
  float dx = bx - ax, dy = by - ay, len = sqrtf(dx * dx + dy * dy);
  if (len < 1e-4f) return;
  float ux = dx / len, uy = dy / len, pos = 0;
  while (pos < len) {
    float ph = fmodf(*phase, period);
    float step, drawing = ph < on;
    step = drawing ? (on - ph) : (period - ph);
    if (step > len - pos) step = len - pos;
    if (step < 1e-4f) step = 1e-4f;
    if (drawing) add_quad(ax + ux * pos, ay + uy * pos, ax + ux * (pos + step), ay + uy * (pos + step), hw);
    pos += step; *phase += step;
  }
}

void cv_stroke(void) {
  if (nsub == 0) return;
  float s = mscale();
  float lw = cur.lw * s, extra = 1.0f;
  if (lw < 1.0f) { extra = lw; lw = 1.0f; }
  float hw = lw * 0.5f;
  s_n = 0; s_subs = 0;
  float dash_on = cur.dash_on * s, dash_period = cur.dash_period * s;
  for (int i = 0; i < nsub; i++) {
    int a = subs[i], b = (i + 1 < nsub) ? subs[i + 1] : npts;
    if (b - a < 1) continue;
    float phase = 0;
    int cnt = b - a;
    for (int k = a; k + 1 < b; k++) {
      if (dash_period > 0.5f && dash_on > 0) add_seg_dashed(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, hw, dash_on, dash_period, &phase);
      else add_quad(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, hw);
    }
    if (sub_closed[i] && cnt > 2) add_quad(pts[b - 1].x, pts[b - 1].y, pts[a].x, pts[a].y, hw);
    if (lw >= 3.0f) {
      for (int k = a + 1; k < b - 1; k++) add_disc(pts[k].x, pts[k].y, hw);
      if (sub_closed[i] && cnt > 2) { add_disc(pts[a].x, pts[a].y, hw); add_disc(pts[b - 1].x, pts[b - 1].y, hw); }
      else if (cur.cap == 1) { add_disc(pts[a].x, pts[a].y, hw); add_disc(pts[b - 1].x, pts[b - 1].y, hw); }
    }
  }
  if (s_subs == 0) return;
  Paint p = make_stroke_paint(extra);
  fill_polys(spts, sstart, s_subs, s_n, &p);
}

void cv_clip(void) {
  if (npts == 0) return;
  float minx = 1e9f, miny = 1e9f, maxx = -1e9f, maxy = -1e9f;
  for (int i = 0; i < npts; i++) {
    if (pts[i].x < minx) minx = pts[i].x; if (pts[i].x > maxx) maxx = pts[i].x;
    if (pts[i].y < miny) miny = pts[i].y; if (pts[i].y > maxy) maxy = pts[i].y;
  }
  int x0 = (int)floorf(minx), y0 = (int)floorf(miny), x1 = (int)ceilf(maxx), y1 = (int)ceilf(maxy);
  if (x0 > cur.cx0) cur.cx0 = x0; if (y0 > cur.cy0) cur.cy0 = y0;
  if (x1 < cur.cx1) cur.cx1 = x1; if (y1 < cur.cy1) cur.cy1 = y1;
  if (cur.cx1 < cur.cx0) cur.cx1 = cur.cx0; if (cur.cy1 < cur.cy0) cur.cy1 = cur.cy0;
}

/* ---------- rects ---------- */
static void fill_rect_p(float x, float y, float w, float h, const Paint *pp) {
  if (cur.m[1] != 0 || cur.m[2] != 0) {
    Pt q[4] = { { xf(x, y), yf(x, y) }, { xf(x + w, y), yf(x + w, y) }, { xf(x + w, y + h), yf(x + w, y + h) }, { xf(x, y + h), yf(x, y + h) } };
    int st[1] = { 0 };
    fill_polys(q, st, 1, 4, pp);
    return;
  }
  float x0 = xf(x, y), x1 = xf(x + w, y + h), y0 = yf(x, y), y1 = yf(x + w, y + h);
  if (x1 < x0) { float t = x0; x0 = x1; x1 = t; }
  if (y1 < y0) { float t = y0; y0 = y1; y1 = t; }
  if (x1 <= cur.cx0 || x0 >= cur.cx1 || y1 <= cur.cy0 || y0 >= cur.cy1) return;
  int ya = (int)floorf(y0), yb = (int)ceilf(y1);
  if (ya < cur.cy0) ya = cur.cy0;
  if (yb > cur.cy1) yb = cur.cy1;
  for (int yy = ya; yy < yb; yy++) {
    float top = yy > y0 ? (float)yy : y0, bot = (yy + 1) < y1 ? (float)(yy + 1) : y1;
    float cov = bot - top;
    if (cov <= 0) continue;
    Paint p = *pp; prep_row(&p, yy);
    span(yy, x0, x1, cov, &p);
  }
}
void cv_fill_rect(float x, float y, float w, float h) { Paint p = make_fill_paint(); fill_rect_p(x, y, w, h, &p); }
void cv_cell_rect(float x, float y, float w, float h, uint8_t r, uint8_t g, uint8_t b) {
  Paint p; memset(&p, 0, sizeof(p)); p.r = r; p.g = g; p.b = b; p.a256 = (int)(cur.alpha * 256.0f + 0.5f);
  fill_rect_p(x, y, w, h, &p);
}
void cv_clear_rect(float x, float y, float w, float h) {
  Paint p; memset(&p, 0, sizeof(p)); p.r = 11; p.g = 15; p.b = 25; p.a256 = 256;
  fill_rect_p(x, y, w, h, &p);
}
void cv_stroke_rect(float x, float y, float w, float h) {
  float lw = cur.lw, ex = 1.0f;
  float s = mscale();
  if (lw * s < 1.0f) { ex = lw * s; lw = 1.0f / s; }
  Paint p = make_stroke_paint(ex);
  float hw = lw * 0.5f;
  fill_rect_p(x - hw, y - hw, w + lw, lw, &p);
  fill_rect_p(x - hw, y + h - hw, w + lw, lw, &p);
  fill_rect_p(x - hw, y + hw, lw, h - lw, &p);
  fill_rect_p(x + w - hw, y + hw, lw, h - lw, &p);
}

/* ---------- text ---------- */
typedef struct { int key; unsigned char *bmp; int w, h, xo, yo; float adv; } Glyph;
static Glyph gcache[2048];

static Glyph *get_glyph(int cp, float px) {
  int key = (cp << 12) | ((int)(px * 8.0f) & 4095);
  if (key == 0) key = 1;
  unsigned idx = ((unsigned)key * 2654435761u) >> 21;
  for (int probe = 0; probe < 2048; probe++, idx = (idx + 1) & 2047) {
    Glyph *g = &gcache[idx];
    if (g->key == key) return g;
    if (g->key == 0) {
      float sc = stbtt_ScaleForMappingEmToPixels(&font, px);
      int adv, lsb; stbtt_GetCodepointHMetrics(&font, cp, &adv, &lsb);
      g->key = key; g->adv = adv * sc; g->bmp = NULL; g->w = g->h = 0;
      if (stbtt_FindGlyphIndex(&font, cp) != 0)
        g->bmp = stbtt_GetCodepointBitmap(&font, sc, sc, cp, &g->w, &g->h, &g->xo, &g->yo);
      return g;
    }
  }
  return NULL;
}
static int utf8_next(const unsigned char **s) {
  const unsigned char *p = *s; int c = *p++;
  if (c < 0x80) { *s = p; return c; }
  int n = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : 1;
  int cp = c & (0x3F >> n);
  while (n-- > 0 && (*p & 0xC0) == 0x80) cp = (cp << 6) | (*p++ & 0x3F);
  *s = p; return cp;
}
float cv_measure(const char *t) {
  if (!font_ok) return 0;
  float px = cur.fsize; float w = 0;
  const unsigned char *s = (const unsigned char *)t;
  while (*s) { int cp = utf8_next(&s); Glyph *g = get_glyph(cp, px); if (g) w += g->adv; }
  return w;
}
void cv_fill_text(const char *t, float x, float y) {
  if (!font_ok) return;
  float s = mscale(); float px = cur.fsize * s;
  if (px < 3) return;
  float total = 0;
  { const unsigned char *q = (const unsigned char *)t; while (*q) { int cp = utf8_next(&q); Glyph *g = get_glyph(cp, px); if (g) total += g->adv; } }
  float X = xf(x, y), Y = yf(x, y);
  if (cur.align == 1) X -= total * 0.5f; else if (cur.align == 2) X -= total;
  int asc, desc, gap; stbtt_GetFontVMetrics(&font, &asc, &desc, &gap);
  float sc = stbtt_ScaleForMappingEmToPixels(&font, px);
  if (cur.base == 1) Y += (asc + desc) * 0.5f * sc; else if (cur.base == 2) Y += asc * sc; else if (cur.base == 3) Y += desc * sc;
  Paint p = make_fill_paint();
  if (p.mode == 1) { /* gradient text: sample mid-point colour */
    uint32_t c = grad_at(&grads[p.gid], X, Y);
    p.mode = 0; p.r = (c >> 16) & 255; p.g = (c >> 8) & 255; p.b = c & 255; p.a256 = (int)((((c >> 24) & 255) * p.galpha256 * 257 + 32768) >> 16);
  }
  const unsigned char *q = (const unsigned char *)t; float pen = 0;
  while (*q) {
    int cp = utf8_next(&q); Glyph *g = get_glyph(cp, px);
    if (!g) continue;
    if (g->bmp) {
      int gx = (int)floorf(X + pen + 0.5f) + g->xo, gy = (int)floorf(Y + 0.5f) + g->yo;
      for (int j = 0; j < g->h; j++) {
        int yy = gy + j; if (yy < cur.cy0 || yy >= cur.cy1) continue;
        for (int i = 0; i < g->w; i++) {
          int xx = gx + i; if (xx < cur.cx0 || xx >= cur.cx1) continue;
          int cv = g->bmp[j * g->w + i]; if (!cv) continue;
          blend(&FB[yy * FB_W + xx], p.r, p.g, p.b, (p.a256 * (cv + (cv >> 7))) >> 8);
        }
      }
    }
    pen += g->adv;
  }
}
