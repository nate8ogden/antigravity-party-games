#include "js_bindings.h"
#include "canvas2d.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <ctype.h>

uint32_t g_pad_bits = 0;
double g_now_ms = 0;

typedef struct { uint8_t r, g, b; float a; } Color;

static int hexv(char c) { return c >= '0' && c <= '9' ? c - '0' : (c | 32) >= 'a' && (c | 32) <= 'f' ? (c | 32) - 'a' + 10 : 0; }

static Color parse_color(const char *s) {
  Color c = { 0, 0, 0, 1.0f };
  if (!s) return c;
  while (*s == ' ') s++;
  if (s[0] == '#') {
    size_t n = strlen(s);
    if (n >= 7) {
      c.r = hexv(s[1]) * 16 + hexv(s[2]); c.g = hexv(s[3]) * 16 + hexv(s[4]); c.b = hexv(s[5]) * 16 + hexv(s[6]);
      if (n >= 9) c.a = (hexv(s[7]) * 16 + hexv(s[8])) / 255.0f;
    } else if (n >= 4) {
      c.r = hexv(s[1]) * 17; c.g = hexv(s[2]) * 17; c.b = hexv(s[3]) * 17;
    }
    return c;
  }
  if (s[0] == 'r' && s[1] == 'g' && s[2] == 'b') {
    const char *p = strchr(s, '(');
    if (p) {
      float r = 0, g = 0, b = 0, a = 1;
      int k = sscanf(p + 1, " %f , %f , %f , %f", &r, &g, &b, &a);
      if (k < 3) k = sscanf(p + 1, " %f %f %f / %f", &r, &g, &b, &a);
      c.r = (uint8_t)(r < 0 ? 0 : r > 255 ? 255 : r); c.g = (uint8_t)(g < 0 ? 0 : g > 255 ? 255 : g); c.b = (uint8_t)(b < 0 ? 0 : b > 255 ? 255 : b);
      c.a = k >= 4 ? (a < 0 ? 0 : a > 1 ? 1 : a) : 1.0f;
    }
    return c;
  }
  if (!strcmp(s, "white")) { c.r = c.g = c.b = 255; }
  else if (!strcmp(s, "black")) { }
  else if (!strcmp(s, "transparent")) { c.a = 0; }
  else if (!strcmp(s, "red")) { c.r = 255; }
  else if (!strcmp(s, "green")) { c.g = 128; }
  else if (!strcmp(s, "lime")) { c.g = 255; }
  else if (!strcmp(s, "blue")) { c.b = 255; }
  else if (!strcmp(s, "yellow")) { c.r = 255; c.g = 255; }
  else if (!strcmp(s, "cyan")) { c.g = 255; c.b = 255; }
  else if (!strcmp(s, "magenta")) { c.r = 255; c.b = 255; }
  else if (!strcmp(s, "orange")) { c.r = 255; c.g = 165; }
  else if (!strcmp(s, "gray") || !strcmp(s, "grey")) { c.r = c.g = c.b = 128; }
  return c;
}

#define NUM(i) ({ double _d = 0; if ((i) < argc) JS_ToFloat64(ctx, &_d, argv[(i)]); (float)_d; })

static JSValue fn_save(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_save(); return JS_UNDEFINED; }
static JSValue fn_restore(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_restore(); return JS_UNDEFINED; }
static JSValue fn_translate(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_translate(NUM(0), NUM(1)); return JS_UNDEFINED; }
static JSValue fn_scale(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { float x = NUM(0); cv_scale(x, argc > 1 ? NUM(1) : x); return JS_UNDEFINED; }
static JSValue fn_rotate(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_rotate(NUM(0)); return JS_UNDEFINED; }
static JSValue fn_begin_path(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_begin_path(); return JS_UNDEFINED; }
static JSValue fn_close_path(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_close_path(); return JS_UNDEFINED; }
static JSValue fn_move_to(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_move_to(NUM(0), NUM(1)); return JS_UNDEFINED; }
static JSValue fn_line_to(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_line_to(NUM(0), NUM(1)); return JS_UNDEFINED; }
static JSValue fn_quad_to(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_quad_to(NUM(0), NUM(1), NUM(2), NUM(3)); return JS_UNDEFINED; }
static JSValue fn_bezier_to(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_bezier_to(NUM(0), NUM(1), NUM(2), NUM(3), NUM(4), NUM(5)); return JS_UNDEFINED; }
static JSValue fn_arc(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  int ccw = argc > 5 ? JS_ToBool(ctx, argv[5]) : 0;
  cv_arc(NUM(0), NUM(1), NUM(2), argc > 3 ? NUM(3) : 0, argc > 4 ? NUM(4) : 6.2831853f, ccw); return JS_UNDEFINED;
}
static JSValue fn_ellipse(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  int ccw = argc > 7 ? JS_ToBool(ctx, argv[7]) : 0;
  cv_ellipse(NUM(0), NUM(1), NUM(2), NUM(3), NUM(4), argc > 5 ? NUM(5) : 0, argc > 6 ? NUM(6) : 6.2831853f, ccw); return JS_UNDEFINED;
}
static JSValue fn_rect(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_rect(NUM(0), NUM(1), NUM(2), NUM(3)); return JS_UNDEFINED; }
static JSValue fn_fill(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_fill(); return JS_UNDEFINED; }
static JSValue fn_stroke(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_stroke(); return JS_UNDEFINED; }
static JSValue fn_clip(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_clip(); return JS_UNDEFINED; }
static JSValue fn_fill_rect(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_fill_rect(NUM(0), NUM(1), NUM(2), NUM(3)); return JS_UNDEFINED; }
static JSValue fn_clear_rect(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_clear_rect(NUM(0), NUM(1), NUM(2), NUM(3)); return JS_UNDEFINED; }
static JSValue fn_stroke_rect(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { cv_stroke_rect(NUM(0), NUM(1), NUM(2), NUM(3)); return JS_UNDEFINED; }
static JSValue fn_fill_text(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  if (argc < 3) return JS_UNDEFINED;
  const char *s = JS_ToCString(ctx, argv[0]);
  if (s) { cv_fill_text(s, NUM(1), NUM(2)); JS_FreeCString(ctx, s); }
  return JS_UNDEFINED;
}
static JSValue fn_measure(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  JSValue o = JS_NewObject(ctx); float w = 0;
  if (argc > 0) { const char *s = JS_ToCString(ctx, argv[0]); if (s) { w = cv_measure(s); JS_FreeCString(ctx, s); } }
  JS_SetPropertyStr(ctx, o, "width", JS_NewFloat64(ctx, w));
  return o;
}
static JSValue fn_set_dash(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  float on = 0, period = 0;
  if (argc > 0 && JS_IsArray(ctx, argv[0])) {
    JSValue len = JS_GetPropertyStr(ctx, argv[0], "length"); int32_t n = 0; JS_ToInt32(ctx, &n, len); JS_FreeValue(ctx, len);
    double a = 0, b = 0;
    if (n > 0) { JSValue v = JS_GetPropertyUint32(ctx, argv[0], 0); JS_ToFloat64(ctx, &a, v); JS_FreeValue(ctx, v); b = a; }
    if (n > 1) { JSValue v = JS_GetPropertyUint32(ctx, argv[0], 1); JS_ToFloat64(ctx, &b, v); JS_FreeValue(ctx, v); }
    if (n > 0) { on = (float)a; period = (float)(a + b); }
  }
  cv_set_dash(on, period);
  return JS_UNDEFINED;
}

/* accessors: 0 fillStyle 1 strokeStyle 2 lineWidth 3 globalAlpha 4 font 5 textAlign 6 textBaseline 7 lineCap */
static JSValue stored[8];
static JSValue acc_get(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv, int magic) {
  switch (magic) {
    case 2: return JS_NewFloat64(ctx, cv_get_line_width());
    case 3: return JS_NewFloat64(ctx, cv_get_alpha());
    default: return JS_DupValue(ctx, stored[magic]);
  }
}
static JSValue acc_set(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv, int magic) {
  if (argc < 1) return JS_UNDEFINED;
  JSValueConst v = argv[0];
  switch (magic) {
    case 0: case 1: {
      JS_FreeValue(ctx, stored[magic]); stored[magic] = JS_DupValue(ctx, v);
      if (JS_IsString(v)) {
        const char *s = JS_ToCString(ctx, v);
        Color c = parse_color(s); JS_FreeCString(ctx, s);
        if (magic == 0) cv_set_fill(c.r, c.g, c.b, c.a); else cv_set_stroke(c.r, c.g, c.b, c.a);
      } else if (JS_IsObject(v)) {
        JSValue idv = JS_GetPropertyStr(ctx, v, "id"); int32_t id = -1; JS_ToInt32(ctx, &id, idv); JS_FreeValue(ctx, idv);
        if (magic == 0) cv_set_fill_grad(id); else cv_set_stroke_grad(id);
      }
      break;
    }
    case 2: { double d = 1; JS_ToFloat64(ctx, &d, v); cv_set_line_width((float)d); break; }
    case 3: { double d = 1; JS_ToFloat64(ctx, &d, v); cv_set_alpha((float)d); break; }
    case 4: {
      JS_FreeValue(ctx, stored[4]); stored[4] = JS_DupValue(ctx, v);
      const char *s = JS_ToCString(ctx, v);
      if (s) {
        const char *px = strstr(s, "px"); float size = 10; int bold = strstr(s, "bold") || strstr(s, "700") || strstr(s, "600") || strstr(s, "800") || strstr(s, "900");
        if (px) { const char *q = px; while (q > s && (isdigit((unsigned char)q[-1]) || q[-1] == '.')) q--; size = (float)atof(q); }
        cv_set_font(size, bold); JS_FreeCString(ctx, s);
      }
      break;
    }
    case 5: case 6: case 7: {
      JS_FreeValue(ctx, stored[magic]); stored[magic] = JS_DupValue(ctx, v);
      const char *s = JS_ToCString(ctx, v); int k = 0;
      if (s) {
        if (magic == 5) k = !strcmp(s, "center") ? 1 : (!strcmp(s, "right") || !strcmp(s, "end")) ? 2 : 0;
        else if (magic == 6) k = !strcmp(s, "middle") ? 1 : (!strcmp(s, "top") || !strcmp(s, "hanging")) ? 2 : (!strcmp(s, "bottom") || !strcmp(s, "ideographic")) ? 3 : 0;
        else k = !strcmp(s, "round") ? 1 : 0;
        JS_FreeCString(ctx, s);
      }
      if (magic == 5) cv_set_align(k); else if (magic == 6) cv_set_baseline(k); else cv_set_cap(k);
      break;
    }
  }
  return JS_UNDEFINED;
}

/* host helpers */
static JSValue h_pad(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { return JS_NewInt32(ctx, (int32_t)g_pad_bits); }
static JSValue h_now(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { return JS_NewFloat64(ctx, g_now_ms); }
static JSValue h_new_linear(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { return JS_NewInt32(ctx, cv_new_linear(NUM(0), NUM(1), NUM(2), NUM(3))); }
static JSValue h_new_radial(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) { return JS_NewInt32(ctx, cv_new_radial(NUM(0), NUM(1), NUM(2), NUM(3), NUM(4), NUM(5))); }
static JSValue h_grad_stop(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  int32_t id = 0; JS_ToInt32(ctx, &id, argv[0]);
  const char *s = JS_ToCString(ctx, argv[2]); Color c = parse_color(s); JS_FreeCString(ctx, s);
  cv_grad_stop(id, NUM(1), c.r, c.g, c.b, c.a);
  return JS_UNDEFINED;
}

/* Renderer.drawPixelSprite equivalent: one rect per cell, horizontal runs merged (identical pixels) */
static JSValue h_sprite(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  if (argc < 5 || !JS_IsObject(argv[0])) return JS_UNDEFINED;
  JSValueConst rows = argv[0], palette = argv[4];
  double x = 0, y = 0, scale = 2;
  JS_ToFloat64(ctx, &x, argv[1]); JS_ToFloat64(ctx, &y, argv[2]); JS_ToFloat64(ctx, &scale, argv[3]);
  int flipX = argc > 5 ? JS_ToBool(ctx, argv[5]) : 0, flipY = argc > 6 ? JS_ToBool(ctx, argv[6]) : 0;
  JSValue lenv = JS_GetPropertyStr(ctx, rows, "length"); int32_t h = 0; JS_ToInt32(ctx, &h, lenv); JS_FreeValue(ctx, lenv);
  if (h <= 0) return JS_UNDEFINED;
  int state[256]; Color col[256]; memset(state, 0, sizeof(state));
  float cw = ceilf((float)scale);
  int w = 0;
  for (int r = 0; r < h; r++) {
    JSValue rv = JS_GetPropertyUint32(ctx, rows, r);
    size_t n = 0; const char *row = JS_ToCStringLen(ctx, &n, rv);
    if (r == 0) w = (int)n;
    if (row) {
      int drawR = flipY ? h - 1 - r : r;
      float ry = floorf((float)(y + drawR * scale) + 0.5f);
      int c = 0; int lim = (int)n < w ? (int)n : w;
      while (c < lim) {
        unsigned char ch = (unsigned char)row[c];
        if (ch == '.' || ch == ' ') { c++; continue; }
        if (state[ch] == 0) {
          char key[2] = { (char)ch, 0 };
          JSValue pv = JS_GetPropertyStr(ctx, palette, key);
          if (JS_IsString(pv)) { const char *s = JS_ToCString(ctx, pv); col[ch] = parse_color(s); JS_FreeCString(ctx, s); state[ch] = 2; }
          else state[ch] = 1;
          JS_FreeValue(ctx, pv);
        }
        if (state[ch] != 2) { c++; continue; }
        int run = 1; while (c + run < lim && (unsigned char)row[c + run] == ch) run++;
        int c0 = c, c1 = c + run - 1;
        int d0 = flipX ? w - 1 - c1 : c0, d1 = flipX ? w - 1 - c0 : c1;
        float rx0 = floorf((float)(x + d0 * scale) + 0.5f), rx1 = floorf((float)(x + d1 * scale) + 0.5f) + cw;
        cv_cell_rect(rx0, ry, rx1 - rx0, cw, col[ch].r, col[ch].g, col[ch].b);
        c += run;
      }
      JS_FreeCString(ctx, row);
    }
    JS_FreeValue(ctx, rv);
  }
  return JS_UNDEFINED;
}

static JSValue js_log(JSContext *ctx, JSValueConst t, int argc, JSValueConst *argv) {
  for (int i = 0; i < argc; i++) { const char *s = JS_ToCString(ctx, argv[i]); if (s) { fprintf(stderr, "%s%s", i ? " " : "[js] ", s); JS_FreeCString(ctx, s); } }
  fprintf(stderr, "\n");
  return JS_UNDEFINED;
}

#define DEF(obj, name, fn, n) JS_SetPropertyStr(ctx, obj, name, JS_NewCFunction(ctx, fn, name, n))

void init_js_native(JSContext *ctx) {
  JSValue global = JS_GetGlobalObject(ctx);
  JSValue nc = JS_NewObject(ctx);
  JSValue c2 = JS_NewObject(ctx);
  for (int i = 0; i < 8; i++) stored[i] = JS_UNDEFINED;
  stored[0] = JS_NewString(ctx, "#000000"); stored[1] = JS_NewString(ctx, "#000000");
  stored[4] = JS_NewString(ctx, "10px monospace"); stored[5] = JS_NewString(ctx, "left");
  stored[6] = JS_NewString(ctx, "alphabetic"); stored[7] = JS_NewString(ctx, "butt");

  DEF(c2, "save", fn_save, 0); DEF(c2, "restore", fn_restore, 0);
  DEF(c2, "translate", fn_translate, 2); DEF(c2, "scale", fn_scale, 2); DEF(c2, "rotate", fn_rotate, 1);
  DEF(c2, "beginPath", fn_begin_path, 0); DEF(c2, "closePath", fn_close_path, 0);
  DEF(c2, "moveTo", fn_move_to, 2); DEF(c2, "lineTo", fn_line_to, 2);
  DEF(c2, "quadraticCurveTo", fn_quad_to, 4); DEF(c2, "bezierCurveTo", fn_bezier_to, 6);
  DEF(c2, "arc", fn_arc, 6); DEF(c2, "ellipse", fn_ellipse, 8); DEF(c2, "rect", fn_rect, 4);
  DEF(c2, "fill", fn_fill, 0); DEF(c2, "stroke", fn_stroke, 0); DEF(c2, "clip", fn_clip, 0);
  DEF(c2, "fillRect", fn_fill_rect, 4); DEF(c2, "clearRect", fn_clear_rect, 4); DEF(c2, "strokeRect", fn_stroke_rect, 4);
  DEF(c2, "fillText", fn_fill_text, 3); DEF(c2, "measureText", fn_measure, 1); DEF(c2, "setLineDash", fn_set_dash, 1);

  static const char *names[8] = { "fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "font", "textAlign", "textBaseline", "lineCap" };
  for (int i = 0; i < 8; i++) {
    JSAtom a = JS_NewAtom(ctx, names[i]);
    JSValue g = JS_NewCFunctionMagic(ctx, acc_get, names[i], 0, JS_CFUNC_generic_magic, i);
    JSValue s = JS_NewCFunctionMagic(ctx, acc_set, names[i], 1, JS_CFUNC_generic_magic, i);
    JS_DefinePropertyGetSet(ctx, c2, a, g, s, JS_PROP_C_W_E | JS_PROP_HAS_GET | JS_PROP_HAS_SET);
    JS_FreeAtom(ctx, a);
  }
  JS_SetPropertyStr(ctx, nc, "ctx", c2);
  DEF(nc, "pad", h_pad, 0); DEF(nc, "now", h_now, 0);
  DEF(nc, "newLinear", h_new_linear, 4); DEF(nc, "newRadial", h_new_radial, 6);
  DEF(nc, "gradStop", h_grad_stop, 3); DEF(nc, "sprite", h_sprite, 7);
  JS_SetPropertyStr(ctx, global, "__nc", nc);

  JSValue con = JS_NewObject(ctx);
  DEF(con, "log", js_log, 1); DEF(con, "warn", js_log, 1); DEF(con, "error", js_log, 1); DEF(con, "info", js_log, 1);
  JS_SetPropertyStr(ctx, global, "console", con);
  JS_FreeValue(ctx, global);
}
