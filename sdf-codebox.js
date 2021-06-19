// copied from https://css-tricks.com/creating-an-editable-textarea-that-supports-syntax-highlighted-code/

function updateHighlight(text) {
    const elem = document.getElementById("sdf-code-highlight-content");
    elem.innerHTML = text.replace(new RegExp("&", "g"), "&amp;").replace(new RegExp("<", "g"), "&lt;");
    //console.log(elem.innerHTML);
    Prism.highlightElement(elem);
}

function syncScroll(ele) {
    let resultEle = document.getElementById("sdf-code-highlight");
    resultEle.scrollTop = ele.scrollTop;
    resultEle.scrollLeft = ele.scrollLeft;
}

function checkTab(element, event) {
    let code = element.value;
    if(event.key == "Tab") {
      /* Tab key pressed */
      event.preventDefault(); // stop normal
      let before_tab = code.slice(0, element.selectionStart); // text before tab
      let after_tab = code.slice(element.selectionEnd, element.value.length); // text after tab
      let cursor_pos = element.selectionEnd + 4; // where cursor moves after tab - 4 for 4 spaces
      element.value = before_tab + "    " + after_tab; // add tab char - 4 spaces
      // move cursor
      element.selectionStart = cursor_pos;
      element.selectionEnd = cursor_pos;
    }
  }