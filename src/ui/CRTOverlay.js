/**
 * CRTOverlay.js
 * WebGL Post-Processing CRT Pipeline for Retro Arcade Studio:
 *   [ Canvas Framebuffer ]
 *          │
 *          ▼
 *   [ Scanline Overlay Shader ] (15% dark opacity alternate horizontal lines)
 *          │
 *          ▼
 *   [ Barrel Distortion Shader ] (Curvature coefficient: 0.05)
 *          │
 *          ▼
 *   [ Bloom / Chromatic Aberration ] (R/B separation: 1.5px)
 *          │
 *          ▼
 *   [ Final Display Screen ]
 */
export class CRTOverlay {
  constructor(displayCanvas, sourceCanvas) {
    this.displayCanvas = displayCanvas;
    this.sourceCanvas = sourceCanvas;
    this.enabled = true;

    // Exact shader parameters from Section 3 specification
    this.params = {
      scanlineOpacity: 0.15, // 15% dark opacity alternate horizontal lines
      curvature: 0.05,       // Curvature coefficient: 0.05
      aberrationPx: 1.5,     // R/B separation: 1.5px
      bloomIntensity: 0.28   // Neon phosphor bloom pass
    };

    this.gl = null;
    this.program = null;
    this.texture = null;
    this.uniforms = {};
    this.fallbackCtx = null;

    this._initWebGL();
  }

  _initWebGL() {
    if (!this.displayCanvas) return;
    try {
      const gl =
        this.displayCanvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: true
        }) ||
        this.displayCanvas.getContext('experimental-webgl', {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: true
        });

      if (!gl) {
        this._initFallback2D();
        return;
      }

      this.gl = gl;

      const vsSource = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uScanlineOpacity;
        uniform float uCurvature;
        uniform float uAberrationPx;
        uniform float uBloomIntensity;
        uniform float uEnabled;

        // Barrel Distortion Shader (Curvature coefficient: 0.05)
        vec2 barrelDistort(vec2 uv, float k) {
          vec2 centered = uv * 2.0 - 1.0;
          float r2 = dot(centered, centered);
          centered *= 1.0 + k * r2 + (k * 0.5) * r2 * r2;
          return centered * 0.5 + 0.5;
        }

        void main() {
          if (uEnabled < 0.5) {
            gl_FragColor = texture2D(uTexture, vUv);
            return;
          }

          // 1. Apply Barrel Distortion (k = 0.05)
          vec2 uv = barrelDistort(vUv, uCurvature);

          // CRT bezel boundary mask
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.02, 0.03, 0.06, 1.0);
            return;
          }

          // 2. Chromatic Aberration (R/B horizontal separation: 1.5px)
          vec2 shift = vec2(uAberrationPx / uResolution.x, 0.0);
          float r = texture2D(uTexture, clamp(uv + shift, 0.0, 1.0)).r;
          float g = texture2D(uTexture, uv).g;
          float b = texture2D(uTexture, clamp(uv - shift, 0.0, 1.0)).b;
          vec3 color = vec3(r, g, b);

          // 3. Phosphor Bloom Pass (5-tap bright neighborhood glow)
          vec2 texel = 2.0 / uResolution;
          vec3 b1 = texture2D(uTexture, clamp(uv + vec2(texel.x, 0.0), 0.0, 1.0)).rgb;
          vec3 b2 = texture2D(uTexture, clamp(uv - vec2(texel.x, 0.0), 0.0, 1.0)).rgb;
          vec3 b3 = texture2D(uTexture, clamp(uv + vec2(0.0, texel.y), 0.0, 1.0)).rgb;
          vec3 b4 = texture2D(uTexture, clamp(uv - vec2(0.0, texel.y), 0.0, 1.0)).rgb;
          vec3 avgGlow = (b1 + b2 + b3 + b4) * 0.25;
          float luma = dot(avgGlow, vec3(0.299, 0.587, 0.114));
          color += avgGlow * smoothstep(0.25, 0.85, luma) * uBloomIntensity;

          // 4. Scanline Overlay Shader (15% dark opacity alternate horizontal lines)
          float row = floor(uv.y * uResolution.y);
          float isOddLine = mod(row, 2.0);
          float scanlineFactor = 1.0 - (isOddLine * uScanlineOpacity);
          color *= scanlineFactor;

          // 5. Subtle CRT edge vignette
          vec2 edge = uv * (1.0 - uv.yx);
          float vig = clamp(pow(edge.x * edge.y * 16.0, 0.14), 0.78, 1.0);
          color *= vig;

          gl_FragColor = vec4(color, 1.0);
        }
      `;

      const vs = this._compileShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) {
        this._initFallback2D();
        return;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this._initFallback2D();
        return;
      }

      this.program = program;
      gl.useProgram(program);

      // Fullscreen quad
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const aPosition = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      // Create source framebuffer texture
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.texture = tex;

      this.uniforms = {
        uTexture: gl.getUniformLocation(program, 'uTexture'),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uScanlineOpacity: gl.getUniformLocation(program, 'uScanlineOpacity'),
        uCurvature: gl.getUniformLocation(program, 'uCurvature'),
        uAberrationPx: gl.getUniformLocation(program, 'uAberrationPx'),
        uBloomIntensity: gl.getUniformLocation(program, 'uBloomIntensity'),
        uEnabled: gl.getUniformLocation(program, 'uEnabled')
      };
    } catch (_) {
      this._initFallback2D();
    }
  }

  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  _initFallback2D() {
    this.gl = null;
    if (this.displayCanvas) {
      this.fallbackCtx = this.displayCanvas.getContext('2d');
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  render() {
    if (!this.sourceCanvas || !this.displayCanvas) return;

    if (this.gl && this.program && this.texture) {
      const gl = this.gl;
      gl.viewport(0, 0, this.displayCanvas.width, this.displayCanvas.height);
      gl.useProgram(this.program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.sourceCanvas
      );

      gl.uniform1i(this.uniforms.uTexture, 0);
      gl.uniform2f(
        this.uniforms.uResolution,
        this.sourceCanvas.width,
        this.sourceCanvas.height
      );
      gl.uniform1f(this.uniforms.uScanlineOpacity, this.params.scanlineOpacity);
      gl.uniform1f(this.uniforms.uCurvature, this.params.curvature);
      gl.uniform1f(this.uniforms.uAberrationPx, this.params.aberrationPx);
      gl.uniform1f(this.uniforms.uBloomIntensity, this.params.bloomIntensity);
      gl.uniform1f(this.uniforms.uEnabled, this.enabled ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (this.fallbackCtx) {
      this.fallbackCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
      this.fallbackCtx.drawImage(this.sourceCanvas, 0, 0);
      if (this.enabled) {
        this.fallbackCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < this.displayCanvas.height; y += 2) {
          this.fallbackCtx.fillRect(0, y, this.displayCanvas.width, 1);
        }
      }
    }
  }
}

export default CRTOverlay;
