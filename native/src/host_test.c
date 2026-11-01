/* Host-side harness: loads a .arcade bundle through the real libretro core entry points,
 * runs N frames with scripted input and writes PPM screenshots + timing. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "../third_party/libretro.h"

static const uint32_t *last_fb; static int fb_w, fb_h; static size_t fb_pitch;
static unsigned long frame;
static int scripted;

static bool env(unsigned cmd, void *data) {
  if (cmd == RETRO_ENVIRONMENT_SET_PIXEL_FORMAT) return true;
  (void)data; return false;
}
static void video(const void *d, unsigned w, unsigned h, size_t p) { last_fb = d; fb_w = w; fb_h = h; fb_pitch = p; }
static void audio1(int16_t l, int16_t r) { (void)l; (void)r; }
static size_t audio(const int16_t *d, size_t n) { (void)d; return n; }
static void poll(void) {}
static int16_t input(unsigned port, unsigned dev, unsigned idx, unsigned id) {
  (void)idx; if (port || dev != RETRO_DEVICE_JOYPAD || !scripted) return 0;
  if (id == RETRO_DEVICE_ID_JOYPAD_RIGHT) return frame % 40 < 20;
  if (id == RETRO_DEVICE_ID_JOYPAD_A) return frame % 25 == 3;
  if (id == RETRO_DEVICE_ID_JOYPAD_START) return frame == 5 || frame == 40;
  return 0;
}

static void write_ppm(const char *path) {
  FILE *f = fopen(path, "wb"); if (!f) return;
  fprintf(f, "P6\n%d %d\n255\n", fb_w, fb_h);
  for (int y = 0; y < fb_h; y++) for (int x = 0; x < fb_w; x++) {
    uint32_t p = last_fb[y * (fb_pitch / 4) + x]; unsigned char c[3] = { (p >> 16) & 255, (p >> 8) & 255, p & 255 };
    fwrite(c, 1, 3, f);
  }
  fclose(f);
}

int main(int argc, char **argv) {
  if (argc < 4) { fprintf(stderr, "usage: host_test game.arcade frames out_prefix [shot_frame...]\n"); return 2; }
  FILE *f = fopen(argv[1], "rb"); if (!f) { perror("open"); return 2; }
  fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
  char *buf = malloc(n); fread(buf, 1, n, f); fclose(f);
  int frames = atoi(argv[2]); scripted = 1;
  retro_set_environment(env); retro_set_video_refresh(video); retro_set_audio_sample(audio1);
  retro_set_audio_sample_batch(audio); retro_set_input_poll(poll); retro_set_input_state(input);
  retro_init();
  struct retro_game_info gi = { argv[1], buf, (size_t)n, NULL };
  if (!retro_load_game(&gi)) { fprintf(stderr, "LOAD FAILED\n"); return 1; }
  struct timespec a, b; double worst = 0, total = 0;
  for (frame = 0; frame < (unsigned long)frames; frame++) {
    clock_gettime(CLOCK_MONOTONIC, &a);
    retro_run();
    clock_gettime(CLOCK_MONOTONIC, &b);
    double ms = (b.tv_sec - a.tv_sec) * 1000.0 + (b.tv_nsec - a.tv_nsec) / 1e6;
    total += ms; if (ms > worst) worst = ms;
    for (int i = 4; i < argc; i++) if ((unsigned long)atoi(argv[i]) == frame) { char p[512]; snprintf(p, sizeof p, "%s_%d.ppm", argv[3], atoi(argv[i])); write_ppm(p); }
  }
  printf("%s: avg %.3f ms/frame, worst %.3f ms\n", argv[1], total / frames, worst);
  retro_unload_game();
  return 0;
}
