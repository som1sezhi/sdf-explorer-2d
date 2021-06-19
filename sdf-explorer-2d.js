const SCROLL_SENSITIVITY = 1.2;
const DEFAULT_ZOOM = 0.01;

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

let programInfo, buffers;
let zoom = DEFAULT_ZOOM;
let center = [0, 0];

let mouseDown = false;

const coordsBox = document.getElementById("coords-box");
const sdfCodeEdit = document.getElementById("sdf-code-edit");

window.onload = function() {
    canvas.addEventListener('mousemove', function(e) {
        if (mouseDown) {
            center[0] -= e.movementX * zoom;
            center[1] += e.movementY * zoom;
            draw();
        }
        updateCoords(e);
    });
    canvas.addEventListener('mousedown', function() {
        mouseDown = true;
    });
    canvas.addEventListener('mouseup', function() {
        mouseDown = false;
    });
    canvas.addEventListener('wheel', function(e) {
        if (e.deltaY < 0) {
            zoom /= SCROLL_SENSITIVITY;
        } else {
            zoom *= SCROLL_SENSITIVITY;
        }
        draw();
        updateCoords(e);
    });
    window.addEventListener("resize", function() {
        draw();
    });

    updateHighlight(document.getElementById("sdf-code-edit").value);
    compile();
    draw();
}

function compile() {
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
    #define PI 3.14159265
    precision highp float;
    varying vec2 v_pos;
    ${sdfCodeEdit.value}
    vec3 color(float d) {
        vec3 c;
        if (d > 0.) c = vec3(1.0, .65, .3);
        else c = vec3(.3, .65, 1.0);
        c *= 1. - exp(-abs(d));
        c *= .8*pow(abs(d), .15);
        //if (mod(floor(10. * d), 2.) == 0.) c *= .7;
        c *= 0.15 * ( smoothstep(0., 0.05, mod(10. * d, 2.)) * smoothstep(1.05, 1., mod(10. * d, 2.)) ) + 0.85;
        c = mix(vec3(1.), c, smoothstep(.023, .027, abs(d)));
        return c;
    }
    void main() {
        gl_FragColor = vec4(color(sdf(v_pos)), 1.);
    }`;
    const program = initShaderProgram(gl, vsSource, fsSource);
    programInfo = {
        program: program,
        attribLocs: {
			pos: gl.getAttribLocation(program, "a_pos")
		},
		uniformLocs: {
			res: gl.getUniformLocation(program, "u_res"),
			zoom: gl.getUniformLocation(program, "u_zoom"),
			center: gl.getUniformLocation(program, "u_center")
		}
    };

    const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	const positions = [-1, -1, -1, 3, 3, -1];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	buffers = {pos: posBuffer};
}

function resize() {
	let dispWidth = canvas.clientWidth;
	let dispHeight = canvas.clientHeight;
	if (canvas.width != dispWidth || canvas.height != dispHeight) {
		canvas.width = dispWidth;
		canvas.height = dispHeight;
	}
}

function draw() {
    resize();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0., 0., 0., 1.);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
    gl.vertexAttribPointer(
		programInfo.attribLocs.pos, 2, gl.FLOAT, false, 0, 0
	);
	gl.enableVertexAttribArray(programInfo.attribLocs.pos);

    gl.uniform2f(programInfo.uniformLocs.res, canvas.clientWidth / 2, canvas.clientHeight / 2);
    gl.uniform1f(programInfo.uniformLocs.zoom, zoom);
	gl.uniform2fv(programInfo.uniformLocs.center, center);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function updateCoords(e) {
	const rect = canvas.getBoundingClientRect();
	let mx = e.clientX - rect.left;
	let my = rect.bottom - e.clientY;
	let px = (center[0] - rect.width / 2 * zoom) + mx * zoom;
	let py = (center[1] - rect.height / 2 * zoom) + my * zoom;
	coordsBox.innerHTML = `mouse position: (${px.toFixed(14)}, ${py.toFixed(14)})`;
}
