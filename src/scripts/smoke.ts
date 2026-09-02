/**
 * Smoke hero: a port of the Quoth app's orb to a full-screen WebGL2 shader.
 *
 * Same idea as orb.py: a persistent dye field is transported each frame by a
 * divergence-free curl-noise flow (semi-Lagrangian backtrace, no pressure
 * solve), fed by a few drifting emitters and the cursor, and left to settle.
 * Monochrome, lit by the dye's own gradient so it folds like silk, with grain.
 */

const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Full-screen triangle: three vertices, no buffers.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Shared noise helpers (3D simplex, Ashima/McEwan, MIT).
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float a=0.5,s=0.0;
  for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec3(17.1,9.3,3.7);a*=0.5;}
  return s;
}`;

const ADVECT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uDye;
uniform vec2 uRes;      // sim resolution in texels
uniform float uAspect;  // width / height
uniform float uTime;
uniform float uDt;
uniform vec2 uMouse;    // sim uv
uniform vec2 uMouseVel; // uv per second
uniform float uMouseOn;
uniform float uInit;
${NOISE}

// Stream function: warped, slowly evolving fbm. Curl of it is the flow.
float psi(vec2 p, float t){
  vec2 w = vec2(fbm(vec3(p * 0.9, t * 0.07)), fbm(vec3(p * 0.9 + 31.7, t * 0.07 + 5.0)));
  vec2 q = p + w * 0.35;
  return fbm(vec3(q * 1.05, t * 0.085));
}

vec2 flow(vec2 p, float t){
  float e = 0.01;
  float dx = psi(p + vec2(e, 0.0), t) - psi(p - vec2(e, 0.0), t);
  float dy = psi(p + vec2(0.0, e), t) - psi(p - vec2(0.0, e), t);
  // curl of scalar field: (d/dy, -d/dx), divergence-free by construction
  return vec2(dy, -dx) / (2.0 * e);
}

void main(){
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float t = uTime;

  if (uInit > 0.5) {
    // Rest frame: a designed initial silk so the first frame is never black.
    float d = fbm(vec3(p * 1.4, 0.0)) * 0.5 + 0.5;
    d = smoothstep(0.25, 0.95, d) * 0.55;
    outColor = vec4(vec3(d), 1.0);
    return;
  }

  vec2 v = flow(p, t) * 0.045;

  // Cursor: a soft gaussian of its own velocity, plus a swirl around it.
  vec2 mp = vec2(uMouse.x * uAspect, uMouse.y);
  vec2 dm = p - mp;
  float g = exp(-dot(dm, dm) * 60.0);
  vec2 mv = vec2(uMouseVel.x * uAspect, uMouseVel.y);
  v += uMouseOn * g * (mv * 0.35 + vec2(-dm.y, dm.x) * 0.9);

  // Semi-Lagrangian backtrace through the flow.
  vec2 back = vUv - vec2(v.x / uAspect, v.y) * uDt;
  vec2 bc = clamp(back, vec2(0.001), vec2(0.999));
  vec2 tx = 1.0 / uRes;
  float dye = texture(uDye, bc).r * 0.52
    + (texture(uDye, bc + vec2(tx.x, 0.0)).r + texture(uDye, bc - vec2(tx.x, 0.0)).r
    +  texture(uDye, bc + vec2(0.0, tx.y)).r + texture(uDye, bc - vec2(0.0, tx.y)).r) * 0.12;

  // Emitters: three sources ambling on incommensurate orbits.
  float presence = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 c = vec2(0.5 * uAspect, 0.5) + vec2(
      sin(t * (0.11 + fi * 0.023) + fi * 2.1) * (0.28 * uAspect),
      cos(t * (0.09 + fi * 0.017) + fi * 1.3) * 0.32);
    vec2 d = p - c;
    presence += exp(-dot(d, d) * (9.0 + fi * 3.0)) * (0.55 + 0.25 * sin(t * 0.5 + fi));
  }
  // Cursor injects proportional to how fast it moves; still cursor adds nothing.
  float speed = clamp(length(uMouseVel) * 1.2, 0.0, 1.0);
  presence += uMouseOn * g * speed * 1.6;

  float inject = clamp(uDt * 1.4, 0.0, 1.0) * presence;
  dye += inject * (0.9 - dye);
  float fade = clamp(uDt * 0.16, 0.0, 1.0);
  dye += fade * (0.08 - dye);

  outColor = vec4(vec3(dye), 1.0);
}`;

const SHOW = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uDye;
uniform vec2 uSimRes;
uniform vec2 uViewRes;
uniform float uTime;
uniform float uFade;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 texel = 1.0 / uSimRes;
  float d  = texture(uDye, vUv).r;
  float dx = texture(uDye, vUv + vec2(texel.x, 0.0)).r - texture(uDye, vUv - vec2(texel.x, 0.0)).r;
  float dy = texture(uDye, vUv + vec2(0.0, texel.y)).r - texture(uDye, vUv - vec2(0.0, texel.y)).r;

  // Silk shading: light the dye by its own slope so folds catch a sheen.
  vec3 n = normalize(vec3(-dx * 9.0, -dy * 9.0, 1.0));
  vec3 l = normalize(vec3(-0.35, 0.55, 0.75));
  float lit = 0.5 + 0.5 * dot(n, l);
  float sheen = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 6.0);

  float smoke = pow(clamp(d, 0.0, 1.0), 1.5);
  smoke = smoke * mix(0.7, 1.15, lit) + sheen * smoke * 0.12;

  vec3 ink  = vec3(0.031, 0.031, 0.039);
  vec3 bone = vec3(0.86, 0.85, 0.83);
  vec3 col = mix(ink, bone, smoke * 0.58);

  // Vignette, slightly heavier at the bottom so copy stays readable.
  vec2 c = vUv - 0.5;
  float vig = 1.0 - smoothstep(0.35, 1.05, length(c * vec2(1.0, 1.25)) * 1.25);
  col *= mix(0.55, 1.0, vig);

  // Fine animated grain in the shader itself, on top of the page grain.
  float gr = hash(floor(gl_FragCoord.xy) + fract(uTime * 7.0) * 1000.0) - 0.5;
  col += gr * 0.07;

  col *= uFade;
  outColor = vec4(col, 1.0);
}`;

type Program = { prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, frag: string, uniforms: string[]): Program {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
  }
  const u: Program['u'] = {};
  for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
  return { prog, u };
}

const SIM_MAX_W = 720;
const DPR_CAP = 1.5;
const DT_MAX = 1 / 30;

export function mountSmoke(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return () => {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const floatOk = !!gl.getExtension('EXT_color_buffer_float');
  const linearOk = floatOk && !!gl.getExtension('OES_texture_float_linear');
  const useFloat = floatOk && linearOk;

  const advect = link(gl, ADVECT, ['uDye', 'uRes', 'uAspect', 'uTime', 'uDt', 'uMouse', 'uMouseVel', 'uMouseOn', 'uInit']);
  const show = link(gl, SHOW, ['uDye', 'uSimRes', 'uViewRes', 'uTime', 'uFade']);

  let simW = 0, simH = 0;
  let textures: WebGLTexture[] = [];
  let fbos: WebGLFramebuffer[] = [];
  let src = 0;
  let needInit = true;

  const makeTex = (w: number, h: number) => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (useFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo };
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h && textures.length) return;
    canvas.width = w;
    canvas.height = h;
    const scale = Math.min(1, SIM_MAX_W / w);
    simW = Math.max(64, Math.floor(w * scale));
    simH = Math.max(64, Math.floor(h * scale));
    for (const t of textures) gl.deleteTexture(t);
    for (const f of fbos) gl.deleteFramebuffer(f);
    const a = makeTex(simW, simH), b = makeTex(simW, simH);
    textures = [a.tex, b.tex];
    fbos = [a.fbo, b.fbo];
    needInit = true;
  };

  // Pointer state in sim uv, with velocity smoothed across frames.
  const mouse = { x: 0.5, y: 0.5, vx: 0, vy: 0, on: 0, lastT: 0 };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    const now = performance.now();
    const dt = Math.max((now - mouse.lastT) / 1000, 1 / 240);
    if (mouse.on) {
      const vx = (x - mouse.x) / dt, vy = (y - mouse.y) / dt;
      mouse.vx = mouse.vx * 0.6 + vx * 0.4;
      mouse.vy = mouse.vy * 0.6 + vy * 0.4;
    }
    mouse.x = x; mouse.y = y; mouse.on = 1; mouse.lastT = now;
  };
  const onLeave = () => { mouse.on = 0; mouse.vx = 0; mouse.vy = 0; };
  // Listen on the window so the copy overlaying the canvas doesn't block it.
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  let raf = 0;
  let last = performance.now();
  let start = last;
  let visible = true;
  let hidden = document.hidden;

  const step = (now: number) => {
    raf = 0;
    resize();
    const dt = Math.min((now - last) / 1000, DT_MAX);
    last = now;
    const t = (now - start) / 1000;

    // Simulation pass into the back buffer.
    gl.viewport(0, 0, simW, simH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[1 - src]);
    gl.useProgram(advect.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[src]);
    gl.uniform1i(advect.u.uDye, 0);
    gl.uniform2f(advect.u.uRes, simW, simH);
    gl.uniform1f(advect.u.uAspect, simW / simH);
    gl.uniform1f(advect.u.uTime, t);
    gl.uniform1f(advect.u.uDt, dt);
    gl.uniform2f(advect.u.uMouse, mouse.x, mouse.y);
    gl.uniform2f(advect.u.uMouseVel, mouse.vx, mouse.vy);
    gl.uniform1f(advect.u.uMouseOn, mouse.on);
    gl.uniform1f(advect.u.uInit, needInit ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    needInit = false;
    src = 1 - src;
    // Velocity decays between pointer events so a parked cursor goes quiet.
    mouse.vx *= 0.85; mouse.vy *= 0.85;

    // Display pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(show.prog);
    gl.bindTexture(gl.TEXTURE_2D, textures[src]);
    gl.uniform1i(show.u.uDye, 0);
    gl.uniform2f(show.u.uSimRes, simW, simH);
    gl.uniform2f(show.u.uViewRes, canvas.width, canvas.height);
    gl.uniform1f(show.u.uTime, t);
    gl.uniform1f(show.u.uFade, Math.min(1, t / 1.6));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduced && visible && !hidden) raf = requestAnimationFrame(step);
  };

  const kick = () => { if (!raf && visible && !hidden) { last = performance.now(); raf = requestAnimationFrame(step); } };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { threshold: 0.02 });
  io.observe(canvas);
  const onVis = () => { hidden = document.hidden; kick(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { resize(); if (reduced) { needInit = true; step(performance.now()); } });
  ro.observe(canvas);

  if (reduced) {
    // One settled frame, then hold still. Run a few silent sim steps so the
    // rest frame already has folds rather than raw noise.
    resize();
    step(performance.now());
    for (let i = 0; i < 24; i++) step(performance.now() + i * 33);
  } else {
    kick();
  }

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    for (const t of textures) gl.deleteTexture(t);
    for (const f of fbos) gl.deleteFramebuffer(f);
  };
}
