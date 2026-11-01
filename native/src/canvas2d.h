#ifndef CANVAS2D_H
#define CANVAS2D_H
#include <stdint.h>

#define FB_W 960
#define FB_H 540

void cv_init(uint32_t *fb, int w, int h);
void cv_frame_begin(void);
void cv_clear(uint8_t r, uint8_t g, uint8_t b);

void cv_save(void);
void cv_restore(void);
void cv_translate(float x, float y);
void cv_scale(float x, float y);
void cv_rotate(float a);

void cv_begin_path(void);
void cv_close_path(void);
void cv_move_to(float x, float y);
void cv_line_to(float x, float y);
void cv_quad_to(float cx, float cy, float x, float y);
void cv_bezier_to(float c1x, float c1y, float c2x, float c2y, float x, float y);
void cv_arc(float x, float y, float r, float a0, float a1, int ccw);
void cv_ellipse(float x, float y, float rx, float ry, float rot, float a0, float a1, int ccw);
void cv_rect(float x, float y, float w, float h);
void cv_fill(void);
void cv_stroke(void);
void cv_clip(void);

void cv_fill_rect(float x, float y, float w, float h);
void cv_clear_rect(float x, float y, float w, float h);
void cv_stroke_rect(float x, float y, float w, float h);
void cv_fill_text(const char *utf8, float x, float y);
float cv_measure(const char *utf8);

void cv_set_fill(uint8_t r, uint8_t g, uint8_t b, float a);
void cv_set_stroke(uint8_t r, uint8_t g, uint8_t b, float a);
void cv_set_fill_grad(int id);
void cv_set_stroke_grad(int id);
void cv_set_line_width(float w);
float cv_get_line_width(void);
void cv_set_alpha(float a);
float cv_get_alpha(void);
void cv_set_font(float size, int bold);
void cv_set_align(int a);
void cv_set_baseline(int b);
void cv_set_dash(float on, float period);
void cv_set_cap(int c);

int cv_new_linear(float x0, float y0, float x1, float y1);
int cv_new_radial(float x0, float y0, float r0, float x1, float y1, float r1);
void cv_grad_stop(int id, float off, uint8_t r, uint8_t g, uint8_t b, float a);

/* Renderer.drawPixelSprite equivalent: one filled rect per cell */
void cv_cell_rect(float x, float y, float w, float h, uint8_t r, uint8_t g, uint8_t b);

#endif
