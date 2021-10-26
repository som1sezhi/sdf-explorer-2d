function compileSDFShader(gl, args) {
    let vsSource = `
    attribute vec2 a_pos;
    uniform vec2 u_res;
    uniform float u_zoom;
    uniform vec2 u_center;
    varying vec2 v_pos;
    void main() {
        gl_Position = vec4(a_pos, 0., 1.);
        v_pos = u_zoom * (u_res * a_pos) + u_center;
    }`;

    let fsSource = `
    precision highp float;
    ${args.paramsDefs}
    varying vec2 v_pos;
    uniform vec2 u_res;
    uniform float u_zoom;
    uniform vec2 u_center;
    uniform int u_coloring;
    ${args.sdfCode}
    vec2 nrm_(vec2 p_) {
        const vec2 h_ = vec2(0.00005, 0.);
        return normalize(vec2(
            sdf(p_+h_.xy) - sdf(p_-h_.xy),
            sdf(p_+h_.yx) - sdf(p_-h_.yx)
        ));
    }
    vec3 color_(vec2 p_) {
        // modified version of Inigo Quilez
        // The MIT License
        // Copyright © 2021 Inigo Quilez
        // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        // i hope i'm doing licensing properly

        float d_ = sdf(p_);

        vec3 c_;
        if (d_ > 0.) c_ = vec3(1.0, .65, .3);
        else c_ = vec3(.3, .65, 1.0);
        if (u_coloring == 1) c_ *= 1. + vec3(.5 * nrm_(p_), 0.);
        c_ *= 1. - exp(-abs(d_) * 3.);
        c_ *= .8*pow(abs(d_), .15);
        //if (mod(floor(10. * d_), 2.) == 0.) c_ *= .7;
        c_ *= 0.15 * ( smoothstep(0., 0.05, mod(10. * d_, 2.)) * smoothstep(1.05, 1., mod(10. * d_, 2.)) ) + 0.85;
        c_ = mix(vec3(1.), c_, smoothstep(.023, .027, abs(d_)));
        return c_;
    }
    void main() {
        gl_FragColor = vec4(color_(v_pos), 1.);
    }`;
    // console.log(fsSource);
    let program = initShaderProgram(gl, vsSource, fsSource);
    if (program == null) {
        return null;
    }
    const programInfo = {
        program: program,
        attribLocs: {
            pos: gl.getAttribLocation(program, "a_pos")
        },
        uniformLocs: {
            res: gl.getUniformLocation(program, "u_res"),
            zoom: gl.getUniformLocation(program, "u_zoom"),
            center: gl.getUniformLocation(program, "u_center"),
            coloring: gl.getUniformLocation(program, "u_coloring")
        }
    };
    for (const p of args.params) {
        const name = p.name;
        programInfo.uniformLocs[name] = gl.getUniformLocation(program, name);
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    const positions = [-1, -1, -1, 3, 3, -1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return {
        programInfo: programInfo,
        buffers: {pos: posBuffer}
    };
}

const CIRCLE_RES = 3000;
const dirs = [];
dirs.push(0, 0);
for (let i = 0; i <= CIRCLE_RES; i++) {
    let angle = 2 * Math.PI * i / CIRCLE_RES;
    dirs.push(Math.cos(angle), Math.sin(angle));
}

function compileRaymarchShader(gl, args) {
    let vsSource = `
    #define MAX_STEPS 200
    attribute vec2 a_dir;
    uniform vec2 u_origin;
    uniform vec2 u_res;
    uniform float u_zoom;
    uniform vec2 u_center;
    ${args.paramsDefs}
    varying vec2 v_pos;
    ${args.sdfCode}
    float raymarch_(vec2 origin_, vec2 dir_) {
        float d_ = 0.;
        float max_dist = length(u_res) * u_zoom * 2.;
        for (int i = 0; i < MAX_STEPS; i++) {
            float result_ = sdf(origin_ + dir_ * d_);
            if (result_ < 0.0001) break;
            d_ += result_;
            if (d_ > max_dist) break;
        }
        return d_;
    }
    vec2 convert_(vec2 pos_) {
        return (pos_ - u_center) / u_zoom / u_res;
    }
    void main() {
        if (a_dir == vec2(0., 0.)) {
            gl_Position = vec4(convert_(u_origin), 0., 1.);
            return;
        }
        float d_ = raymarch_(u_origin, a_dir);
        gl_Position = vec4(convert_(u_origin + a_dir * d_), 0., 1.);
    }`;

    let fsSource = `
    precision highp float;
    uniform vec2 u_origin;
    uniform vec2 u_res;
    uniform float u_zoom;
    uniform vec2 u_center;

    void main() {
        vec2 pos = (u_center - u_res * u_zoom) + gl_FragCoord.xy * u_zoom;
        float dist = length(pos - u_origin);
        float scaleFac = length(u_zoom * u_res * 2.);
        vec3 color = vec3(.7, .6, .4) * exp(-dist / scaleFac * 4.);
        gl_FragColor = vec4(color, 1.);
    }`;
    let program = initShaderProgram(gl, vsSource, fsSource);
    if (program == null) {
        return null;
    }
    const programInfo = {
        program: program,
        attribLocs: {
            dir: gl.getAttribLocation(program, "a_dir")
        },
        uniformLocs: {
            res: gl.getUniformLocation(program, "u_res"),
            zoom: gl.getUniformLocation(program, "u_zoom"),
            center: gl.getUniformLocation(program, "u_center"),
            origin: gl.getUniformLocation(program, "u_origin")
        }
    };
    for (const p of args.params) {
        const name = p.name;
        programInfo.uniformLocs[name] = gl.getUniformLocation(program, name);
    }

    const dirBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dirBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dirs), gl.STATIC_DRAW);

    return {
        programInfo: programInfo,
        buffers: {dir: dirBuffer}
    };
}