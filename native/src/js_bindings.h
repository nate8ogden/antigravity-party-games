#ifndef JS_BINDINGS_H
#define JS_BINDINGS_H
#include <stdint.h>
#include "../third_party/quickjs/quickjs.h"

extern uint32_t g_pad_bits;
extern double g_now_ms;
void init_js_native(JSContext *ctx);

#endif
