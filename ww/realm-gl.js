// realm-gl.js: the WebGL upgrade of the wyattworldwide.com world (one fragment shader, no libraries).
// Loaded by realm.js only on capable devices, after first paint. It draws the same world as the 2D canvas
// (void sky, slit sun on the horizon, a glowing grid floor you move across) with real glow, fog and depth.
// realm.js hands it: the canvas to replace, a state object it keeps updating (z, horizon, sun radius), and a done callback.
window.__realmGL = (old, state, ready) => {
  const c = document.createElement('canvas');
  c.className = 'realm'; c.setAttribute('aria-hidden', 'true');
  const gl = c.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return false;
  const vs = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const fs = `#version 300 es
  precision highp float;
  uniform vec2 R; uniform float Z, H, S, T;
  out vec4 o;
  vec3 night = vec3(.012,.004,.05), cyan = vec3(0.,.9,1.), mag = vec3(1.,.17,.84), gold = vec3(1.,.82,.25), vio = vec3(.55,.12,1.);
  void main(){
    vec2 f = gl_FragCoord.xy; f.y = R.y - f.y;           // y down, like the page
    float hy = H, cx = R.x * .5;
    vec3 col;
    if (f.y < hy) {                                       // sky + sun
      float t = f.y / hy;
      col = mix(night, vec3(.04,.02,.14), t);
      float sy = hy - S * .15;
      float d = length(f - vec2(cx, sy));
      float k = (f.y - (sy - S)) / (S * 1.2);              // 0 at the top of the sun .. 1 at the horizon
      vec3 sun = mix(gold, mix(mag, vio, smoothstep(.55, 1., k)), smoothstep(0., .55, k));
      float band = f.y > hy - S * .52 ? step(.72, fract((f.y - (hy - S * .52)) / (S * .11))) : 0.;  // the slits
      float inside = smoothstep(S, S - 1.5, d) * (1. - band);
      col = mix(col, sun, inside * .92);
      col += mag * .35 * exp(-max(d - S, 0.) / (S * .55)) * (1. - inside);      // halo
      col += mag * .25 * exp(-(hy - f.y) / 40.);                                // horizon haze
    } else {                                              // floor: perspective grid
      float dy = max(f.y - hy, .5);
      float fz = (R.y - hy) * 1.1;
      float z = fz / dy;                                  // depth of this pixel
      float x = (f.x - cx) * z / (fz * .9);               // lane coordinate
      float gz = abs(fract(z + Z) - .5), gx = abs(fract(x + .5) - .5);
      float w = fwidth(z + Z) * 1.2, wx = fwidth(x) * 1.2;
      float line = max(1. - smoothstep(0., w, gz - .0), 1. - smoothstep(0., wx, gx));
      float glow = max(exp(-gz / (w * 3. + .02)), exp(-gx / (wx * 3. + .02)));
      float fog = exp(-z * .06);
      col = mix(night, vec3(.07,.02,.16), fog * .8);
      col += cyan * (line * .9 + glow * .25) * fog;
      col += mag * .5 * exp(-dy / 6.);                    // the lit horizon line
    }
    col *= .94 + .06 * sin(f.y * 3.14159);                // faint scanlines
    o = vec4(col, 1.);
  }`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  let pr;
  try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link'); } catch (e) { console.warn('realm-gl off:', e.message); return false; }
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), uR = U('R'), uZ = U('Z'), uH = U('H'), uS = U('S'), uT = U('T');
  let dpr = 1;
  const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 1.5); c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, c.width, c.height); };
  size(); addEventListener('resize', size);
  state.draw = () => {   // realm.js calls this instead of its 2D draw
    gl.uniform2f(uR, c.width, c.height); gl.uniform1f(uZ, state.z); gl.uniform1f(uH, state.hy * dpr); gl.uniform1f(uS, state.r * dpr); gl.uniform1f(uT, performance.now() / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  state.draw();
  old.replaceWith(c);
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); state.draw = null; c.replaceWith(old); }); // fall back to 2D
  ready && ready();
  return true;
};
