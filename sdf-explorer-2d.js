const SCROLL_SENSITIVITY = 1.2;
const DEFAULT_ZOOM = 0.01;

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

let params = [];
let shaders = {};
let zoom = DEFAULT_ZOOM;
let center = [0, 0];

let mouseDown = false;
let shiftMouseDown = false;
let shiftMousePos = [0, 0];

const getById = document.getElementById.bind(document); // screw it
const coordsBox = getById("coords-box");
// const sdfCodeEdit = getById("sdf-code-edit");
const topBox = getById("top-box");
const codeSection = getById("code-section");
const paramSection = getById("param-section");
const optionsSection = getById("options-section");
const shareModal = getById("share-modal");
const shareSuccess = getById("share-successful-message");

const editor = CodeMirror(getById("sdf-code"), {
    value: `float sdf(vec2 p) {
  return length(p) - 1.;
}`,
    mode: "x-shader/x-fragment",
    theme: "material-darker"
});
editor.setOption("extraKeys", {
    Tab: function(cm) {
        var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
    }
});

let topBoxSavedHeight;
getById('code-button').onclick = function() {
    if (codeSection.style.display == 'none') {
        if (topBox.style.height == 'auto')
            topBox.style.height = topBoxSavedHeight + 'px';
        topBox.style.resize = 'both';
        codeSection.style.display = 'flex';
        paramSection.style.display = 'none';
        optionsSection.style.display = 'none';
    } else {
        topBoxSavedHeight = topBox.clientHeight;
        topBox.style.height = 'auto';
        topBox.style.resize = 'none';
        codeSection.style.display = 'none';
    }
}
getById('param-button').onclick = function() {
    if (paramSection.style.display == 'none') {
        if (topBox.style.height == 'auto')
            topBox.style.height = topBoxSavedHeight + 'px';
        topBox.style.resize = 'both';
        codeSection.style.display = 'none';
        paramSection.style.display = 'flex';
        optionsSection.style.display = 'none';
    } else {
        topBoxSavedHeight = topBox.clientHeight;
        topBox.style.height = 'auto';
        topBox.style.resize = 'none';
        paramSection.style.display = 'none';
    }
}
getById('edit-param-button').onclick = function() {
    const sliderSection = getById('param-slider-section');
    const editSection = getById('param-edit-section');
    if (editSection.style.display == 'none') {
        sliderSection.style.display = 'none';
        editSection.style.display = 'block';
        getById('edit-param-button').innerHTML = '← Finish Editing';
    } else {
        sliderSection.style.display = 'block';
        editSection.style.display = 'none';
        getById('edit-param-button').innerHTML = 'Edit Parameters →';
    }
}
getById('options-button').onclick = function() {
    if (optionsSection.style.display == 'none') {
        if (topBox.style.height == 'auto')
            topBox.style.height = topBoxSavedHeight + 'px';
        topBox.style.resize = 'both';
        codeSection.style.display = 'none';
        paramSection.style.display = 'none';
        optionsSection.style.display = 'flex';
    } else {
        topBoxSavedHeight = topBox.clientHeight;
        topBox.style.height = 'auto';
        topBox.style.resize = 'none';
        optionsSection.style.display = 'none';
    }
}

getById('reset-view-button').onclick = function() {
    zoom = DEFAULT_ZOOM;
    center = [0, 0];
    draw();
}
getById('share-button').onclick = function() {
    shareModal.style.display = 'block';
}
getById('copy-link-button').onclick = function() {
    let settings = {
        includeView: getById('share-view-checkbox').checked,
        includeColor: getById('share-color-checkbox').checked
    };
    let link = generateShareLink(settings);
    navigator.clipboard.writeText(link)
        .then(function() {
            shareSuccess.style.color = "#66ff66";
            shareSuccess.innerHTML = "Successfully copied link"
        }).catch(function() {
            shareSuccess.style.color = "#ff6666";
            shareSuccess.innerHTML = "Copy failed"
        });
}
window.addEventListener('click', function(e) {
    if (e.target == shareModal) {
        shareModal.style.display = 'none';
    }
    shareSuccess.innerHTML = '';
});

function lerp(v0, v1, t) {
    return v0 + t * (v1 - v0);
}

function addParameter(paramObj) {
    if (!paramObj) {
        paramObj = {
            name: undefined,
            min: 0,
            max: 1,
            val: 0
        };
        let id = 0;
        while (params.find(p => {return p.name == "p" + id;})) id++;
        paramObj.name = "p" + id;
    }

    params.push(paramObj);

    const paramEntry = document.createElement('div');
    const paramName = document.createElement('input');
    const paramMin = document.createElement('input');
    const paramMax = document.createElement('input');
    const paramRemove = document.createElement('button');
    const paramUp = document.createElement('button');
    const paramDown = document.createElement('button');
    const paramSliderDiv = document.createElement('div');
    const paramSlider = document.createElement("input");
    const paramReading = document.createElement("span");
    
    function updateReading() {
        paramReading.innerHTML = `${paramObj.name} = ${+lerp(paramObj.min, paramObj.max, paramObj.val).toFixed(14)}`;
    }

    paramEntry.className = 'box-item param-entry';

    paramName.className = 'param-name';
    paramName.type = 'text';
    paramName.value = paramObj.name;
    paramName.onchange = function() {
        let newName = paramName.value;
        if (!(/^[a-zA-Z][a-zA-Z0-9]*$/.test(newName))) {
            alert("A parameter name must contain only alphanumeric characters. The name should not begin with a digit.");
            paramName.value = paramObj.name;
            return;
        }
        if (params.find(p => p.name == newName)) {
            alert("There is already a parameter with this name.");
            paramName.value = paramObj.name;
            return;
        }
        paramObj.name = newName;
        updateReading();
    };

    paramMin.className = 'param-bounds';
    paramMin.type = 'number';
    paramMin.value = paramObj.min;
    paramMin.onchange = function() {
        if (isNaN(parseFloat(paramMin.value))) paramMin.value = 0;
        paramObj.min = parseFloat(paramMin.value);
        updateReading();
        draw();
    };

    paramMax.className = 'param-bounds';
    paramMax.type = 'number';
    paramMax.value = paramObj.max;
    paramMax.onchange = function() {
        if (isNaN(parseFloat(paramMax.value))) paramMax.value = 0;
        paramObj.max = parseFloat(paramMax.value);
        updateReading();
        draw();
    };

    paramRemove.type = 'button';
    paramRemove.style.fontSize = '1.5em';
	paramRemove.innerHTML = '&times;';
    paramRemove.onclick = function() {
        params.splice(params.indexOf(paramObj), 1);
        paramEntry.remove();
        paramSliderDiv.remove();
    }

    paramUp.type = 'button';
    paramUp.innerHTML = '▲';
    paramUp.onclick = function() {
        let idx = params.indexOf(paramObj);
        if (idx == 0) return;
        getById('param-slider-section').insertBefore(
            paramSliderDiv, paramSliderDiv.previousElementSibling
        );
        getById('param-edit-section').insertBefore(
            paramEntry, paramEntry.previousElementSibling
        );
        let temp = params[idx - 1];
        params[idx - 1] = paramObj;
        params[idx] = temp;
    }

    paramDown.type = 'button';
    paramDown.innerHTML = '▼';
    paramDown.onclick = function() {
        let idx = params.indexOf(paramObj);
        if (idx == params.length - 1) return;
        getById('param-slider-section').insertBefore(
            paramSliderDiv, paramSliderDiv.nextElementSibling.nextElementSibling
        );
        getById('param-edit-section').insertBefore(
            paramEntry, paramEntry.nextElementSibling.nextElementSibling
        );
        let temp = params[idx + 1];
        params[idx + 1] = paramObj;
        params[idx] = temp;
    }

    paramSliderDiv.className = 'box-item';

    paramSlider.type = 'range';
    paramSlider.min = 0;
    paramSlider.max = 1;
    paramSlider.step = 0.001;
    paramSlider.value = paramObj.val;
    paramSlider.className = 'param-slider';
    paramSlider.oninput = function() {
        let val = parseFloat(paramSlider.value);
        paramObj.val = val;
        updateReading();
        draw();
    }

    paramEntry.appendChild(paramName);
    paramEntry.appendChild(paramMin);
    paramEntry.appendChild(paramMax);
    paramEntry.appendChild(paramRemove);
    paramEntry.appendChild(paramUp);
    paramEntry.appendChild(paramDown);
    getById('param-edit-section').insertBefore(
        paramEntry, getById('add-param-button').parentElement
    );
    paramSliderDiv.appendChild(paramReading);
    paramSliderDiv.appendChild(document.createElement('br'));
    paramSliderDiv.appendChild(paramSlider);
    getById('param-slider-section').appendChild(paramSliderDiv);

    updateReading();
}

function compile() {
    let paramsDefs = '';
    for (const p of params) {
        paramsDefs += 'uniform float ' + p.name + ';\n';
    }
    
    const sdfShader = compileSDFShader(gl, {
        params: params,
        paramsDefs: paramsDefs,
        sdfCode: editor.getValue()
    });
    if (!sdfShader) return;
    shaders.sdfShader = sdfShader;

    const raymarchShader = compileRaymarchShader(gl, {
        params: params,
        paramsDefs: paramsDefs,
        sdfCode: editor.getValue()
    });
    if (!raymarchShader) return;
    shaders.raymarchShader = raymarchShader;
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
    if (!shaders.sdfShader) return;
    resize();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0., 0., 0., 1.);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let programInfo = shaders.sdfShader.programInfo;

    gl.useProgram(programInfo.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, shaders.sdfShader.buffers.pos);
    gl.vertexAttribPointer(
		programInfo.attribLocs.pos, 2, gl.FLOAT, false, 0, 0
	);
	gl.enableVertexAttribArray(programInfo.attribLocs.pos);

    gl.uniform2f(programInfo.uniformLocs.res, canvas.clientWidth / 2, canvas.clientHeight / 2);
    gl.uniform1f(programInfo.uniformLocs.zoom, zoom);
	gl.uniform2fv(programInfo.uniformLocs.center, center);
    for (const p of params) {
        let val = lerp(p.min, p.max, p.val);
        gl.uniform1f(programInfo.uniformLocs[p.name], val);
    }
    gl.uniform1i(programInfo.uniformLocs.coloring, parseInt(getById('coloring-select').value));

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (shiftMouseDown) {
        programInfo = shaders.raymarchShader.programInfo;
        gl.useProgram(programInfo.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, shaders.raymarchShader.buffers.dir);
        gl.vertexAttribPointer(
            programInfo.attribLocs.dir, 2, gl.FLOAT, false, 0, 0
        );
        gl.enableVertexAttribArray(programInfo.attribLocs.dir);

        gl.uniform2f(programInfo.uniformLocs.res, canvas.clientWidth / 2, canvas.clientHeight / 2);
        gl.uniform1f(programInfo.uniformLocs.zoom, zoom);
        gl.uniform2fv(programInfo.uniformLocs.center, center);
        gl.uniform2fv(programInfo.uniformLocs.origin, shiftMousePos);
        for (const p of params) {
            let val = lerp(p.min, p.max, p.val);
            gl.uniform1f(programInfo.uniformLocs[p.name], val);
        }

        gl.drawArrays(gl.TRIANGLE_FAN, 0, CIRCLE_RES + 2);
    }
}

function mouseToCoords(e) {
    const rect = canvas.getBoundingClientRect();
	let mx = e.clientX - rect.left;
	let my = rect.bottom - e.clientY;
	let px = (center[0] - rect.width / 2 * zoom) + mx * zoom;
	let py = (center[1] - rect.height / 2 * zoom) + my * zoom;
    return [px, py];
}

function updateCoords(e) {
	let [px, py] = mouseToCoords(e);
	coordsBox.innerHTML = `mouse position: (${px.toFixed(14)}, ${py.toFixed(14)})`;
}

function generateShareLink(settings) {
    let link = `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}${location.pathname}?`
    link += 's=' + LZString.compressToEncodedURIComponent(editor.getValue());
    let pStr = '';
    for (const p of params) {
        if (pStr) pStr += '_';
        pStr += `${p.name}_${p.min}_${p.max}_${p.val}`;
    }
    if (pStr) link += '&p=' + pStr;
    if (settings.includeView) {
        link += `&v=${center[0]}_${center[1]}_${zoom}`;
    }
    if (settings.includeColor) {
        link += `&c=${getById('coloring-select').value}`;
    }
    return link;
}

function setupState(state) {
    editor.setValue(state.sdfCode);
    for (const p of state.params) {
        addParameter(p);
    }
    center = state.center;
    zoom = state.zoom;
    getById('coloring-select').value = state.coloring;
}

const defaultState = {
    sdfCode: 'float sdf(vec2 p) {\n  return length(p) - 1.;\n}',
    params: [],
    center: [0, 0],
    zoom: DEFAULT_ZOOM,
    coloring: getById('coloring-select').value
};

function getStateFromURL() {
    let urlParams = new URLSearchParams(window.location.search);
    let state = Object.assign({}, defaultState);

    let sParam = urlParams.get('s');
    if (sParam) state.sdfCode = LZString.decompressFromEncodedURIComponent(sParam);

    if (urlParams.get('p')) {
        let pList = urlParams.get('p').split('_');
        for (let i = 0; i < pList.length; i += 4) {
            state.params.push({
                name: pList[i],
                min: parseFloat(pList[i + 1]),
                max: parseFloat(pList[i + 2]),
                val: parseFloat(pList[i + 3]),
            });
        }
    }

    if (urlParams.get('v')) {
        let vList = urlParams.get('v').split('_');
        state.center = [parseFloat(vList[0]), parseFloat(vList[1])];
        state.zoom = parseFloat(vList[2]);
    }
    
    if (urlParams.get('c')) {
        state.coloring = urlParams.get('c');
    }

    return state;
}

window.onload = function() {
    let state = getStateFromURL();
    setupState(state);

    //updateHighlight(document.getElementById("sdf-code-edit").value);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    compile();
    draw();

    canvas.addEventListener('mousemove', function(e) {
        updateCoords(e);
        if (mouseDown) {
            if (e.shiftKey) {
                shiftMouseDown = true;
                shiftMousePos = mouseToCoords(e);
                draw();
                return;
            } else {
                shiftMouseDown = false;
            }
            center[0] -= e.movementX * zoom;
            center[1] += e.movementY * zoom;
            draw();
        }
    });
    canvas.addEventListener('mousedown', function(e) {
        mouseDown = true;
        if (e.shiftKey) {
            shiftMouseDown = true;
            shiftMousePos = mouseToCoords(e);
            draw();
        }
    });
    canvas.addEventListener('mouseup', function() {
        mouseDown = false;
        if (shiftMouseDown) {
            shiftMouseDown = false;
            draw();
        }
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
}