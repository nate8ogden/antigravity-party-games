#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../third_party/libretro.h"
#include "../third_party/quickjs/quickjs.h"
#include "canvas2d.h"
#include "js_bindings.h"

static uint32_t video_buffer[FB_W * FB_H];
static uint16_t video_buffer_565[FB_W * FB_H];
static int16_t silence[735 * 2];
static retro_video_refresh_t video_cb;
static retro_audio_sample_batch_t audio_batch_cb;
static retro_input_poll_t input_poll_cb;
static retro_input_state_t input_state_cb;
static retro_environment_t environ_cb;
static retro_log_printf_t log_cb;
static enum retro_pixel_format g_pixel_fmt = RETRO_PIXEL_FORMAT_XRGB8888;

static JSRuntime *rt = NULL;
static JSContext *ctx = NULL;
static JSValue frame_fn = JS_UNDEFINED;
static int failed = 0;
static unsigned long frame_no = 0;
static int g_w = FB_W, g_h = FB_H;

static void read_scale(void) {
  /* optional: put '2' in retro_arcade_scale.txt for half-resolution (480x270) on slow hardware */
  const char *paths[] = { "/recalbox/share/system/retro_arcade_scale.txt", "retro_arcade_scale.txt", NULL };
  for (int i = 0; paths[i]; i++) {
    FILE *f = fopen(paths[i], "r");
    if (!f) continue;
    int v = 1; if (fscanf(f, "%d", &v) == 1 && v == 2) { g_w = FB_W / 2; g_h = FB_H / 2; }
    fclose(f); break;
  }
}

void retro_set_environment(retro_environment_t cb) { environ_cb = cb; }
void retro_set_video_refresh(retro_video_refresh_t cb) { video_cb = cb; }
void retro_set_audio_sample(retro_audio_sample_t cb) { (void)cb; }
void retro_set_audio_sample_batch(retro_audio_sample_batch_t cb) { audio_batch_cb = cb; }
void retro_set_input_poll(retro_input_poll_t cb) { input_poll_cb = cb; }
void retro_set_input_state(retro_input_state_t cb) { input_state_cb = cb; }
unsigned retro_api_version(void) { return RETRO_API_VERSION; }

void retro_get_system_info(struct retro_system_info *info) {
  memset(info, 0, sizeof(*info));
  info->library_name = "Retro Arcade Studio";
  info->library_version = "1.0";
  info->need_fullpath = false;
  info->block_extract = false;
  info->valid_extensions = "arcade";
}

void retro_get_system_av_info(struct retro_system_av_info *info) {
  memset(info, 0, sizeof(*info));
  info->geometry.base_width = g_w;
  info->geometry.base_height = g_h;
  info->geometry.max_width = FB_W;
  info->geometry.max_height = FB_H;
  info->geometry.aspect_ratio = 16.0f / 9.0f;
  info->timing.fps = 60.0;
  info->timing.sample_rate = 44100.0;
}

void retro_set_controller_port_device(unsigned port, unsigned device) { (void)port; (void)device; }

void retro_init(void) {
  struct retro_log_callback lc;
  if (environ_cb && environ_cb(RETRO_ENVIRONMENT_GET_LOG_INTERFACE, &lc)) log_cb = lc.log;
  read_scale();
  cv_init(video_buffer, g_w, g_h);
}

static void report_exception(const char *where) {
  JSValue ex = JS_GetException(ctx);
  const char *err = JS_ToCString(ctx, ex);
  JSValue stack = JS_GetPropertyStr(ctx, ex, "stack");
  const char *st = JS_IsUndefined(stack) ? NULL : JS_ToCString(ctx, stack);
  fprintf(stderr, "[RetroArcadeStudio] %s: %s\n%s\n", where, err ? err : "?", st ? st : "");
  if (st) JS_FreeCString(ctx, st);
  JS_FreeValue(ctx, stack);
  if (err) JS_FreeCString(ctx, err);
  JS_FreeValue(ctx, ex);
}

bool retro_load_game(const struct retro_game_info *game) {
  g_pixel_fmt = RETRO_PIXEL_FORMAT_XRGB8888;
  if (!environ_cb || !environ_cb(RETRO_ENVIRONMENT_SET_PIXEL_FORMAT, &g_pixel_fmt)) {
    g_pixel_fmt = RETRO_PIXEL_FORMAT_RGB565;
    if (!environ_cb(RETRO_ENVIRONMENT_SET_PIXEL_FORMAT, &g_pixel_fmt)) {
      fprintf(stderr, "[RetroArcadeStudio] Failed to set pixel format (tried XRGB8888 & RGB565)\n");
      return false;
    }
  }

  const void *data = game ? game->data : NULL;
  size_t size = game ? game->size : 0;
  char *allocated = NULL;

  if ((!data || size == 0) && game && game->path) {
    FILE *f = fopen(game->path, "rb");
    if (f) {
      fseek(f, 0, SEEK_END);
      size = ftell(f);
      fseek(f, 0, SEEK_SET);
      allocated = (char *)malloc(size + 1);
      if (allocated) {
        if (fread(allocated, 1, size, f) == size) {
          allocated[size] = 0;
          data = allocated;
        } else {
          free(allocated);
          allocated = NULL;
          size = 0;
        }
      }
      fclose(f);
    }
  }

  if (!data || size == 0) {
    fprintf(stderr, "[RetroArcadeStudio] Failed to load game content from memory or disk\n");
    return false;
  }

  rt = JS_NewRuntime();
  if (!rt) { if (allocated) free(allocated); return false; }
  JS_SetMemoryLimit(rt, 96u * 1024u * 1024u);
  JS_SetGCThreshold(rt, 8u * 1024u * 1024u);
  JS_SetMaxStackSize(rt, 1024u * 1024u);
  ctx = JS_NewContext(rt);
  if (!ctx) { if (allocated) free(allocated); return false; }
  init_js_native(ctx);

  char *src = (char *)malloc(size + 1);
  if (!src) { if (allocated) free(allocated); return false; }
  memcpy(src, data, size);
  src[size] = 0;
  if (allocated) free(allocated);

  JSValue r = JS_Eval(ctx, src, size, "game.arcade", JS_EVAL_TYPE_GLOBAL);
  free(src);
  if (JS_IsException(r)) { report_exception("load"); return false; }
  JS_FreeValue(ctx, r);

  JSValue global = JS_GetGlobalObject(ctx);
  frame_fn = JS_GetPropertyStr(ctx, global, "__frame");
  JS_FreeValue(ctx, global);
  if (!JS_IsFunction(ctx, frame_fn)) {
    /* top-level function declarations are global properties; const/let are not */
    JSValue r2 = JS_Eval(ctx, "__frame", 7, "<lookup>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(r2)) { report_exception("lookup __frame"); return false; }
    frame_fn = r2;
  }
  frame_no = 0; failed = 0;
  return JS_IsFunction(ctx, frame_fn);
}

void retro_run(void) {
  if (input_poll_cb) input_poll_cb();
  uint32_t bits = 0;
  if (input_state_cb)
    for (unsigned i = 0; i < 16; i++)
      if (input_state_cb(0, RETRO_DEVICE_JOYPAD, 0, i)) bits |= (1u << i);
  g_pad_bits = bits;
  g_now_ms = (double)frame_no * 1000.0 / 60.0;

  if (ctx && !failed) {
    cv_frame_begin();
    JSValue ret = JS_Call(ctx, frame_fn, JS_UNDEFINED, 0, NULL);
    if (JS_IsException(ret)) { report_exception("frame"); failed = 1; }
    JS_FreeValue(ctx, ret);
    JSContext *c2; while (JS_ExecutePendingJob(rt, &c2) > 0) {}
  }
  frame_no++;

  if (video_cb) {
    if (g_pixel_fmt == RETRO_PIXEL_FORMAT_RGB565) {
      int total = g_w * g_h;
      for (int i = 0; i < total; i++) {
        uint32_t c = video_buffer[i];
        uint16_t r = (c >> 19) & 0x1F;
        uint16_t g = (c >> 10) & 0x3F;
        uint16_t b = (c >> 3) & 0x1F;
        video_buffer_565[i] = (r << 11) | (g << 5) | b;
      }
      video_cb(video_buffer_565, g_w, g_h, g_w * sizeof(uint16_t));
    } else {
      video_cb(video_buffer, g_w, g_h, FB_W * sizeof(uint32_t));
    }
  }
  if (audio_batch_cb) audio_batch_cb(silence, 735);
}

void retro_unload_game(void) {
  if (ctx) {
    JS_FreeValue(ctx, frame_fn); frame_fn = JS_UNDEFINED;
    JS_FreeContext(ctx); ctx = NULL;
  }
  if (rt) { JS_FreeRuntime(rt); rt = NULL; }
}
void retro_deinit(void) {}
void retro_reset(void) {}
unsigned retro_get_region(void) { return RETRO_REGION_NTSC; }
bool retro_load_game_special(unsigned t, const struct retro_game_info *i, size_t n) { (void)t; (void)i; (void)n; return false; }
size_t retro_serialize_size(void) { return 0; }
bool retro_serialize(void *d, size_t s) { (void)d; (void)s; return false; }
bool retro_unserialize(const void *d, size_t s) { (void)d; (void)s; return false; }
void *retro_get_memory_data(unsigned id) { (void)id; return NULL; }
size_t retro_get_memory_size(unsigned id) { (void)id; return 0; }
void retro_cheat_reset(void) {}
void retro_cheat_set(unsigned i, bool e, const char *c) { (void)i; (void)e; (void)c; }
