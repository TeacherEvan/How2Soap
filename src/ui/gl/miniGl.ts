/**
 * Zero-Dependency Minimal WebGL2 3D Shader & Matrix Pipeline
 * Pure browser APIs, 0 bytes external runtime dependencies.
 */

export interface UniformLocations {
  uProjection: WebGLUniformLocation | null;
  uView: WebGLUniformLocation | null;
  uModel: WebGLUniformLocation | null;
  uColor: WebGLUniformLocation | null;
  uLightDir: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uPoseWeight: WebGLUniformLocation | null;
}

export interface GlMeshBuffers {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  animation?: Float32Array;
  animationBuffer?: WebGLBuffer | null;
}

const VS_SRC = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aAnimOffset;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;
uniform float uPoseWeight;

out vec3 vNormal;
out vec3 vWorldPos;

void main() {
  vec3 pos = aPosition + aAnimOffset * (uPoseWeight * (0.5 + 0.5 * cos(uTime)));
  vec4 worldPos = uModel * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * worldPos;
}
`;

const FS_SRC = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;

uniform vec4 uColor;
uniform vec3 uLightDir;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  float diff = max(dot(N, L), 0.15);
  vec3 ambient = vec3(0.2, 0.22, 0.28);
  vec3 diffuse = uColor.rgb * diff;
  fragColor = vec4(diffuse + ambient * uColor.rgb, uColor.a);
}
`;

export class MiniGl {
  public gl: WebGL2RenderingContext;
  public program: WebGLProgram;
  public uniforms: UniformLocations;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VS_SRC);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_SRC);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`GL Program link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.program = prog;

    this.uniforms = {
      uProjection: gl.getUniformLocation(prog, 'uProjection'),
      uView: gl.getUniformLocation(prog, 'uView'),
      uModel: gl.getUniformLocation(prog, 'uModel'),
      uColor: gl.getUniformLocation(prog, 'uColor'),
      uLightDir: gl.getUniformLocation(prog, 'uLightDir'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uPoseWeight: gl.getUniformLocation(prog, 'uPoseWeight'),
    };
  }

  private compileShader(type: number, src: string): WebGLShader {
    const s = this.gl.createShader(type)!;
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${this.gl.getShaderInfoLog(s)}`);
    }
    return s;
  }

  public createMeshBuffers(
    positions: Float32Array,
    normals: Float32Array,
    indices: Uint16Array,
    animation?: Float32Array,
  ): GlMeshBuffers {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    // Pos buffer
    const pBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Normal buffer
    const nBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    // Animation offset buffer (location 2). Static default is zero-filled so
    // uPoseWeight = 0 renders bit-identical to the unanimated pipeline.
    const animData = new Float32Array(positions.length);
    if (animation) {
      animData.set(animation.subarray(0, positions.length));
    }
    const aBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, aBuf);
    gl.bufferData(gl.ARRAY_BUFFER, animData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

    // Index buffer
    const iBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, indexCount: indices.length, animation: animData, animationBuffer: aBuf };
  }
}

// 4x4 Column-Major Matrix Math Helpers
export function mat4Perspective(fovRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovRad / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function mat4LookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
  const [ex, ey, ez] = eye;
  let zx = ex - target[0], zy = ey - target[1], zz = ez - target[2];
  const zlen = Math.hypot(zx, zy, zz) || 1;
  zx /= zlen; zy /= zlen; zz /= zlen;

  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  const xlen = Math.hypot(xx, xy, xz) || 1;
  xx /= xlen; xy /= xlen; xz /= xlen;

  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;

  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

export function mat4Model(tx: number, ty: number, tz: number, sx = 1, sy = 1, sz = 1): Float32Array {
  const out = new Float32Array(16);
  out[0] = sx;
  out[5] = sy;
  out[10] = sz;
  out[12] = tx;
  out[13] = ty;
  out[14] = tz;
  out[15] = 1;
  return out;
}
