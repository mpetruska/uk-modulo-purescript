(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":1}],3:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],4:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":8}],5:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":25}],6:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":11}],7:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":16,"is-object":3}],8:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":14,"../vnode/is-vnode.js":17,"../vnode/is-vtext.js":18,"../vnode/is-widget.js":19,"./apply-properties":7,"global/document":2}],9:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],10:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":19,"../vnode/vpatch.js":22,"./apply-properties":7,"./update-widget":12}],11:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":8,"./dom-index":9,"./patch-op":10,"global/document":2,"x-is-array":26}],12:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":19}],13:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],14:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":15,"./is-vnode":17,"./is-vtext":18,"./is-widget":19}],15:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],16:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],17:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":20}],18:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":20}],19:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],20:[function(require,module,exports){
module.exports = "2"

},{}],21:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":15,"./is-vhook":16,"./is-vnode":17,"./is-widget":19,"./version":20}],22:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":20}],23:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":20}],24:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":16,"is-object":3}],25:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":14,"../vnode/is-thunk":15,"../vnode/is-vnode":17,"../vnode/is-vtext":18,"../vnode/is-widget":19,"../vnode/vpatch":22,"./diff-props":24,"x-is-array":26}],26:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],27:[function(require,module,exports){
// Generated by psc-bundle 0.9.3
var PS = {};
(function(exports) {
    "use strict";

  // module Data.Functor

  exports.arrayMap = function (f) {
    return function (arr) {
      var l = arr.length;
      var result = new Array(l);
      for (var i = 0; i < l; i++) {
        result[i] = f(arr[i]);
      }
      return result;
    };
  };
})(PS["Data.Functor"] = PS["Data.Functor"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Semigroupoid = function (compose) {
      this.compose = compose;
  };
  var semigroupoidFn = new Semigroupoid(function (f) {
      return function (g) {
          return function (x) {
              return f(g(x));
          };
      };
  });
  var compose = function (dict) {
      return dict.compose;
  };
  exports["Semigroupoid"] = Semigroupoid;
  exports["compose"] = compose;
  exports["semigroupoidFn"] = semigroupoidFn;
})(PS["Control.Semigroupoid"] = PS["Control.Semigroupoid"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var Category = function (__superclass_Control$dotSemigroupoid$dotSemigroupoid_0, id) {
      this["__superclass_Control.Semigroupoid.Semigroupoid_0"] = __superclass_Control$dotSemigroupoid$dotSemigroupoid_0;
      this.id = id;
  };
  var id = function (dict) {
      return dict.id;
  };
  var categoryFn = new Category(function () {
      return Control_Semigroupoid.semigroupoidFn;
  }, function (x) {
      return x;
  });
  exports["Category"] = Category;
  exports["id"] = id;
  exports["categoryFn"] = categoryFn;
})(PS["Control.Category"] = PS["Control.Category"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];
  var flip = function (f) {
      return function (b) {
          return function (a) {
              return f(a)(b);
          };
      };
  };
  var $$const = function (a) {
      return function (v) {
          return a;
      };
  };
  var apply = function (f) {
      return function (x) {
          return f(x);
      };
  };
  exports["apply"] = apply;
  exports["const"] = $$const;
  exports["flip"] = flip;
})(PS["Data.Function"] = PS["Data.Function"] || {});
(function(exports) {
    "use strict";

  // module Data.Unit

  exports.unit = {};
})(PS["Data.Unit"] = PS["Data.Unit"] || {});
(function(exports) {
    "use strict";

  // module Data.Show

  exports.showIntImpl = function (n) {
    return n.toString();
  };

  exports.showCharImpl = function (c) {
    var code = c.charCodeAt(0);
    if (code < 0x20 || code === 0x7F) {
      switch (c) {
        case "\x07": return "'\\a'";
        case "\b": return "'\\b'";
        case "\f": return "'\\f'";
        case "\n": return "'\\n'";
        case "\r": return "'\\r'";
        case "\t": return "'\\t'";
        case "\v": return "'\\v'";
      }
      return "'\\" + code.toString(10) + "'";
    }
    return c === "'" || c === "\\" ? "'\\" + c + "'" : "'" + c + "'";
  };
})(PS["Data.Show"] = PS["Data.Show"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Show"];     
  var Show = function (show) {
      this.show = show;
  };                                                 
  var showInt = new Show($foreign.showIntImpl);
  var showChar = new Show($foreign.showCharImpl);
  var show = function (dict) {
      return dict.show;
  };
  exports["Show"] = Show;
  exports["show"] = show;
  exports["showInt"] = showInt;
  exports["showChar"] = showChar;
})(PS["Data.Show"] = PS["Data.Show"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Unit"];
  var Data_Show = PS["Data.Show"];
  exports["unit"] = $foreign.unit;
})(PS["Data.Unit"] = PS["Data.Unit"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var Functor = function (map) {
      this.map = map;
  };
  var map = function (dict) {
      return dict.map;
  };
  var $$void = function (dictFunctor) {
      return map(dictFunctor)(Data_Function["const"](Data_Unit.unit));
  };
  var voidLeft = function (dictFunctor) {
      return function (f) {
          return function (x) {
              return map(dictFunctor)(Data_Function["const"](x))(f);
          };
      };
  };
  var voidRight = function (dictFunctor) {
      return function (x) {
          return map(dictFunctor)(Data_Function["const"](x));
      };
  };
  var functorFn = new Functor(Control_Semigroupoid.compose(Control_Semigroupoid.semigroupoidFn));
  var functorArray = new Functor($foreign.arrayMap);
  exports["Functor"] = Functor;
  exports["map"] = map;
  exports["void"] = $$void;
  exports["voidLeft"] = voidLeft;
  exports["voidRight"] = voidRight;
  exports["functorFn"] = functorFn;
  exports["functorArray"] = functorArray;
})(PS["Data.Functor"] = PS["Data.Functor"] || {});
(function(exports) {
    "use strict";

  exports.concatArray = function (xs) {
    return function (ys) {
      return xs.concat(ys);
    };
  };
})(PS["Data.Semigroup"] = PS["Data.Semigroup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];        
  var Semigroup = function (append) {
      this.append = append;
  };                                                         
  var semigroupArray = new Semigroup($foreign.concatArray);
  var append = function (dict) {
      return dict.append;
  };
  exports["Semigroup"] = Semigroup;
  exports["append"] = append;
  exports["semigroupArray"] = semigroupArray;
})(PS["Data.Semigroup"] = PS["Data.Semigroup"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Functor = PS["Data.Functor"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var Alt = function (__superclass_Data$dotFunctor$dotFunctor_0, alt) {
      this["__superclass_Data.Functor.Functor_0"] = __superclass_Data$dotFunctor$dotFunctor_0;
      this.alt = alt;
  };                                                       
  var alt = function (dict) {
      return dict.alt;
  };
  exports["Alt"] = Alt;
  exports["alt"] = alt;
})(PS["Control.Alt"] = PS["Control.Alt"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];        
  var Apply = function (__superclass_Data$dotFunctor$dotFunctor_0, apply) {
      this["__superclass_Data.Functor.Functor_0"] = __superclass_Data$dotFunctor$dotFunctor_0;
      this.apply = apply;
  };                      
  var apply = function (dict) {
      return dict.apply;
  };
  var applyFirst = function (dictApply) {
      return function (a) {
          return function (b) {
              return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(Data_Function["const"])(a))(b);
          };
      };
  };
  var applySecond = function (dictApply) {
      return function (a) {
          return function (b) {
              return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(Data_Function["const"](Control_Category.id(Control_Category.categoryFn)))(a))(b);
          };
      };
  };
  var lift2 = function (dictApply) {
      return function (f) {
          return function (a) {
              return function (b) {
                  return apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(f)(a))(b);
              };
          };
      };
  };
  exports["Apply"] = Apply;
  exports["apply"] = apply;
  exports["applyFirst"] = applyFirst;
  exports["applySecond"] = applySecond;
  exports["lift2"] = lift2;
})(PS["Control.Apply"] = PS["Control.Apply"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var Applicative = function (__superclass_Control$dotApply$dotApply_0, pure) {
      this["__superclass_Control.Apply.Apply_0"] = __superclass_Control$dotApply$dotApply_0;
      this.pure = pure;
  };
  var pure = function (dict) {
      return dict.pure;
  };
  var when = function (dictApplicative) {
      return function (v) {
          return function (v1) {
              if (v) {
                  return v1;
              };
              if (!v) {
                  return pure(dictApplicative)(Data_Unit.unit);
              };
              throw new Error("Failed pattern match at Control.Applicative line 58, column 1 - line 58, column 16: " + [ v.constructor.name, v1.constructor.name ]);
          };
      };
  };
  var liftA1 = function (dictApplicative) {
      return function (f) {
          return function (a) {
              return Control_Apply.apply(dictApplicative["__superclass_Control.Apply.Apply_0"]())(pure(dictApplicative)(f))(a);
          };
      };
  };
  exports["Applicative"] = Applicative;
  exports["liftA1"] = liftA1;
  exports["pure"] = pure;
  exports["when"] = when;
})(PS["Control.Applicative"] = PS["Control.Applicative"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Data_Functor = PS["Data.Functor"];        
  var Plus = function (__superclass_Control$dotAlt$dotAlt_0, empty) {
      this["__superclass_Control.Alt.Alt_0"] = __superclass_Control$dotAlt$dotAlt_0;
      this.empty = empty;
  };       
  var empty = function (dict) {
      return dict.empty;
  };
  exports["Plus"] = Plus;
  exports["empty"] = empty;
})(PS["Control.Plus"] = PS["Control.Plus"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor = PS["Data.Functor"];        
  var Alternative = function (__superclass_Control$dotApplicative$dotApplicative_0, __superclass_Control$dotPlus$dotPlus_1) {
      this["__superclass_Control.Applicative.Applicative_0"] = __superclass_Control$dotApplicative$dotApplicative_0;
      this["__superclass_Control.Plus.Plus_1"] = __superclass_Control$dotPlus$dotPlus_1;
  };
  exports["Alternative"] = Alternative;
})(PS["Control.Alternative"] = PS["Control.Alternative"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Category = PS["Control.Category"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];        
  var Bind = function (__superclass_Control$dotApply$dotApply_0, bind) {
      this["__superclass_Control.Apply.Apply_0"] = __superclass_Control$dotApply$dotApply_0;
      this.bind = bind;
  };                     
  var bind = function (dict) {
      return dict.bind;
  };
  var bindFlipped = function (dictBind) {
      return Data_Function.flip(bind(dictBind));
  };
  var composeKleisliFlipped = function (dictBind) {
      return function (f) {
          return function (g) {
              return function (a) {
                  return bindFlipped(dictBind)(f)(g(a));
              };
          };
      };
  };
  exports["Bind"] = Bind;
  exports["bind"] = bind;
  exports["bindFlipped"] = bindFlipped;
  exports["composeKleisliFlipped"] = composeKleisliFlipped;
})(PS["Control.Bind"] = PS["Control.Bind"] || {});
(function(exports) {
    "use strict";

  // module Unsafe.Coerce

  exports.unsafeCoerce = function (x) {
    return x;
  };
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Unsafe.Coerce"];
  exports["unsafeCoerce"] = $foreign.unsafeCoerce;
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Unsafe_Coerce = PS["Unsafe.Coerce"];        
  var runExists = Unsafe_Coerce.unsafeCoerce;
  var mkExists = Unsafe_Coerce.unsafeCoerce;
  exports["mkExists"] = mkExists;
  exports["runExists"] = runExists;
})(PS["Data.Exists"] = PS["Data.Exists"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Functor = PS["Data.Functor"];        
  var Monad = function (__superclass_Control$dotApplicative$dotApplicative_0, __superclass_Control$dotBind$dotBind_1) {
      this["__superclass_Control.Applicative.Applicative_0"] = __superclass_Control$dotApplicative$dotApplicative_0;
      this["__superclass_Control.Bind.Bind_1"] = __superclass_Control$dotBind$dotBind_1;
  };
  var ap = function (dictMonad) {
      return function (f) {
          return function (a) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(f)(function (v) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(a)(function (v1) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v(v1));
                  });
              });
          };
      };
  };
  exports["Monad"] = Monad;
  exports["ap"] = ap;
})(PS["Control.Monad"] = PS["Control.Monad"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];        
  var Bifunctor = function (bimap) {
      this.bimap = bimap;
  };
  var bimap = function (dict) {
      return dict.bimap;
  };
  var lmap = function (dictBifunctor) {
      return function (f) {
          return bimap(dictBifunctor)(f)(Control_Category.id(Control_Category.categoryFn));
      };
  };
  var rmap = function (dictBifunctor) {
      return bimap(dictBifunctor)(Control_Category.id(Control_Category.categoryFn));
  };
  exports["Bifunctor"] = Bifunctor;
  exports["bimap"] = bimap;
  exports["lmap"] = lmap;
  exports["rmap"] = rmap;
})(PS["Data.Bifunctor"] = PS["Data.Bifunctor"] || {});
(function(exports) {
    "use strict";

  // module Data.Bounded

  exports.topInt = 2147483647;
  exports.bottomInt = -2147483648;
})(PS["Data.Bounded"] = PS["Data.Bounded"] || {});
(function(exports) {
    "use strict";

  // module Data.Eq

  exports.refEq = function (r1) {
    return function (r2) {
      return r1 === r2;
    };
  };
})(PS["Data.Eq"] = PS["Data.Eq"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Eq"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];        
  var Eq = function (eq) {
      this.eq = eq;
  }; 
  var eqString = new Eq($foreign.refEq);
  var eqInt = new Eq($foreign.refEq);    
  var eq = function (dict) {
      return dict.eq;
  };
  exports["Eq"] = Eq;
  exports["eq"] = eq;
  exports["eqInt"] = eqInt;
  exports["eqString"] = eqString;
})(PS["Data.Eq"] = PS["Data.Eq"] || {});
(function(exports) {
    "use strict";

  // module Data.Ord.Unsafe

  exports.unsafeCompareImpl = function (lt) {
    return function (eq) {
      return function (gt) {
        return function (x) {
          return function (y) {
            return x < y ? lt : x > y ? gt : eq;
          };
        };
      };
    };
  };
})(PS["Data.Ord.Unsafe"] = PS["Data.Ord.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Eq = PS["Data.Eq"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];        
  var LT = (function () {
      function LT() {

      };
      LT.value = new LT();
      return LT;
  })();
  var GT = (function () {
      function GT() {

      };
      GT.value = new GT();
      return GT;
  })();
  var EQ = (function () {
      function EQ() {

      };
      EQ.value = new EQ();
      return EQ;
  })();
  exports["LT"] = LT;
  exports["GT"] = GT;
  exports["EQ"] = EQ;
})(PS["Data.Ordering"] = PS["Data.Ordering"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Ord.Unsafe"];
  var Data_Ordering = PS["Data.Ordering"];        
  var unsafeCompare = $foreign.unsafeCompareImpl(Data_Ordering.LT.value)(Data_Ordering.EQ.value)(Data_Ordering.GT.value);
  exports["unsafeCompare"] = unsafeCompare;
})(PS["Data.Ord.Unsafe"] = PS["Data.Ord.Unsafe"] || {});
(function(exports) {
    "use strict";

  // module Data.Semiring

  exports.intAdd = function (x) {
    return function (y) {
      /* jshint bitwise: false */
      return x + y | 0;
    };
  };

  exports.intMul = function (x) {
    return function (y) {
      /* jshint bitwise: false */
      return x * y | 0;
    };
  };
})(PS["Data.Semiring"] = PS["Data.Semiring"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Semiring"];
  var Data_Unit = PS["Data.Unit"];        
  var Semiring = function (add, mul, one, zero) {
      this.add = add;
      this.mul = mul;
      this.one = one;
      this.zero = zero;
  };
  var zero = function (dict) {
      return dict.zero;
  };                                                                            
  var semiringInt = new Semiring($foreign.intAdd, $foreign.intMul, 1, 0);
  var one = function (dict) {
      return dict.one;
  };
  var mul = function (dict) {
      return dict.mul;
  };
  var add = function (dict) {
      return dict.add;
  };
  exports["Semiring"] = Semiring;
  exports["add"] = add;
  exports["mul"] = mul;
  exports["one"] = one;
  exports["zero"] = zero;
  exports["semiringInt"] = semiringInt;
})(PS["Data.Semiring"] = PS["Data.Semiring"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Ord"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Ord_Unsafe = PS["Data.Ord.Unsafe"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Void = PS["Data.Void"];
  var Data_Semiring = PS["Data.Semiring"];        
  var Ord = function (__superclass_Data$dotEq$dotEq_0, compare) {
      this["__superclass_Data.Eq.Eq_0"] = __superclass_Data$dotEq$dotEq_0;
      this.compare = compare;
  }; 
  var ordString = new Ord(function () {
      return Data_Eq.eqString;
  }, Data_Ord_Unsafe.unsafeCompare);
  var ordInt = new Ord(function () {
      return Data_Eq.eqInt;
  }, Data_Ord_Unsafe.unsafeCompare);
  var compare = function (dict) {
      return dict.compare;
  };
  exports["Ord"] = Ord;
  exports["compare"] = compare;
  exports["ordInt"] = ordInt;
  exports["ordString"] = ordString;
})(PS["Data.Ord"] = PS["Data.Ord"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Bounded"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Ordering = PS["Data.Ordering"];        
  var Bounded = function (__superclass_Data$dotOrd$dotOrd_0, bottom, top) {
      this["__superclass_Data.Ord.Ord_0"] = __superclass_Data$dotOrd$dotOrd_0;
      this.bottom = bottom;
      this.top = top;
  };
  var top = function (dict) {
      return dict.top;
  };                                                 
  var boundedInt = new Bounded(function () {
      return Data_Ord.ordInt;
  }, $foreign.bottomInt, $foreign.topInt);
  var bottom = function (dict) {
      return dict.bottom;
  };
  exports["Bounded"] = Bounded;
  exports["bottom"] = bottom;
  exports["top"] = top;
  exports["boundedInt"] = boundedInt;
})(PS["Data.Bounded"] = PS["Data.Bounded"] || {});
(function(exports) {
    "use strict";

  exports.foldrArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = len - 1; i >= 0; i--) {
          acc = f(xs[i])(acc);
        }
        return acc;
      };
    };
  };

  exports.foldlArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = 0; i < len; i++) {
          acc = f(acc)(xs[i]);
        }
        return acc;
      };
    };
  };
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
    "use strict";

  // module Data.HeytingAlgebra

  exports.boolConj = function (b1) {
    return function (b2) {
      return b1 && b2;
    };
  };

  exports.boolDisj = function (b1) {
    return function (b2) {
      return b1 || b2;
    };
  };

  exports.boolNot = function (b) {
    return !b;
  };
})(PS["Data.HeytingAlgebra"] = PS["Data.HeytingAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];        
  var HeytingAlgebra = function (conj, disj, ff, implies, not, tt) {
      this.conj = conj;
      this.disj = disj;
      this.ff = ff;
      this.implies = implies;
      this.not = not;
      this.tt = tt;
  };
  var tt = function (dict) {
      return dict.tt;
  };
  var not = function (dict) {
      return dict.not;
  };
  var implies = function (dict) {
      return dict.implies;
  };                 
  var ff = function (dict) {
      return dict.ff;
  };
  var disj = function (dict) {
      return dict.disj;
  };
  var heytingAlgebraBoolean = new HeytingAlgebra($foreign.boolConj, $foreign.boolDisj, false, function (a) {
      return function (b) {
          return disj(heytingAlgebraBoolean)(not(heytingAlgebraBoolean)(a))(b);
      };
  }, $foreign.boolNot, true);
  var conj = function (dict) {
      return dict.conj;
  };
  exports["HeytingAlgebra"] = HeytingAlgebra;
  exports["conj"] = conj;
  exports["disj"] = disj;
  exports["ff"] = ff;
  exports["implies"] = implies;
  exports["not"] = not;
  exports["tt"] = tt;
  exports["heytingAlgebraBoolean"] = heytingAlgebraBoolean;
})(PS["Data.HeytingAlgebra"] = PS["Data.HeytingAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];        
  var BooleanAlgebra = function (__superclass_Data$dotHeytingAlgebra$dotHeytingAlgebra_0) {
      this["__superclass_Data.HeytingAlgebra.HeytingAlgebra_0"] = __superclass_Data$dotHeytingAlgebra$dotHeytingAlgebra_0;
  }; 
  var booleanAlgebraBoolean = new BooleanAlgebra(function () {
      return Data_HeytingAlgebra.heytingAlgebraBoolean;
  });
  exports["BooleanAlgebra"] = BooleanAlgebra;
  exports["booleanAlgebraBoolean"] = booleanAlgebraBoolean;
})(PS["Data.BooleanAlgebra"] = PS["Data.BooleanAlgebra"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];        
  var Monoid = function (__superclass_Data$dotSemigroup$dotSemigroup_0, mempty) {
      this["__superclass_Data.Semigroup.Semigroup_0"] = __superclass_Data$dotSemigroup$dotSemigroup_0;
      this.mempty = mempty;
  };     
  var monoidArray = new Monoid(function () {
      return Data_Semigroup.semigroupArray;
  }, [  ]);
  var mempty = function (dict) {
      return dict.mempty;
  };
  exports["Monoid"] = Monoid;
  exports["mempty"] = mempty;
  exports["monoidArray"] = monoidArray;
})(PS["Data.Monoid"] = PS["Data.Monoid"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Category = PS["Control.Category"];        
  var Just = (function () {
      function Just(value0) {
          this.value0 = value0;
      };
      Just.create = function (value0) {
          return new Just(value0);
      };
      return Just;
  })();
  var Nothing = (function () {
      function Nothing() {

      };
      Nothing.value = new Nothing();
      return Nothing;
  })();
  var maybe = function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Nothing) {
                  return v;
              };
              if (v2 instanceof Just) {
                  return v1(v2.value0);
              };
              throw new Error("Failed pattern match at Data.Maybe line 232, column 1 - line 232, column 22: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  };
  var isNothing = maybe(true)(Data_Function["const"](false));
  var isJust = maybe(false)(Data_Function["const"](true));
  var functorMaybe = new Data_Functor.Functor(function (v) {
      return function (v1) {
          if (v1 instanceof Just) {
              return new Just(v(v1.value0));
          };
          return Nothing.value;
      };
  });
  var fromJust = function (dictPartial) {
      return function (v) {
          var __unused = function (dictPartial1) {
              return function ($dollar29) {
                  return $dollar29;
              };
          };
          return __unused(dictPartial)((function () {
              if (v instanceof Just) {
                  return v.value0;
              };
              throw new Error("Failed pattern match at Data.Maybe line 283, column 1 - line 283, column 21: " + [ v.constructor.name ]);
          })());
      };
  };
  var applyMaybe = new Control_Apply.Apply(function () {
      return functorMaybe;
  }, function (v) {
      return function (v1) {
          if (v instanceof Just) {
              return Data_Functor.map(functorMaybe)(v.value0)(v1);
          };
          if (v instanceof Nothing) {
              return Nothing.value;
          };
          throw new Error("Failed pattern match at Data.Maybe line 78, column 3 - line 78, column 31: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var bindMaybe = new Control_Bind.Bind(function () {
      return applyMaybe;
  }, function (v) {
      return function (v1) {
          if (v instanceof Just) {
              return v1(v.value0);
          };
          if (v instanceof Nothing) {
              return Nothing.value;
          };
          throw new Error("Failed pattern match at Data.Maybe line 137, column 3 - line 137, column 24: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  exports["Just"] = Just;
  exports["Nothing"] = Nothing;
  exports["fromJust"] = fromJust;
  exports["isJust"] = isJust;
  exports["isNothing"] = isNothing;
  exports["maybe"] = maybe;
  exports["functorMaybe"] = functorMaybe;
  exports["applyMaybe"] = applyMaybe;
  exports["bindMaybe"] = bindMaybe;
})(PS["Data.Maybe"] = PS["Data.Maybe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];        
  var Conj = function (x) {
      return x;
  };
  var semigroupConj = function (dictHeytingAlgebra) {
      return new Data_Semigroup.Semigroup(function (v) {
          return function (v1) {
              return Data_HeytingAlgebra.conj(dictHeytingAlgebra)(v)(v1);
          };
      });
  };
  var runConj = function (v) {
      return v;
  };
  var monoidConj = function (dictHeytingAlgebra) {
      return new Data_Monoid.Monoid(function () {
          return semigroupConj(dictHeytingAlgebra);
      }, Data_HeytingAlgebra.tt(dictHeytingAlgebra));
  };
  exports["Conj"] = Conj;
  exports["runConj"] = runConj;
  exports["semigroupConj"] = semigroupConj;
  exports["monoidConj"] = monoidConj;
})(PS["Data.Monoid.Conj"] = PS["Data.Monoid.Conj"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foldable"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Plus = PS["Control.Plus"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Maybe_Last = PS["Data.Maybe.Last"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Monoid_Additive = PS["Data.Monoid.Additive"];
  var Data_Monoid_Conj = PS["Data.Monoid.Conj"];
  var Data_Monoid_Disj = PS["Data.Monoid.Disj"];
  var Data_Monoid_Dual = PS["Data.Monoid.Dual"];
  var Data_Monoid_Endo = PS["Data.Monoid.Endo"];
  var Data_Monoid_Multiplicative = PS["Data.Monoid.Multiplicative"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Category = PS["Control.Category"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];        
  var Foldable = function (foldMap, foldl, foldr) {
      this.foldMap = foldMap;
      this.foldl = foldl;
      this.foldr = foldr;
  };
  var foldr = function (dict) {
      return dict.foldr;
  };
  var traverse_ = function (dictApplicative) {
      return function (dictFoldable) {
          return function (f) {
              return foldr(dictFoldable)(function ($164) {
                  return Control_Apply.applySecond(dictApplicative["__superclass_Control.Apply.Apply_0"]())(f($164));
              })(Control_Applicative.pure(dictApplicative)(Data_Unit.unit));
          };
      };
  };
  var for_ = function (dictApplicative) {
      return function (dictFoldable) {
          return Data_Function.flip(traverse_(dictApplicative)(dictFoldable));
      };
  };
  var foldl = function (dict) {
      return dict.foldl;
  };
  var sum = function (dictFoldable) {
      return function (dictSemiring) {
          return foldl(dictFoldable)(Data_Semiring.add(dictSemiring))(Data_Semiring.zero(dictSemiring));
      };
  }; 
  var foldMapDefaultR = function (dictFoldable) {
      return function (dictMonoid) {
          return function (f) {
              return function (xs) {
                  return foldr(dictFoldable)(function (x) {
                      return function (acc) {
                          return Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(f(x))(acc);
                      };
                  })(Data_Monoid.mempty(dictMonoid))(xs);
              };
          };
      };
  };
  var foldableArray = new Foldable(function (dictMonoid) {
      return foldMapDefaultR(foldableArray)(dictMonoid);
  }, $foreign.foldlArray, $foreign.foldrArray);
  var foldMap = function (dict) {
      return dict.foldMap;
  };
  var all = function (dictFoldable) {
      return function (dictBooleanAlgebra) {
          return function (p) {
              return function ($171) {
                  return Data_Monoid_Conj.runConj(foldMap(dictFoldable)(Data_Monoid_Conj.monoidConj(dictBooleanAlgebra["__superclass_Data.HeytingAlgebra.HeytingAlgebra_0"]()))(function ($172) {
                      return Data_Monoid_Conj.Conj(p($172));
                  })($171));
              };
          };
      };
  };
  exports["Foldable"] = Foldable;
  exports["all"] = all;
  exports["foldMap"] = foldMap;
  exports["foldMapDefaultR"] = foldMapDefaultR;
  exports["foldl"] = foldl;
  exports["foldr"] = foldr;
  exports["for_"] = for_;
  exports["sum"] = sum;
  exports["traverse_"] = traverse_;
  exports["foldableArray"] = foldableArray;
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];        
  var Left = (function () {
      function Left(value0) {
          this.value0 = value0;
      };
      Left.create = function (value0) {
          return new Left(value0);
      };
      return Left;
  })();
  var Right = (function () {
      function Right(value0) {
          this.value0 = value0;
      };
      Right.create = function (value0) {
          return new Right(value0);
      };
      return Right;
  })();
  var functorEither = new Data_Functor.Functor(function (v) {
      return function (v1) {
          if (v1 instanceof Left) {
              return new Left(v1.value0);
          };
          if (v1 instanceof Right) {
              return new Right(v(v1.value0));
          };
          throw new Error("Failed pattern match at Data.Either line 46, column 3 - line 46, column 26: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var either = function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Left) {
                  return v(v2.value0);
              };
              if (v2 instanceof Right) {
                  return v1(v2.value0);
              };
              throw new Error("Failed pattern match at Data.Either line 243, column 1 - line 243, column 26: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  };
  var isLeft = either(Data_Function["const"](true))(Data_Function["const"](false));
  var bifunctorEither = new Data_Bifunctor.Bifunctor(function (v) {
      return function (v1) {
          return function (v2) {
              if (v2 instanceof Left) {
                  return new Left(v(v2.value0));
              };
              if (v2 instanceof Right) {
                  return new Right(v1(v2.value0));
              };
              throw new Error("Failed pattern match at Data.Either line 53, column 3 - line 53, column 34: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  });
  var applyEither = new Control_Apply.Apply(function () {
      return functorEither;
  }, function (v) {
      return function (v1) {
          if (v instanceof Left) {
              return new Left(v.value0);
          };
          if (v instanceof Right) {
              return Data_Functor.map(functorEither)(v.value0)(v1);
          };
          throw new Error("Failed pattern match at Data.Either line 89, column 3 - line 89, column 28: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var bindEither = new Control_Bind.Bind(function () {
      return applyEither;
  }, either(function (e) {
      return function (v) {
          return new Left(e);
      };
  })(function (a) {
      return function (f) {
          return f(a);
      };
  }));
  var applicativeEither = new Control_Applicative.Applicative(function () {
      return applyEither;
  }, Right.create);
  exports["Left"] = Left;
  exports["Right"] = Right;
  exports["either"] = either;
  exports["isLeft"] = isLeft;
  exports["functorEither"] = functorEither;
  exports["bifunctorEither"] = bifunctorEither;
  exports["applyEither"] = applyEither;
  exports["applicativeEither"] = applicativeEither;
  exports["bindEither"] = bindEither;
})(PS["Data.Either"] = PS["Data.Either"] || {});
(function(exports) {
    "use strict";

  // module Control.Monad.Eff

  exports.pureE = function (a) {
    return function () {
      return a;
    };
  };

  exports.bindE = function (a) {
    return function (f) {
      return function () {
        return f(a())();
      };
    };
  };
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Eff"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var monadEff = new Control_Monad.Monad(function () {
      return applicativeEff;
  }, function () {
      return bindEff;
  });
  var bindEff = new Control_Bind.Bind(function () {
      return applyEff;
  }, $foreign.bindE);
  var applyEff = new Control_Apply.Apply(function () {
      return functorEff;
  }, Control_Monad.ap(monadEff));
  var applicativeEff = new Control_Applicative.Applicative(function () {
      return applyEff;
  }, $foreign.pureE);
  var functorEff = new Data_Functor.Functor(Control_Applicative.liftA1(applicativeEff));
  exports["functorEff"] = functorEff;
  exports["applyEff"] = applyEff;
  exports["applicativeEff"] = applicativeEff;
  exports["bindEff"] = bindEff;
  exports["monadEff"] = monadEff;
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Alt = PS["Control.Alt"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Monad = PS["Control.Monad"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_Eq = PS["Data.Eq"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Data_Field = PS["Data.Field"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];        
  var Identity = function (x) {
      return x;
  };
  var runIdentity = function (v) {
      return v;
  };
  var functorIdentity = new Data_Functor.Functor(function (f) {
      return function (v) {
          return f(v);
      };
  });
  var applyIdentity = new Control_Apply.Apply(function () {
      return functorIdentity;
  }, function (v) {
      return function (v1) {
          return v(v1);
      };
  });
  var bindIdentity = new Control_Bind.Bind(function () {
      return applyIdentity;
  }, function (v) {
      return function (f) {
          return f(v);
      };
  });
  var applicativeIdentity = new Control_Applicative.Applicative(function () {
      return applyIdentity;
  }, Identity);
  var monadIdentity = new Control_Monad.Monad(function () {
      return applicativeIdentity;
  }, function () {
      return bindIdentity;
  });
  exports["Identity"] = Identity;
  exports["runIdentity"] = runIdentity;
  exports["functorIdentity"] = functorIdentity;
  exports["applyIdentity"] = applyIdentity;
  exports["applicativeIdentity"] = applicativeIdentity;
  exports["bindIdentity"] = bindIdentity;
  exports["monadIdentity"] = monadIdentity;
})(PS["Data.Identity"] = PS["Data.Identity"] || {});
(function(exports) {
    "use strict";

  // module Partial.Unsafe

  exports.unsafePartial = function (f) {
    return f();
  };
})(PS["Partial.Unsafe"] = PS["Partial.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Partial.Unsafe"];
  var Partial = PS["Partial"];
  exports["unsafePartial"] = $foreign.unsafePartial;
})(PS["Partial.Unsafe"] = PS["Partial.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Unsafe = PS["Control.Monad.Eff.Unsafe"];
  var Control_Monad_ST = PS["Control.Monad.ST"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadRec = function (__superclass_Control$dotMonad$dotMonad_0, tailRecM) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.tailRecM = tailRecM;
  };
  var tailRecM = function (dict) {
      return dict.tailRecM;
  };             
  var forever = function (dictMonadRec) {
      return function (ma) {
          return tailRecM(dictMonadRec)(function (u) {
              return Data_Functor.voidRight((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(new Data_Either.Left(u))(ma);
          })(Data_Unit.unit);
      };
  };
  exports["MonadRec"] = MonadRec;
  exports["forever"] = forever;
  exports["tailRecM"] = tailRecM;
})(PS["Control.Monad.Rec.Class"] = PS["Control.Monad.Rec.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];        
  var MonadTrans = function (lift) {
      this.lift = lift;
  };
  var lift = function (dict) {
      return dict.lift;
  };
  exports["MonadTrans"] = MonadTrans;
  exports["lift"] = lift;
})(PS["Control.Monad.Trans"] = PS["Control.Monad.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Exists = PS["Data.Exists"];
  var Data_Either = PS["Data.Either"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Category = PS["Control.Category"];        
  var Bound = (function () {
      function Bound(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bound.create = function (value0) {
          return function (value1) {
              return new Bound(value0, value1);
          };
      };
      return Bound;
  })();
  var FreeT = (function () {
      function FreeT(value0) {
          this.value0 = value0;
      };
      FreeT.create = function (value0) {
          return new FreeT(value0);
      };
      return FreeT;
  })();
  var Bind = (function () {
      function Bind(value0) {
          this.value0 = value0;
      };
      Bind.create = function (value0) {
          return new Bind(value0);
      };
      return Bind;
  })();
  var monadTransFreeT = function (dictFunctor) {
      return new Control_Monad_Trans.MonadTrans(function (dictMonad) {
          return function (ma) {
              return new FreeT(function (v) {
                  return Data_Functor.map(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Left.create)(ma);
              });
          };
      });
  };
  var freeT = FreeT.create;
  var bound = function (m) {
      return function (f) {
          return new Bind(Data_Exists.mkExists(new Bound(m, f)));
      };
  };
  var functorFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return new Data_Functor.Functor(function (f) {
              return function (v) {
                  if (v instanceof FreeT) {
                      return new FreeT(function (v1) {
                          return Data_Functor.map(dictFunctor1)(Data_Bifunctor.bimap(Data_Either.bifunctorEither)(f)(Data_Functor.map(dictFunctor)(Data_Functor.map(functorFreeT(dictFunctor)(dictFunctor1))(f))))(v.value0(Data_Unit.unit));
                      });
                  };
                  if (v instanceof Bind) {
                      return Data_Exists.runExists(function (v1) {
                          return bound(v1.value0)(function ($98) {
                              return Data_Functor.map(functorFreeT(dictFunctor)(dictFunctor1))(f)(v1.value1($98));
                          });
                      })(v.value0);
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free.Trans line 55, column 3 - line 55, column 69: " + [ f.constructor.name, v.constructor.name ]);
              };
          });
      };
  };
  var bimapFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return function (nf) {
              return function (nm) {
                  return function (v) {
                      if (v instanceof Bind) {
                          return Data_Exists.runExists(function (v1) {
                              return bound(function ($99) {
                                  return bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm)(v1.value0($99));
                              })(function ($100) {
                                  return bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm)(v1.value1($100));
                              });
                          })(v.value0);
                      };
                      if (v instanceof FreeT) {
                          return new FreeT(function (v1) {
                              return Data_Functor.map(dictFunctor1)(Data_Functor.map(Data_Either.functorEither)(function ($101) {
                                  return nf(Data_Functor.map(dictFunctor)(bimapFreeT(dictFunctor)(dictFunctor1)(nf)(nm))($101));
                              }))(nm(v.value0(Data_Unit.unit)));
                          });
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 96, column 1 - line 96, column 114: " + [ nf.constructor.name, nm.constructor.name, v.constructor.name ]);
                  };
              };
          };
      };
  };
  var hoistFreeT = function (dictFunctor) {
      return function (dictFunctor1) {
          return bimapFreeT(dictFunctor)(dictFunctor1)(Control_Category.id(Control_Category.categoryFn));
      };
  };
  var monadFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Monad.Monad(function () {
              return applicativeFreeT(dictFunctor)(dictMonad);
          }, function () {
              return bindFreeT(dictFunctor)(dictMonad);
          });
      };
  };
  var bindFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Bind.Bind(function () {
              return applyFreeT(dictFunctor)(dictMonad);
          }, function (v) {
              return function (f) {
                  if (v instanceof Bind) {
                      return Data_Exists.runExists(function (v1) {
                          return bound(v1.value0)(function (x) {
                              return bound(function (v2) {
                                  return v1.value1(x);
                              })(f);
                          });
                      })(v.value0);
                  };
                  return bound(function (v1) {
                      return v;
                  })(f);
              };
          });
      };
  };
  var applyFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Apply.Apply(function () {
              return functorFreeT(dictFunctor)(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
          }, Control_Monad.ap(monadFreeT(dictFunctor)(dictMonad)));
      };
  };
  var applicativeFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Applicative.Applicative(function () {
              return applyFreeT(dictFunctor)(dictMonad);
          }, function (a) {
              return new FreeT(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(a));
              });
          });
      };
  };
  var liftFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return function (fa) {
              return new FreeT(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(Data_Functor.map(dictFunctor)(Control_Applicative.pure(applicativeFreeT(dictFunctor)(dictMonad)))(fa)));
              });
          };
      };
  };
  var resume = function (dictFunctor) {
      return function (dictMonadRec) {
          var go = function (v) {
              if (v instanceof FreeT) {
                  return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Right.create)(v.value0(Data_Unit.unit));
              };
              if (v instanceof Bind) {
                  return Data_Exists.runExists(function (v1) {
                      var $77 = v1.value0(Data_Unit.unit);
                      if ($77 instanceof FreeT) {
                          return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())($77.value0(Data_Unit.unit))(function (v2) {
                              if (v2 instanceof Data_Either.Left) {
                                  return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1.value1(v2.value0)));
                              };
                              if (v2 instanceof Data_Either.Right) {
                                  return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(new Data_Either.Right(Data_Functor.map(dictFunctor)(function (h) {
                                      return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(h)(v1.value1);
                                  })(v2.value0))));
                              };
                              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 49, column 9 - line 51, column 68: " + [ v2.constructor.name ]);
                          });
                      };
                      if ($77 instanceof Bind) {
                          return Data_Exists.runExists(function (v2) {
                              return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(v2.value0(Data_Unit.unit))(function (z) {
                                  return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(v2.value1(z))(v1.value1);
                              })));
                          })($77.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 46, column 5 - line 52, column 98: " + [ $77.constructor.name ]);
                  })(v.value0);
              };
              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 44, column 3 - line 44, column 36: " + [ v.constructor.name ]);
          };
          return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(go);
      };
  };
  var runFreeT = function (dictFunctor) {
      return function (dictMonadRec) {
          return function (interp) {
              var go = function (v) {
                  if (v instanceof Data_Either.Left) {
                      return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(v.value0));
                  };
                  if (v instanceof Data_Either.Right) {
                      return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(interp(v.value0))(function (v1) {
                          return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1));
                      });
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free.Trans line 104, column 3 - line 104, column 31: " + [ v.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(Control_Bind.composeKleisliFlipped((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(go)(resume(dictFunctor)(dictMonadRec)));
          };
      };
  };
  var monadRecFreeT = function (dictFunctor) {
      return function (dictMonad) {
          return new Control_Monad_Rec_Class.MonadRec(function () {
              return monadFreeT(dictFunctor)(dictMonad);
          }, function (f) {
              var go = function (s) {
                  return Control_Bind.bind(bindFreeT(dictFunctor)(dictMonad))(f(s))(function (v) {
                      if (v instanceof Data_Either.Left) {
                          return go(v.value0);
                      };
                      if (v instanceof Data_Either.Right) {
                          return Control_Applicative.pure(applicativeFreeT(dictFunctor)(dictMonad))(v.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 78, column 7 - line 80, column 26: " + [ v.constructor.name ]);
                  });
              };
              return go;
          });
      };
  };
  exports["bimapFreeT"] = bimapFreeT;
  exports["freeT"] = freeT;
  exports["hoistFreeT"] = hoistFreeT;
  exports["liftFreeT"] = liftFreeT;
  exports["resume"] = resume;
  exports["runFreeT"] = runFreeT;
  exports["functorFreeT"] = functorFreeT;
  exports["applyFreeT"] = applyFreeT;
  exports["applicativeFreeT"] = applicativeFreeT;
  exports["bindFreeT"] = bindFreeT;
  exports["monadFreeT"] = monadFreeT;
  exports["monadTransFreeT"] = monadTransFreeT;
  exports["monadRecFreeT"] = monadRecFreeT;
})(PS["Control.Monad.Free.Trans"] = PS["Control.Monad.Free.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Category = PS["Control.Category"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];        
  var MonadEff = function (__superclass_Control$dotMonad$dotMonad_0, liftEff) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.liftEff = liftEff;
  };
  var monadEffEff = new MonadEff(function () {
      return Control_Monad_Eff.monadEff;
  }, Control_Category.id(Control_Category.categoryFn));
  var liftEff = function (dict) {
      return dict.liftEff;
  };
  exports["MonadEff"] = MonadEff;
  exports["liftEff"] = liftEff;
  exports["monadEffEff"] = monadEffEff;
})(PS["Control.Monad.Eff.Class"] = PS["Control.Monad.Eff.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadError = function (__superclass_Control$dotMonad$dotMonad_0, catchError, throwError) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.catchError = catchError;
      this.throwError = throwError;
  };
  var throwError = function (dict) {
      return dict.throwError;
  };                          
  var catchError = function (dict) {
      return dict.catchError;
  };
  exports["MonadError"] = MonadError;
  exports["catchError"] = catchError;
  exports["throwError"] = throwError;
})(PS["Control.Monad.Error.Class"] = PS["Control.Monad.Error.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Unit = PS["Data.Unit"];        
  var Lazy = function (defer) {
      this.defer = defer;
  };
  var defer = function (dict) {
      return dict.defer;
  };
  exports["Lazy"] = Lazy;
  exports["defer"] = defer;
})(PS["Control.Lazy"] = PS["Control.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Biapplicative = PS["Control.Biapplicative"];
  var Control_Biapply = PS["Control.Biapply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Unit = PS["Data.Unit"];        
  var Tuple = (function () {
      function Tuple(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Tuple.create = function (value0) {
          return function (value1) {
              return new Tuple(value0, value1);
          };
      };
      return Tuple;
  })();
  exports["Tuple"] = Tuple;
})(PS["Data.Tuple"] = PS["Data.Tuple"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unit = PS["Data.Unit"];        
  var MonadState = function (__superclass_Control$dotMonad$dotMonad_0, state) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.state = state;
  };
  var state = function (dict) {
      return dict.state;
  };
  var modify = function (dictMonadState) {
      return function (f) {
          return state(dictMonadState)(function (s) {
              return new Data_Tuple.Tuple(Data_Unit.unit, f(s));
          });
      };
  };
  var get = function (dictMonadState) {
      return state(dictMonadState)(function (s) {
          return new Data_Tuple.Tuple(s, s);
      });
  };
  exports["MonadState"] = MonadState;
  exports["get"] = get;
  exports["modify"] = modify;
  exports["state"] = state;
})(PS["Control.Monad.State.Class"] = PS["Control.Monad.State.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_RWS_Class = PS["Control.Monad.RWS.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];        
  var MaybeT = function (x) {
      return x;
  };
  var runMaybeT = function (v) {
      return v;
  };
  var monadMaybeT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeMaybeT(dictMonad);
      }, function () {
          return bindMaybeT(dictMonad);
      });
  };
  var functorMaybeT = function (dictMonad) {
      return new Data_Functor.Functor(Control_Applicative.liftA1(applicativeMaybeT(dictMonad)));
  };
  var bindMaybeT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyMaybeT(dictMonad);
      }, function (v) {
          return function (f) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v)(function (v1) {
                  if (v1 instanceof Data_Maybe.Nothing) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Nothing.value);
                  };
                  if (v1 instanceof Data_Maybe.Just) {
                      var $36 = f(v1.value0);
                      return $36;
                  };
                  throw new Error("Failed pattern match at Control.Monad.Maybe.Trans line 55, column 5 - line 58, column 22: " + [ v1.constructor.name ]);
              });
          };
      });
  };
  var applyMaybeT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorMaybeT(dictMonad);
      }, Control_Monad.ap(monadMaybeT(dictMonad)));
  };
  var applicativeMaybeT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyMaybeT(dictMonad);
      }, function ($61) {
          return MaybeT(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Just.create($61)));
      });
  };
  var monadRecMaybeT = function (dictMonadRec) {
      return new Control_Monad_Rec_Class.MonadRec(function () {
          return monadMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]());
      }, function (f) {
          return function ($63) {
              return MaybeT(Control_Monad_Rec_Class.tailRecM(dictMonadRec)(function (a) {
                  var $42 = f(a);
                  return Control_Bind.bind((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())($42)(function (m$prime) {
                      return Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())((function () {
                          if (m$prime instanceof Data_Maybe.Nothing) {
                              return new Data_Either.Right(Data_Maybe.Nothing.value);
                          };
                          if (m$prime instanceof Data_Maybe.Just && m$prime.value0 instanceof Data_Either.Left) {
                              return new Data_Either.Left(m$prime.value0.value0);
                          };
                          if (m$prime instanceof Data_Maybe.Just && m$prime.value0 instanceof Data_Either.Right) {
                              return new Data_Either.Right(new Data_Maybe.Just(m$prime.value0.value0));
                          };
                          throw new Error("Failed pattern match at Control.Monad.Maybe.Trans line 86, column 11 - line 89, column 45: " + [ m$prime.constructor.name ]);
                      })());
                  });
              })($63));
          };
      });
  };
  var altMaybeT = function (dictMonad) {
      return new Control_Alt.Alt(function () {
          return functorMaybeT(dictMonad);
      }, function (v) {
          return function (v1) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v)(function (v2) {
                  if (v2 instanceof Data_Maybe.Nothing) {
                      return v1;
                  };
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v2);
              });
          };
      });
  };
  var plusMaybeT = function (dictMonad) {
      return new Control_Plus.Plus(function () {
          return altMaybeT(dictMonad);
      }, Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(Data_Maybe.Nothing.value));
  };
  exports["MaybeT"] = MaybeT;
  exports["runMaybeT"] = runMaybeT;
  exports["functorMaybeT"] = functorMaybeT;
  exports["applyMaybeT"] = applyMaybeT;
  exports["applicativeMaybeT"] = applicativeMaybeT;
  exports["bindMaybeT"] = bindMaybeT;
  exports["monadMaybeT"] = monadMaybeT;
  exports["altMaybeT"] = altMaybeT;
  exports["plusMaybeT"] = plusMaybeT;
  exports["monadRecMaybeT"] = monadRecMaybeT;
})(PS["Control.Monad.Maybe.Trans"] = PS["Control.Monad.Maybe.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var WriterT = function (x) {
      return x;
  };
  var runWriterT = function (v) {
      return v;
  };
  var mapWriterT = function (f) {
      return function (v) {
          return f(v);
      };
  };
  var functorWriterT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return Data_Function.apply(mapWriterT)(Data_Functor.map(dictFunctor)(function (v) {
              return new Data_Tuple.Tuple(f(v.value0), v.value1);
          }));
      });
  };
  var applyWriterT = function (dictSemigroup) {
      return function (dictApply) {
          return new Control_Apply.Apply(function () {
              return functorWriterT(dictApply["__superclass_Data.Functor.Functor_0"]());
          }, function (v) {
              return function (v1) {
                  var k = function (v3) {
                      return function (v4) {
                          return new Data_Tuple.Tuple(v3.value0(v4.value0), Data_Semigroup.append(dictSemigroup)(v3.value1)(v4.value1));
                      };
                  };
                  return Control_Apply.apply(dictApply)(Data_Functor.map(dictApply["__superclass_Data.Functor.Functor_0"]())(k)(v))(v1);
              };
          });
      };
  };
  var applicativeWriterT = function (dictMonoid) {
      return function (dictApplicative) {
          return new Control_Applicative.Applicative(function () {
              return applyWriterT(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(dictApplicative["__superclass_Control.Apply.Apply_0"]());
          }, function (a) {
              return Data_Function.apply(WriterT)(Data_Function.apply(Control_Applicative.pure(dictApplicative))(new Data_Tuple.Tuple(a, Data_Monoid.mempty(dictMonoid))));
          });
      };
  };
  exports["WriterT"] = WriterT;
  exports["mapWriterT"] = mapWriterT;
  exports["runWriterT"] = runWriterT;
  exports["functorWriterT"] = functorWriterT;
  exports["applyWriterT"] = applyWriterT;
  exports["applicativeWriterT"] = applicativeWriterT;
})(PS["Control.Monad.Writer.Trans"] = PS["Control.Monad.Writer.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Cont_Trans = PS["Control.Monad.Cont.Trans"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Ref = PS["Control.Monad.Eff.Ref"];
  var Control_Monad_Eff_Unsafe = PS["Control.Monad.Eff.Unsafe"];
  var Control_Monad_Except_Trans = PS["Control.Monad.Except.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Either = PS["Data.Either"];        
  var Parallel = function (x) {
      return x;
  };
  var MonadPar = function (__superclass_Control$dotMonad$dotMonad_0, par) {
      this["__superclass_Control.Monad.Monad_0"] = __superclass_Control$dotMonad$dotMonad_0;
      this.par = par;
  };
  var runParallel = function (v) {
      return v;
  };
  var parallel = Parallel;
  var par = function (dict) {
      return dict.par;
  }; 
  var functorParallel = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function ($90) {
              return parallel(Data_Functor.map(dictFunctor)(f)(runParallel($90)));
          };
      });
  };
  var applyParallel = function (dictMonadPar) {
      return new Control_Apply.Apply(function () {
          return functorParallel((((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, function (f) {
          return function (a) {
              return parallel(par(dictMonadPar)(Data_Function.apply)(runParallel(f))(runParallel(a)));
          };
      });
  };
  exports["MonadPar"] = MonadPar;
  exports["par"] = par;
  exports["parallel"] = parallel;
  exports["runParallel"] = runParallel;
  exports["functorParallel"] = functorParallel;
  exports["applyParallel"] = applyParallel;
})(PS["Control.Parallel.Class"] = PS["Control.Parallel.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Category = PS["Control.Category"];        
  var Profunctor = function (dimap) {
      this.dimap = dimap;
  };
  var profunctorFn = new Profunctor(function (a2b) {
      return function (c2d) {
          return function (b2c) {
              return function ($4) {
                  return c2d(b2c(a2b($4)));
              };
          };
      };
  });
  var dimap = function (dict) {
      return dict.dimap;
  };
  var rmap = function (dictProfunctor) {
      return function (b2c) {
          return dimap(dictProfunctor)(Control_Category.id(Control_Category.categoryFn))(b2c);
      };
  };
  exports["Profunctor"] = Profunctor;
  exports["dimap"] = dimap;
  exports["rmap"] = rmap;
  exports["profunctorFn"] = profunctorFn;
})(PS["Data.Profunctor"] = PS["Data.Profunctor"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Profunctor = PS["Data.Profunctor"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Category = PS["Control.Category"];
  var profunctorAwait = new Data_Profunctor.Profunctor(function (f) {
      return function (g) {
          return function (v) {
              return Data_Profunctor.dimap(Data_Profunctor.profunctorFn)(f)(g)(v);
          };
      };
  });
  var fuseWith = function (dictFunctor) {
      return function (dictFunctor1) {
          return function (dictFunctor2) {
              return function (dictMonadRec) {
                  return function (dictMonadPar) {
                      return function (zap) {
                          return function (fs) {
                              return function (gs) {
                                  var go = function (v) {
                                      return Control_Bind.bind((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())(Control_Parallel_Class.runParallel(Control_Apply.apply(Control_Parallel_Class.applyParallel(dictMonadPar))(Data_Functor.map(Control_Parallel_Class.functorParallel((((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Control_Apply.lift2(Data_Either.applyEither)(zap(Data_Tuple.Tuple.create)))(Control_Parallel_Class.parallel(Control_Monad_Free_Trans.resume(dictFunctor)(dictMonadRec)(v.value0))))(Control_Parallel_Class.parallel(Control_Monad_Free_Trans.resume(dictFunctor1)(dictMonadRec)(v.value1)))))(function (v1) {
                                          if (v1 instanceof Data_Either.Left) {
                                              return Control_Applicative.pure((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Left(v1.value0));
                                          };
                                          if (v1 instanceof Data_Either.Right) {
                                              return Control_Applicative.pure((dictMonadPar["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())(new Data_Either.Right(Data_Functor.map(dictFunctor2)(function (t) {
                                                  return Control_Monad_Free_Trans.freeT(function (v2) {
                                                      return go(t);
                                                  });
                                              })(v1.value0)));
                                          };
                                          throw new Error("Failed pattern match at Control.Coroutine line 73, column 5 - line 75, column 63: " + [ v1.constructor.name ]);
                                      });
                                  };
                                  return Control_Monad_Free_Trans.freeT(function (v) {
                                      return go(new Data_Tuple.Tuple(fs, gs));
                                  });
                              };
                          };
                      };
                  };
              };
          };
      };
  };
  var functorAwait = new Data_Functor.Functor(Data_Profunctor.rmap(profunctorAwait));
  var $$await = function (dictMonad) {
      return Control_Monad_Free_Trans.liftFreeT(functorAwait)(dictMonad)(Control_Category.id(Control_Category.categoryFn));
  };
  exports["await"] = $$await;
  exports["fuseWith"] = fuseWith;
  exports["profunctorAwait"] = profunctorAwait;
  exports["functorAwait"] = functorAwait;
})(PS["Control.Coroutine"] = PS["Control.Coroutine"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];        
  var Emit = (function () {
      function Emit(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Emit.create = function (value0) {
          return function (value1) {
              return new Emit(value0, value1);
          };
      };
      return Emit;
  })();
  var Stall = (function () {
      function Stall(value0) {
          this.value0 = value0;
      };
      Stall.create = function (value0) {
          return new Stall(value0);
      };
      return Stall;
  })();
  var runStallingProcess = function (dictMonadRec) {
      return function ($31) {
          return Control_Monad_Maybe_Trans.runMaybeT(Control_Monad_Free_Trans.runFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.monadRecMaybeT(dictMonadRec))(Data_Maybe.maybe(Control_Plus.empty(Control_Monad_Maybe_Trans.plusMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]())))(Control_Applicative.pure(Control_Monad_Maybe_Trans.applicativeMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))))(Control_Monad_Free_Trans.hoistFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.functorMaybeT(dictMonadRec["__superclass_Control.Monad.Monad_0"]()))(function ($32) {
              return Control_Monad_Maybe_Trans.MaybeT(Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Maybe.Just.create)($32));
          })($31)));
      };
  };
  var bifunctorStallF = new Data_Bifunctor.Bifunctor(function (f) {
      return function (g) {
          return function (v) {
              if (v instanceof Emit) {
                  return new Emit(f(v.value0), g(v.value1));
              };
              if (v instanceof Stall) {
                  return new Stall(g(v.value0));
              };
              throw new Error("Failed pattern match at Control.Coroutine.Stalling line 51, column 15 - line 53, column 27: " + [ v.constructor.name ]);
          };
      };
  });
  var functorStallF = new Data_Functor.Functor(function (f) {
      return Data_Bifunctor.rmap(bifunctorStallF)(f);
  });
  var fuse = function (dictMonadRec) {
      return function (dictMonadPar) {
          return Control_Coroutine.fuseWith(functorStallF)(Control_Coroutine.functorAwait)(Data_Maybe.functorMaybe)(dictMonadRec)(dictMonadPar)(function (f) {
              return function (q) {
                  return function (v) {
                      if (q instanceof Emit) {
                          return new Data_Maybe.Just(f(q.value1)(v(q.value0)));
                      };
                      if (q instanceof Stall) {
                          return Data_Maybe.Nothing.value;
                      };
                      throw new Error("Failed pattern match at Control.Coroutine.Stalling line 86, column 5 - line 88, column 27: " + [ q.constructor.name ]);
                  };
              };
          });
      };
  };
  exports["Emit"] = Emit;
  exports["Stall"] = Stall;
  exports["fuse"] = fuse;
  exports["runStallingProcess"] = runStallingProcess;
  exports["bifunctorStallF"] = bifunctorStallF;
  exports["functorStallF"] = functorStallF;
})(PS["Control.Coroutine.Stalling"] = PS["Control.Coroutine.Stalling"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports._forkAff = function (nonCanceler, aff) {
    var voidF = function(){};

    return function(success, error) {
      var canceler = aff(voidF, voidF);
      success(canceler);
      return nonCanceler;
    };
  }

  exports._forkAll = function (nonCanceler, foldl, affs) {
    var voidF = function(){};

    return function(success, error) {
      try {
        var cancelers = foldl(function(acc) {
          return function(aff) {
            acc.push(aff(voidF, voidF));
            return acc;
          }
        })([])(affs);
      } catch (err) {
        error(err)
      }

      var canceler = function(e) {
        return function(success, error) {
          var cancellations = 0;
          var result        = false;
          var errored       = false;

          var s = function(bool) {
            cancellations = cancellations + 1;
            result        = result || bool;

            if (cancellations === cancelers.length && !errored) {
              success(result);
            }
          };

          var f = function(err) {
            if (!errored) {
              errored = true;
              error(err);
            }
          };

          for (var i = 0; i < cancelers.length; i++) {
            cancelers[i](e)(s, f);
          }

          return nonCanceler;
        };
      };

      success(canceler);
      return nonCanceler;
    };
  }

  exports._makeAff = function (cb) {
    return function(success, error) {
      try {
        return cb(function(e) {
          return function() {
            error(e);
          };
        })(function(v) {
          return function() {
            success(v);
          };
        })();
      } catch (err) {
        error(err);
      }
    }
  }

  exports._pure = function (nonCanceler, v) {
    return function(success, error) {
      success(v);
      return nonCanceler;
    };
  }

  exports._throwError = function (nonCanceler, e) {
    return function(success, error) {
      error(e);
      return nonCanceler;
    };
  }

  exports._fmap = function (f, aff) {
    return function(success, error) {
      try {
        return aff(function(v) {
          try {
            var v2 = f(v);
          } catch (err) {
            error(err)
          }
          success(v2);
        }, error);
      } catch (err) {
        error(err);
      }
    };
  }

  exports._bind = function (alwaysCanceler, aff, f) {
    return function(success, error) {
      var canceler1, canceler2;

      var isCanceled    = false;
      var requestCancel = false;

      var onCanceler = function(){};

      canceler1 = aff(function(v) {
        if (requestCancel) {
          isCanceled = true;

          return alwaysCanceler;
        } else {
          canceler2 = f(v)(success, error);

          onCanceler(canceler2);

          return canceler2;
        }
      }, error);

      return function(e) {
        return function(s, f) {
          requestCancel = true;

          if (canceler2 !== undefined) {
            return canceler2(e)(s, f);
          } else {
            return canceler1(e)(function(bool) {
              if (bool || isCanceled) {
                s(true);
              } else {
                onCanceler = function(canceler) {
                  canceler(e)(s, f);
                };
              }
            }, f);
          }
        };
      };
    };
  }

  exports._attempt = function (Left, Right, aff) {
    return function(success, error) {
      try {
        return aff(function(v) {
          success(Right(v));
        }, function(e) {
          success(Left(e));
        });
      } catch (err) {
        success(Left(err));
      }
    };
  }

  exports._runAff = function (errorT, successT, aff) {
    return function() {
      return aff(function(v) {
        successT(v)();
      }, function(e) {
        errorT(e)();
      });
    };
  }

  exports._liftEff = function (nonCanceler, e) {
    return function(success, error) {
      var result;
      try {
        result = e();
      } catch (err) {
        error(err);
        return nonCanceler;
      }

      success(result);
      return nonCanceler;
    };
  }

  exports._tailRecM = function (isLeft, f, a) {
    return function(success, error) {
      return function go(acc) {
        var result, status, canceler;

        // Observes synchronous effects using a flag.
        //   status = 0 (unresolved status)
        //   status = 1 (synchronous effect)
        //   status = 2 (asynchronous effect)
        while (true) {
          status = 0;
          canceler = f(acc)(function(v) {
            // If the status is still unresolved, we have observed a
            // synchronous effect. Otherwise, the status will be `2`.
            if (status === 0) {
              // Store the result for further synchronous processing.
              result = v;
              status = 1;
            } else {
              // When we have observed an asynchronous effect, we use normal
              // recursion. This is safe because we will be on a new stack.
              if (isLeft(v)) {
                go(v.value0);
              } else {
                try {
                  success(v.value0);
                } catch (err) {
                  error(err);
                }
              }
            }
          }, error);

          // If the status has already resolved to `1` by our Aff handler, then
          // we have observed a synchronous effect. Otherwise it will still be
          // `0`.
          if (status === 1) {
            // When we have observed a synchronous effect, we merely swap out the
            // accumulator and continue the loop, preserving stack.
            if (isLeft(result)) {
              acc = result.value0;
              continue;
            } else {
              try {
                success(result.value0);
              } catch (err) {
                error(err);
              }
            }
          } else {
            // If the status has not resolved yet, then we have observed an
            // asynchronous effect.
            status = 2;
          }
          return canceler;
        }

      }(a);
    };
  };
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports._makeVar = function (nonCanceler) {
    return function(success, error) {
      try {
        success({
          consumers: [],
          producers: [],
          error: undefined
        });
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  };

  exports._takeVar = function (nonCanceler, avar) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.producers.length > 0) {
        var producer = avar.producers.shift();

        producer(success, error);
      } else {
        avar.consumers.push({success: success, error: error});
      }

      return nonCanceler;
    };
  };

  exports._putVar = function (nonCanceler, avar, a) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.consumers.length === 0) {
        avar.producers.push(function(success, error) {
          try {
            success(a);
          } catch (err) {
            error(err);
          }
        });

        success({});
      } else {
        var consumer = avar.consumers.shift();

        try {
          consumer.success(a);
        } catch (err) {
          error(err);

          return;
        }

        success({});
      }

      return nonCanceler;
    };
  };

  exports._killVar = function (nonCanceler, avar, e) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else {
        var errors = [];

        avar.error = e;

        while (avar.consumers.length > 0) {
          var consumer = avar.consumers.shift();

          try {
            consumer.error(e);
          } catch (err) {
            errors.push(err);
          }
        }

        if (errors.length > 0) error(errors[0]);
        else success({});
      }

      return nonCanceler;
    };
  };
})(PS["Control.Monad.Aff.Internal"] = PS["Control.Monad.Aff.Internal"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.error = function (msg) {
    return new Error(msg);
  };

  exports.throwException = function (e) {
    return function () {
      throw e;
    };
  };
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Show = PS["Data.Show"];
  var Prelude = PS["Prelude"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Functor = PS["Data.Functor"];
  exports["error"] = $foreign.error;
  exports["throwException"] = $foreign.throwException;
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
    "use strict";

  exports.runFn2 = function (fn) {
    return function (a) {
      return function (b) {
        return fn(a, b);
      };
    };
  };
})(PS["Data.Function.Uncurried"] = PS["Data.Function.Uncurried"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Function.Uncurried"];
  var Data_Unit = PS["Data.Unit"];
  exports["runFn2"] = $foreign.runFn2;
})(PS["Data.Function.Uncurried"] = PS["Data.Function.Uncurried"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Aff.Internal"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  exports["_killVar"] = $foreign._killVar;
  exports["_makeVar"] = $foreign._makeVar;
  exports["_putVar"] = $foreign._putVar;
  exports["_takeVar"] = $foreign._takeVar;
})(PS["Control.Monad.Aff.Internal"] = PS["Control.Monad.Aff.Internal"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Control.Monad.Aff"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Aff_Internal = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Parallel_Class = PS["Control.Parallel.Class"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Monoid = PS["Data.Monoid"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Function = PS["Data.Function"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var runAff = function (ex) {
      return function (f) {
          return function (aff) {
              return $foreign._runAff(ex, f, aff);
          };
      };
  };
  var makeAff$prime = function (h) {
      return $foreign._makeAff(h);
  };
  var functorAff = new Data_Functor.Functor(function (f) {
      return function (fa) {
          return $foreign._fmap(f, fa);
      };
  });
  var fromAVBox = Unsafe_Coerce.unsafeCoerce;
  var attempt = function (aff) {
      return $foreign._attempt(Data_Either.Left.create, Data_Either.Right.create, aff);
  };
  var applyAff = new Control_Apply.Apply(function () {
      return functorAff;
  }, function (ff) {
      return function (fa) {
          return $foreign._bind(alwaysCanceler, ff, function (f) {
              return Data_Functor.map(functorAff)(f)(fa);
          });
      };
  });
  var applicativeAff = new Control_Applicative.Applicative(function () {
      return applyAff;
  }, function (v) {
      return $foreign._pure(nonCanceler, v);
  });
  var nonCanceler = Data_Function["const"](Control_Applicative.pure(applicativeAff)(false));
  var alwaysCanceler = Data_Function["const"](Control_Applicative.pure(applicativeAff)(true));
  var forkAff = function (aff) {
      return $foreign._forkAff(nonCanceler, aff);
  };
  var forkAll = function (dictFoldable) {
      return function (affs) {
          return $foreign._forkAll(nonCanceler, Data_Foldable.foldl(dictFoldable), affs);
      };
  };
  var killVar = function (q) {
      return function (e) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._killVar(nonCanceler, q, e));
      };
  };
  var makeAff = function (h) {
      return makeAff$prime(function (e) {
          return function (a) {
              return Data_Functor.map(Control_Monad_Eff.functorEff)(Data_Function["const"](nonCanceler))(h(e)(a));
          };
      });
  };
  var makeVar = Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._makeVar(nonCanceler));
  var putVar = function (q) {
      return function (a) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._putVar(nonCanceler, q, a));
      };
  };
  var takeVar = function (q) {
      return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal._takeVar(nonCanceler, q));
  };                                                                         
  var bindAff = new Control_Bind.Bind(function () {
      return applyAff;
  }, function (fa) {
      return function (f) {
          return $foreign._bind(alwaysCanceler, fa, f);
      };
  });
  var monadAff = new Control_Monad.Monad(function () {
      return applicativeAff;
  }, function () {
      return bindAff;
  });
  var monadEffAff = new Control_Monad_Eff_Class.MonadEff(function () {
      return monadAff;
  }, function (eff) {
      return $foreign._liftEff(nonCanceler, eff);
  });
  var monadRecAff = new Control_Monad_Rec_Class.MonadRec(function () {
      return monadAff;
  }, function (f) {
      return function (a) {
          return $foreign._tailRecM(Data_Either.isLeft, f, a);
      };
  });
  var monadErrorAff = new Control_Monad_Error_Class.MonadError(function () {
      return monadAff;
  }, function (aff) {
      return function (ex) {
          return Control_Bind.bind(bindAff)(attempt(aff))(Data_Either.either(ex)(Control_Applicative.pure(applicativeAff)));
      };
  }, function (e) {
      return $foreign._throwError(nonCanceler, e);
  });
  var monadParAff = new Control_Parallel_Class.MonadPar(function () {
      return monadAff;
  }, function (f) {
      return function (ma) {
          return function (mb) {
              var putOrKill = function (v) {
                  return Data_Either.either(killVar(v))(putVar(v));
              };
              return Control_Bind.bind(bindAff)(makeVar)(function (v) {
                  return Control_Bind.bind(bindAff)(makeVar)(function (v1) {
                      return Control_Bind.bind(bindAff)(forkAff(Control_Bind.bindFlipped(bindAff)(putOrKill(v))(attempt(ma))))(function (v2) {
                          return Control_Bind.bind(bindAff)(forkAff(Control_Bind.bindFlipped(bindAff)(putOrKill(v1))(attempt(mb))))(function (v3) {
                              return Control_Apply.apply(applyAff)(Data_Functor.map(functorAff)(f)(takeVar(v)))(takeVar(v1));
                          });
                      });
                  });
              });
          };
      };
  });
  exports["attempt"] = attempt;
  exports["forkAff"] = forkAff;
  exports["forkAll"] = forkAll;
  exports["makeAff"] = makeAff;
  exports["nonCanceler"] = nonCanceler;
  exports["runAff"] = runAff;
  exports["functorAff"] = functorAff;
  exports["applyAff"] = applyAff;
  exports["applicativeAff"] = applicativeAff;
  exports["bindAff"] = bindAff;
  exports["monadAff"] = monadAff;
  exports["monadEffAff"] = monadEffAff;
  exports["monadErrorAff"] = monadErrorAff;
  exports["monadRecAff"] = monadRecAff;
  exports["monadParAff"] = monadParAff;
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_Internal_1 = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Aff_Internal_1 = PS["Control.Monad.Aff.Internal"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var fromAVBox = Unsafe_Coerce.unsafeCoerce;
  var makeVar = Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._makeVar(Control_Monad_Aff.nonCanceler));
  var putVar = function (q) {
      return function (a) {
          return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._putVar(Control_Monad_Aff.nonCanceler, q, a));
      };
  };
  var makeVar$prime = function (a) {
      return Control_Bind.bind(Control_Monad_Aff.bindAff)(makeVar)(function (v) {
          return Control_Bind.bind(Control_Monad_Aff.bindAff)(putVar(v)(a))(function () {
              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(v);
          });
      });
  };
  var takeVar = function (q) {
      return Data_Function.apply(fromAVBox)(Control_Monad_Aff_Internal_1._takeVar(Control_Monad_Aff.nonCanceler, q));
  };
  var modifyVar = function (f) {
      return function (v) {
          return Control_Bind.bind(Control_Monad_Aff.bindAff)(takeVar(v))(function ($2) {
              return putVar(v)(f($2));
          });
      };
  };
  exports["makeVar"] = makeVar;
  exports["makeVar'"] = makeVar$prime;
  exports["modifyVar"] = modifyVar;
  exports["putVar"] = putVar;
  exports["takeVar"] = takeVar;
})(PS["Control.Monad.Aff.AVar"] = PS["Control.Monad.Aff.AVar"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var otherwise = true;
  exports["otherwise"] = otherwise;
})(PS["Data.Boolean"] = PS["Data.Boolean"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Generic = PS["Data.Generic"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Control_Category = PS["Control.Category"];        
  var Nil = (function () {
      function Nil() {

      };
      Nil.value = new Nil();
      return Nil;
  })();
  var Cons = (function () {
      function Cons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Cons.create = function (value0) {
          return function (value1) {
              return new Cons(value0, value1);
          };
      };
      return Cons;
  })();
  var singleton = function (a) {
      return new Cons(a, Nil.value);
  };
  var showList = function (dictShow) {
      return new Data_Show.Show(function (v) {
          if (v instanceof Nil) {
              return "Nil";
          };
          if (v instanceof Cons) {
              return "(Cons " + (Data_Show.show(dictShow)(v.value0) + (" " + (Data_Show.show(showList(dictShow))(v.value1) + ")")));
          };
          throw new Error("Failed pattern match at Data.List line 696, column 3 - line 697, column 3: " + [ v.constructor.name ]);
      });
  };
  var semigroupList = new Data_Semigroup.Semigroup(function (v) {
      return function (ys) {
          if (v instanceof Nil) {
              return ys;
          };
          if (v instanceof Cons) {
              return new Cons(v.value0, Data_Semigroup.append(semigroupList)(v.value1)(ys));
          };
          throw new Error("Failed pattern match at Data.List line 719, column 3 - line 719, column 21: " + [ v.constructor.name, ys.constructor.name ]);
      };
  });
  var reverse = (function () {
      var go = function (__copy_acc) {
          return function (__copy_v) {
              var acc = __copy_acc;
              var v = __copy_v;
              tco: while (true) {
                  if (v instanceof Nil) {
                      return acc;
                  };
                  if (v instanceof Cons) {
                      var __tco_acc = new Cons(v.value0, acc);
                      var __tco_v = v.value1;
                      acc = __tco_acc;
                      v = __tco_v;
                      continue tco;
                  };
                  throw new Error("Failed pattern match at Data.List line 346, column 1 - line 349, column 42: " + [ acc.constructor.name, v.constructor.name ]);
              };
          };
      };
      return go(Nil.value);
  })();
  var take = (function () {
      var go = function (__copy_acc) {
          return function (__copy_v) {
              return function (__copy_v1) {
                  var acc = __copy_acc;
                  var v = __copy_v;
                  var v1 = __copy_v1;
                  tco: while (true) {
                      if (v === 0) {
                          return reverse(acc);
                      };
                      if (v1 instanceof Nil) {
                          return reverse(acc);
                      };
                      if (v1 instanceof Cons) {
                          var __tco_acc = new Cons(v1.value0, acc);
                          var __tco_v = v - 1;
                          var __tco_v1 = v1.value1;
                          acc = __tco_acc;
                          v = __tco_v;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      throw new Error("Failed pattern match at Data.List line 474, column 1 - line 478, column 52: " + [ acc.constructor.name, v.constructor.name, v1.constructor.name ]);
                  };
              };
          };
      };
      return go(Nil.value);
  })();
  var zipWith = function (f) {
      return function (xs) {
          return function (ys) {
              var go = function (v) {
                  return function (v1) {
                      return function (acc) {
                          if (v instanceof Nil) {
                              return acc;
                          };
                          if (v1 instanceof Nil) {
                              return acc;
                          };
                          if (v instanceof Cons && v1 instanceof Cons) {
                              return Data_Function.apply(go(v.value1)(v1.value1))(new Cons(f(v.value0)(v1.value0), acc));
                          };
                          throw new Error("Failed pattern match at Data.List line 638, column 1 - line 642, column 63: " + [ v.constructor.name, v1.constructor.name, acc.constructor.name ]);
                      };
                  };
              };
              return Data_Function.apply(reverse)(go(xs)(ys)(Nil.value));
          };
      };
  };                                         
  var range = function (start) {
      return function (end) {
          if (start === end) {
              return singleton(start);
          };
          if (Data_Boolean.otherwise) {
              var go = function (__copy_s) {
                  return function (__copy_e) {
                      return function (__copy_step) {
                          return function (__copy_rest) {
                              var s = __copy_s;
                              var e = __copy_e;
                              var step = __copy_step;
                              var rest = __copy_rest;
                              tco: while (true) {
                                  if (s === e) {
                                      return new Cons(s, rest);
                                  };
                                  if (Data_Boolean.otherwise) {
                                      var __tco_s = s + step | 0;
                                      var __tco_e = e;
                                      var __tco_step = step;
                                      var __tco_rest = new Cons(s, rest);
                                      s = __tco_s;
                                      e = __tco_e;
                                      step = __tco_step;
                                      rest = __tco_rest;
                                      continue tco;
                                  };
                                  throw new Error("Failed pattern match at Data.List line 138, column 1 - line 142, column 68: " + [ s.constructor.name, e.constructor.name, step.constructor.name, rest.constructor.name ]);
                              };
                          };
                      };
                  };
              };
              return go(end)(start)((function () {
                  var $209 = start > end;
                  if ($209) {
                      return 1;
                  };
                  if (!$209) {
                      return -1;
                  };
                  throw new Error("Failed pattern match at Data.List line 139, column 45 - line 139, column 74: " + [ $209.constructor.name ]);
              })())(Nil.value);
          };
          throw new Error("Failed pattern match at Data.List line 138, column 1 - line 142, column 68: " + [ start.constructor.name, end.constructor.name ]);
      };
  };
  var some = function (dictAlternative) {
      return function (dictLazy) {
          return function (v) {
              return Control_Apply.apply((dictAlternative["__superclass_Control.Applicative.Applicative_0"]())["__superclass_Control.Apply.Apply_0"]())(Data_Functor.map(((dictAlternative["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())["__superclass_Data.Functor.Functor_0"]())(Cons.create)(v))(Control_Lazy.defer(dictLazy)(function (v1) {
                  return many(dictAlternative)(dictLazy)(v);
              }));
          };
      };
  };
  var many = function (dictAlternative) {
      return function (dictLazy) {
          return function (v) {
              return Control_Alt.alt((dictAlternative["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())(some(dictAlternative)(dictLazy)(v))(Control_Applicative.pure(dictAlternative["__superclass_Control.Applicative.Applicative_0"]())(Nil.value));
          };
      };
  };
  var index = function (__copy_v) {
      return function (__copy_v1) {
          var v = __copy_v;
          var v1 = __copy_v1;
          tco: while (true) {
              if (v instanceof Nil) {
                  return Data_Maybe.Nothing.value;
              };
              if (v instanceof Cons && v1 === 0) {
                  return new Data_Maybe.Just(v.value0);
              };
              if (v instanceof Cons) {
                  var __tco_v = v.value1;
                  var __tco_v1 = v1 - 1;
                  v = __tco_v;
                  v1 = __tco_v1;
                  continue tco;
              };
              throw new Error("Failed pattern match at Data.List line 262, column 1 - line 262, column 22: " + [ v.constructor.name, v1.constructor.name ]);
          };
      };
  };
  var functorList = new Data_Functor.Functor(function (f) {
      return function (lst) {
          var go = function (v) {
              return function (acc) {
                  if (v instanceof Nil) {
                      return acc;
                  };
                  if (v instanceof Cons) {
                      return Data_Function.apply(go(v.value1))(new Cons(f(v.value0), acc));
                  };
                  throw new Error("Failed pattern match at Data.List line 726, column 3 - line 729, column 48: " + [ v.constructor.name, acc.constructor.name ]);
              };
          };
          return Data_Function.apply(reverse)(go(lst)(Nil.value));
      };
  });
  var foldableList = new Data_Foldable.Foldable(function (dictMonoid) {
      return function (f) {
          return Data_Foldable.foldl(foldableList)(function (acc) {
              return function ($387) {
                  return Data_Semigroup.append(dictMonoid["__superclass_Data.Semigroup.Semigroup_0"]())(acc)(f($387));
              };
          })(Data_Monoid.mempty(dictMonoid));
      };
  }, (function () {
      var go = function (__copy_v) {
          return function (__copy_b) {
              return function (__copy_v1) {
                  var v = __copy_v;
                  var b = __copy_b;
                  var v1 = __copy_v1;
                  tco: while (true) {
                      if (v1 instanceof Nil) {
                          return b;
                      };
                      if (v1 instanceof Cons) {
                          var __tco_v = v;
                          var __tco_b = v(b)(v1.value0);
                          var __tco_v1 = v1.value1;
                          v = __tco_v;
                          b = __tco_b;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      throw new Error("Failed pattern match at Data.List line 734, column 3 - line 737, column 49: " + [ v.constructor.name, b.constructor.name, v1.constructor.name ]);
                  };
              };
          };
      };
      return go;
  })(), function (v) {
      return function (b) {
          return function (v1) {
              if (v1 instanceof Nil) {
                  return b;
              };
              if (v1 instanceof Cons) {
                  return v(v1.value0)(Data_Foldable.foldr(foldableList)(v)(b)(v1.value1));
              };
              throw new Error("Failed pattern match at Data.List line 732, column 3 - line 732, column 20: " + [ v.constructor.name, b.constructor.name, v1.constructor.name ]);
          };
      };
  });
  var length = Data_Foldable.foldl(foldableList)(function (acc) {
      return function (v) {
          return acc + 1 | 0;
      };
  })(0);
  var filter = function (p) {
      var go = function (__copy_acc) {
          return function (__copy_v) {
              var acc = __copy_acc;
              var v = __copy_v;
              tco: while (true) {
                  if (v instanceof Nil) {
                      return reverse(acc);
                  };
                  if (v instanceof Cons) {
                      if (p(v.value0)) {
                          var __tco_acc = new Cons(v.value0, acc);
                          var __tco_v = v.value1;
                          acc = __tco_acc;
                          v = __tco_v;
                          continue tco;
                      };
                      if (Data_Boolean.otherwise) {
                          var __tco_acc = acc;
                          var __tco_v = v.value1;
                          acc = __tco_acc;
                          v = __tco_v;
                          continue tco;
                      };
                  };
                  throw new Error("Failed pattern match at Data.List line 369, column 1 - line 374, column 28: " + [ acc.constructor.name, v.constructor.name ]);
              };
          };
      };
      return go(Nil.value);
  };
  var drop = function (__copy_v) {
      return function (__copy_v1) {
          var v = __copy_v;
          var v1 = __copy_v1;
          tco: while (true) {
              if (v === 0) {
                  return v1;
              };
              if (v1 instanceof Nil) {
                  return Nil.value;
              };
              if (v1 instanceof Cons) {
                  var __tco_v = v - 1;
                  var __tco_v1 = v1.value1;
                  v = __tco_v;
                  v1 = __tco_v1;
                  continue tco;
              };
              throw new Error("Failed pattern match at Data.List line 493, column 1 - line 493, column 15: " + [ v.constructor.name, v1.constructor.name ]);
          };
      };
  };
  var concatMap = function (v) {
      return function (v1) {
          if (v1 instanceof Nil) {
              return Nil.value;
          };
          if (v1 instanceof Cons) {
              return Data_Semigroup.append(semigroupList)(v(v1.value0))(concatMap(v)(v1.value1));
          };
          throw new Error("Failed pattern match at Data.List line 362, column 1 - line 362, column 22: " + [ v.constructor.name, v1.constructor.name ]);
      };
  };                                                                         
  var applyList = new Control_Apply.Apply(function () {
      return functorList;
  }, function (v) {
      return function (v1) {
          if (v instanceof Nil) {
              return Nil.value;
          };
          if (v instanceof Cons) {
              return Data_Semigroup.append(semigroupList)(Data_Functor.map(functorList)(v.value0)(v1))(Control_Apply.apply(applyList)(v.value1)(v1));
          };
          throw new Error("Failed pattern match at Data.List line 754, column 3 - line 754, column 20: " + [ v.constructor.name, v1.constructor.name ]);
      };
  });
  var bindList = new Control_Bind.Bind(function () {
      return applyList;
  }, Data_Function.flip(concatMap));
  var concat = function (v) {
      return Control_Bind.bind(bindList)(v)(Control_Category.id(Control_Category.categoryFn));
  };
  exports["Nil"] = Nil;
  exports["Cons"] = Cons;
  exports["concat"] = concat;
  exports["concatMap"] = concatMap;
  exports["drop"] = drop;
  exports["filter"] = filter;
  exports["index"] = index;
  exports["length"] = length;
  exports["many"] = many;
  exports["range"] = range;
  exports["reverse"] = reverse;
  exports["singleton"] = singleton;
  exports["some"] = some;
  exports["take"] = take;
  exports["zipWith"] = zipWith;
  exports["showList"] = showList;
  exports["semigroupList"] = semigroupList;
  exports["functorList"] = functorList;
  exports["foldableList"] = foldableList;
  exports["applyList"] = applyList;
  exports["bindList"] = bindList;
})(PS["Data.List"] = PS["Data.List"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Tuple = PS["Data.Tuple"];        
  var CatQueue = (function () {
      function CatQueue(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatQueue.create = function (value0) {
          return function (value1) {
              return new CatQueue(value0, value1);
          };
      };
      return CatQueue;
  })();
  var uncons = function (__copy_v) {
      var v = __copy_v;
      tco: while (true) {
          if (v.value0 instanceof Data_List.Nil && v.value1 instanceof Data_List.Nil) {
              return Data_Maybe.Nothing.value;
          };
          if (v.value0 instanceof Data_List.Nil) {
              var __tco_v = new CatQueue(Data_List.reverse(v.value1), Data_List.Nil.value);
              v = __tco_v;
              continue tco;
          };
          if (v.value0 instanceof Data_List.Cons) {
              return new Data_Maybe.Just(new Data_Tuple.Tuple(v.value0.value0, new CatQueue(v.value0.value1, v.value1)));
          };
          throw new Error("Failed pattern match at Data.CatQueue line 51, column 1 - line 51, column 36: " + [ v.constructor.name ]);
      };
  };
  var snoc = function (v) {
      return function (a) {
          return new CatQueue(v.value0, new Data_List.Cons(a, v.value1));
      };
  };
  var $$null = function (v) {
      if (v.value0 instanceof Data_List.Nil && v.value1 instanceof Data_List.Nil) {
          return true;
      };
      return false;
  };
  var empty = new CatQueue(Data_List.Nil.value, Data_List.Nil.value);
  exports["CatQueue"] = CatQueue;
  exports["empty"] = empty;
  exports["null"] = $$null;
  exports["snoc"] = snoc;
  exports["uncons"] = uncons;
})(PS["Data.CatQueue"] = PS["Data.CatQueue"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_CatQueue = PS["Data.CatQueue"];
  var Data_Foldable_1 = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable_1 = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];        
  var CatNil = (function () {
      function CatNil() {

      };
      CatNil.value = new CatNil();
      return CatNil;
  })();
  var CatCons = (function () {
      function CatCons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatCons.create = function (value0) {
          return function (value1) {
              return new CatCons(value0, value1);
          };
      };
      return CatCons;
  })();
  var link = function (v) {
      return function (cat) {
          if (v instanceof CatNil) {
              return cat;
          };
          if (v instanceof CatCons) {
              return new CatCons(v.value0, Data_CatQueue.snoc(v.value1)(cat));
          };
          throw new Error("Failed pattern match at Data.CatList line 111, column 1 - line 111, column 22: " + [ v.constructor.name, cat.constructor.name ]);
      };
  };
  var foldr = function (k) {
      return function (b) {
          return function (q) {
              var foldl = function (__copy_v) {
                  return function (__copy_c) {
                      return function (__copy_v1) {
                          var v = __copy_v;
                          var c = __copy_c;
                          var v1 = __copy_v1;
                          tco: while (true) {
                              if (v1 instanceof Data_List.Nil) {
                                  return c;
                              };
                              if (v1 instanceof Data_List.Cons) {
                                  var __tco_v = v;
                                  var __tco_c = v(c)(v1.value0);
                                  var __tco_v1 = v1.value1;
                                  v = __tco_v;
                                  c = __tco_c;
                                  v1 = __tco_v1;
                                  continue tco;
                              };
                              throw new Error("Failed pattern match at Data.CatList line 126, column 3 - line 126, column 22: " + [ v.constructor.name, c.constructor.name, v1.constructor.name ]);
                          };
                      };
                  };
              };
              var go = function (__copy_xs) {
                  return function (__copy_ys) {
                      var xs = __copy_xs;
                      var ys = __copy_ys;
                      tco: while (true) {
                          var $33 = Data_CatQueue.uncons(xs);
                          if ($33 instanceof Data_Maybe.Nothing) {
                              return foldl(function (x) {
                                  return function (i) {
                                      return i(x);
                                  };
                              })(b)(ys);
                          };
                          if ($33 instanceof Data_Maybe.Just) {
                              var __tco_ys = new Data_List.Cons(k($33.value0.value0), ys);
                              xs = $33.value0.value1;
                              ys = __tco_ys;
                              continue tco;
                          };
                          throw new Error("Failed pattern match at Data.CatList line 121, column 14 - line 123, column 67: " + [ $33.constructor.name ]);
                      };
                  };
              };
              return go(q)(Data_List.Nil.value);
          };
      };
  };
  var uncons = function (v) {
      if (v instanceof CatNil) {
          return Data_Maybe.Nothing.value;
      };
      if (v instanceof CatCons) {
          return new Data_Maybe.Just(new Data_Tuple.Tuple(v.value0, (function () {
              var $38 = Data_CatQueue["null"](v.value1);
              if ($38) {
                  return CatNil.value;
              };
              if (!$38) {
                  return foldr(link)(CatNil.value)(v.value1);
              };
              throw new Error("Failed pattern match at Data.CatList line 103, column 39 - line 103, column 89: " + [ $38.constructor.name ]);
          })()));
      };
      throw new Error("Failed pattern match at Data.CatList line 102, column 1 - line 102, column 24: " + [ v.constructor.name ]);
  }; 
  var empty = CatNil.value;
  var append = function (v) {
      return function (v1) {
          if (v1 instanceof CatNil) {
              return v;
          };
          if (v instanceof CatNil) {
              return v1;
          };
          return link(v)(v1);
      };
  }; 
  var semigroupCatList = new Data_Semigroup.Semigroup(append);
  var snoc = function (cat) {
      return function (a) {
          return append(cat)(new CatCons(a, Data_CatQueue.empty));
      };
  };
  exports["CatNil"] = CatNil;
  exports["CatCons"] = CatCons;
  exports["append"] = append;
  exports["empty"] = empty;
  exports["snoc"] = snoc;
  exports["uncons"] = uncons;
  exports["semigroupCatList"] = semigroupCatList;
})(PS["Data.CatList"] = PS["Data.CatList"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_CatList = PS["Data.CatList"];
  var Data_Either = PS["Data.Either"];
  var Data_Inject = PS["Data.Inject"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Free = (function () {
      function Free(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Free.create = function (value0) {
          return function (value1) {
              return new Free(value0, value1);
          };
      };
      return Free;
  })();
  var Return = (function () {
      function Return(value0) {
          this.value0 = value0;
      };
      Return.create = function (value0) {
          return new Return(value0);
      };
      return Return;
  })();
  var Bind = (function () {
      function Bind(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bind.create = function (value0) {
          return function (value1) {
              return new Bind(value0, value1);
          };
      };
      return Bind;
  })();
  var toView = function (__copy_v) {
      var v = __copy_v;
      tco: while (true) {
          var runExpF = function (v2) {
              return v2;
          };
          var concatF = function (v2) {
              return function (r) {
                  return new Free(v2.value0, Data_Semigroup.append(Data_CatList.semigroupCatList)(v2.value1)(r));
              };
          };
          if (v.value0 instanceof Return) {
              var $20 = Data_CatList.uncons(v.value1);
              if ($20 instanceof Data_Maybe.Nothing) {
                  return new Return(Unsafe_Coerce.unsafeCoerce(v.value0.value0));
              };
              if ($20 instanceof Data_Maybe.Just) {
                  var __tco_v = Unsafe_Coerce.unsafeCoerce(concatF(runExpF($20.value0.value0)(v.value0.value0))($20.value0.value1));
                  v = __tco_v;
                  continue tco;
              };
              throw new Error("Failed pattern match at Control.Monad.Free line 171, column 7 - line 175, column 64: " + [ $20.constructor.name ]);
          };
          if (v.value0 instanceof Bind) {
              return new Bind(v.value0.value0, function (a) {
                  return Unsafe_Coerce.unsafeCoerce(concatF(v.value0.value1(a))(v.value1));
              });
          };
          throw new Error("Failed pattern match at Control.Monad.Free line 169, column 3 - line 177, column 56: " + [ v.value0.constructor.name ]);
      };
  };
  var runFreeM = function (dictFunctor) {
      return function (dictMonadRec) {
          return function (k) {
              var go = function (f) {
                  var $29 = toView(f);
                  if ($29 instanceof Return) {
                      return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Right.create)(Control_Applicative.pure((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Applicative.Applicative_0"]())($29.value0));
                  };
                  if ($29 instanceof Bind) {
                      return Data_Functor.map((((dictMonadRec["__superclass_Control.Monad.Monad_0"]())["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Data_Either.Left.create)(k(Data_Functor.map(dictFunctor)($29.value1)($29.value0)));
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free line 147, column 10 - line 149, column 37: " + [ $29.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(dictMonadRec)(go);
          };
      };
  };
  var fromView = function (f) {
      return new Free(Unsafe_Coerce.unsafeCoerce(f), Data_CatList.empty);
  };
  var freeMonad = new Control_Monad.Monad(function () {
      return freeApplicative;
  }, function () {
      return freeBind;
  });
  var freeFunctor = new Data_Functor.Functor(function (k) {
      return function (f) {
          return Control_Bind.bindFlipped(freeBind)(function ($53) {
              return Control_Applicative.pure(freeApplicative)(k($53));
          })(f);
      };
  });
  var freeBind = new Control_Bind.Bind(function () {
      return freeApply;
  }, function (v) {
      return function (k) {
          return new Free(v.value0, Data_CatList.snoc(v.value1)(Unsafe_Coerce.unsafeCoerce(k)));
      };
  });
  var freeApply = new Control_Apply.Apply(function () {
      return freeFunctor;
  }, Control_Monad.ap(freeMonad));
  var freeApplicative = new Control_Applicative.Applicative(function () {
      return freeApply;
  }, function ($54) {
      return fromView(Return.create($54));
  });
  var liftF = function (f) {
      return fromView(new Bind(Unsafe_Coerce.unsafeCoerce(f), function ($55) {
          return Control_Applicative.pure(freeApplicative)(Unsafe_Coerce.unsafeCoerce($55));
      }));
  };
  exports["liftF"] = liftF;
  exports["runFreeM"] = runFreeM;
  exports["freeFunctor"] = freeFunctor;
  exports["freeBind"] = freeBind;
  exports["freeApplicative"] = freeApplicative;
  exports["freeApply"] = freeApply;
  exports["freeMonad"] = freeMonad;
})(PS["Control.Monad.Free"] = PS["Control.Monad.Free"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var StateT = function (x) {
      return x;
  }; 
  var functorStateT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (v) {
              return function (s) {
                  return Data_Functor.map(dictFunctor)(function (v1) {
                      return new Data_Tuple.Tuple(f(v1.value0), v1.value1);
                  })(v(s));
              };
          };
      });
  };
  var monadStateT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeStateT(dictMonad);
      }, function () {
          return bindStateT(dictMonad);
      });
  };
  var bindStateT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyStateT(dictMonad);
      }, function (v) {
          return function (f) {
              return function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(v(s))(function (v1) {
                      var $60 = f(v1.value0);
                      return $60(v1.value1);
                  });
              };
          };
      });
  };
  var applyStateT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorStateT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, Control_Monad.ap(monadStateT(dictMonad)));
  };
  var applicativeStateT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyStateT(dictMonad);
      }, function (a) {
          return function (s) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))(new Data_Tuple.Tuple(a, s));
          };
      });
  };
  var monadStateStateT = function (dictMonad) {
      return new Control_Monad_State_Class.MonadState(function () {
          return monadStateT(dictMonad);
      }, function (f) {
          return Data_Function.apply(StateT)(function ($95) {
              return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(f($95));
          });
      });
  };
  exports["StateT"] = StateT;
  exports["functorStateT"] = functorStateT;
  exports["applyStateT"] = applyStateT;
  exports["applicativeStateT"] = applicativeStateT;
  exports["bindStateT"] = bindStateT;
  exports["monadStateT"] = monadStateT;
  exports["monadStateStateT"] = monadStateStateT;
})(PS["Control.Monad.State.Trans"] = PS["Control.Monad.State.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var runState = function (v) {
      return function ($14) {
          return Data_Identity.runIdentity(v($14));
      };
  };
  exports["runState"] = runState;
})(PS["Control.Monad.State"] = PS["Control.Monad.State"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var runWriter = function ($0) {
      return Data_Identity.runIdentity(Control_Monad_Writer_Trans.runWriterT($0));
  };
  exports["runWriter"] = runWriter;
})(PS["Control.Monad.Writer"] = PS["Control.Monad.Writer"] || {});
(function(exports) {
    "use strict";

  exports.eventListener = function (fn) {
    return function (event) {
      return fn(event)();
    };
  };

  exports.addEventListener = function (type) {
    return function (listener) {
      return function (useCapture) {
        return function (target) {
          return function () {
            target.addEventListener(type, listener, useCapture);
            return {};
          };
        };
      };
    };
  };
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Event.EventTarget"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var DOM = PS["DOM"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  exports["addEventListener"] = $foreign.addEventListener;
  exports["eventListener"] = $foreign.eventListener;
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  /* global window */
  "use strict";

  exports.window = function () {
    return window;
  };
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
    "use strict";

  exports._readHTMLElement = function (failure) {
    return function (success) {
      return function (value) {
        var tag = Object.prototype.toString.call(value);
        if (tag.indexOf("[object HTML") === 0 && tag.indexOf("Element]") === tag.length - 8) {
          return success(value);
        } else {
          return failure(tag);
        }
      };
    };
  };
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  /* global exports */
  "use strict";
  // jshint maxparams: 1

  exports.toForeign = function (value) {
    return value;
  };

  exports.unsafeFromForeign = function (value) {
    return value;
  };

  exports.typeOf = function (value) {
    return typeof value;
  };

  exports.tagOf = function (value) {
    return Object.prototype.toString.call(value).slice(8, -1);
  };

  exports.isNull = function (value) {
    return value === null;
  };

  exports.isUndefined = function (value) {
    return value === undefined;
  };
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
    "use strict";

  // module Data.Int

  exports.fromNumberImpl = function (just) {
    return function (nothing) {
      return function (n) {
        /* jshint bitwise: false */
        return (n | 0) === n ? just(n) : nothing;
      };
    };
  };

  exports.toNumber = function (n) {
    return n;
  };

  exports.fromStringAsImpl = function (just) {
    return function (nothing) {
      return function (radix) {
        var digits;
        if (radix < 11) {
          digits = "[0-" + (radix - 1).toString() + "]";
        } else if (radix === 11) {
          digits = "[0-9a]";
        } else {
          digits = "[0-9a-" + String.fromCharCode(86 + radix) + "]";
        }
        var pattern = new RegExp("^[\\+\\-]?" + digits + "+$", "i");

        return function (s) {
          /* jshint bitwise: false */
          if (pattern.test(s)) {
            var i = parseInt(s, radix);
            return (i | 0) === i ? just(i) : nothing;
          } else {
            return nothing;
          }
        };
      };
    };
  };
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
    "use strict";

  exports.remainder = function (n) {
    return function (m) {
      return n % m;
    };
  };

  exports.round = Math.round;
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Math"];
  exports["remainder"] = $foreign.remainder;
  exports["round"] = $foreign.round;
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Int"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Function = PS["Data.Function"];
  var Data_Int_Bits = PS["Data.Int.Bits"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Ord = PS["Data.Ord"];
  var $$Math = PS["Math"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var fromStringAs = $foreign.fromStringAsImpl(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var fromString = fromStringAs(10);
  var fromNumber = $foreign.fromNumberImpl(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var unsafeClamp = function (x) {
      if (x >= $foreign.toNumber(Data_Bounded.top(Data_Bounded.boundedInt))) {
          return Data_Bounded.top(Data_Bounded.boundedInt);
      };
      if (x <= $foreign.toNumber(Data_Bounded.bottom(Data_Bounded.boundedInt))) {
          return Data_Bounded.bottom(Data_Bounded.boundedInt);
      };
      if (Data_Boolean.otherwise) {
          return Partial_Unsafe.unsafePartial(function (dictPartial) {
              return Data_Maybe.fromJust(dictPartial)(fromNumber(x));
          });
      };
      throw new Error("Failed pattern match at Data.Int line 65, column 1 - line 68, column 56: " + [ x.constructor.name ]);
  };
  var round = function ($3) {
      return unsafeClamp($$Math.round($3));
  };
  exports["fromNumber"] = fromNumber;
  exports["fromString"] = fromString;
  exports["fromStringAs"] = fromStringAs;
  exports["round"] = round;
  exports["toNumber"] = $foreign.toNumber;
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.String

  exports._charAt = function (just) {
    return function (nothing) {
      return function (i) {
        return function (s) {
          return i >= 0 && i < s.length ? just(s.charAt(i)) : nothing;
        };
      };
    };
  };

  exports.singleton = function (c) {
    return c;
  };

  exports._indexOf = function (just) {
    return function (nothing) {
      return function (x) {
        return function (s) {
          var i = s.indexOf(x);
          return i === -1 ? nothing : just(i);
        };
      };
    };
  };

  exports.length = function (s) {
    return s.length;
  };

  exports.drop = function (n) {
    return function (s) {
      return s.substring(n);
    };
  };

  exports.split = function (sep) {
    return function (s) {
      return s.split(sep);
    };
  };
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.String"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String_Unsafe = PS["Data.String.Unsafe"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Function = PS["Data.Function"];                                                    
  var indexOf = $foreign._indexOf(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);      
  var charAt = $foreign._charAt(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  exports["charAt"] = charAt;
  exports["indexOf"] = indexOf;
  exports["drop"] = $foreign.drop;
  exports["length"] = $foreign.length;
  exports["singleton"] = $foreign.singleton;
  exports["split"] = $foreign.split;
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foreign"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Int = PS["Data.Int"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ordering = PS["Data.Ordering"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Function = PS["Data.Function"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var TypeMismatch = (function () {
      function TypeMismatch(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      TypeMismatch.create = function (value0) {
          return function (value1) {
              return new TypeMismatch(value0, value1);
          };
      };
      return TypeMismatch;
  })();
  var ErrorAtProperty = (function () {
      function ErrorAtProperty(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      ErrorAtProperty.create = function (value0) {
          return function (value1) {
              return new ErrorAtProperty(value0, value1);
          };
      };
      return ErrorAtProperty;
  })();
  var unsafeReadTagged = function (tag) {
      return function (value) {
          if ($foreign.tagOf(value) === tag) {
              return Control_Applicative.pure(Data_Either.applicativeEither)($foreign.unsafeFromForeign(value));
          };
          return new Data_Either.Left(new TypeMismatch(tag, $foreign.tagOf(value)));
      };
  }; 
  var readString = unsafeReadTagged("String");
  var readBoolean = unsafeReadTagged("Boolean");
  exports["TypeMismatch"] = TypeMismatch;
  exports["ErrorAtProperty"] = ErrorAtProperty;
  exports["readBoolean"] = readBoolean;
  exports["readString"] = readString;
  exports["unsafeReadTagged"] = unsafeReadTagged;
  exports["isNull"] = $foreign.isNull;
  exports["isUndefined"] = $foreign.isUndefined;
  exports["toForeign"] = $foreign.toForeign;
  exports["typeOf"] = $foreign.typeOf;
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.snoc = function (l) {
    return function (e) {
      var l1 = l.slice();
      l1.push(e);
      return l1;
    };
  };

  //------------------------------------------------------------------------------
  // Subarrays -------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.slice = function (s) {
    return function (e) {
      return function (l) {
        return l.slice(s, e);
      };
    };
  };
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Array"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Data_Function = PS["Data.Function"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Category = PS["Control.Category"];
  exports["snoc"] = $foreign.snoc;
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // jshint maxparams: 4
  exports.unsafeReadPropImpl = function (f, s, key, value) {
    return value == null ? f : s(value[key]);
  };

  // jshint maxparams: 2
  exports.unsafeHasOwnProperty = function (prop, value) {
    return Object.prototype.hasOwnProperty.call(value, prop);
  };

  exports.unsafeHasProperty = function (prop, value) {
    return prop in value;
  };
})(PS["Data.Foreign.Index"] = PS["Data.Foreign.Index"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Foreign.Index"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];        
  var Index = function (errorAt, hasOwnProperty, hasProperty, ix) {
      this.errorAt = errorAt;
      this.hasOwnProperty = hasOwnProperty;
      this.hasProperty = hasProperty;
      this.ix = ix;
  };
  var unsafeReadProp = function (k) {
      return function (value) {
          return $foreign.unsafeReadPropImpl(new Data_Either.Left(new Data_Foreign.TypeMismatch("object", Data_Foreign.typeOf(value))), Control_Applicative.pure(Data_Either.applicativeEither), k, value);
      };
  };
  var prop = unsafeReadProp;
  var ix = function (dict) {
      return dict.ix;
  };                         
  var hasPropertyImpl = function (v) {
      return function (value) {
          if (Data_Foreign.isNull(value)) {
              return false;
          };
          if (Data_Foreign.isUndefined(value)) {
              return false;
          };
          if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
              return $foreign.unsafeHasProperty(v, value);
          };
          return false;
      };
  };
  var hasProperty = function (dict) {
      return dict.hasProperty;
  };
  var hasOwnPropertyImpl = function (v) {
      return function (value) {
          if (Data_Foreign.isNull(value)) {
              return false;
          };
          if (Data_Foreign.isUndefined(value)) {
              return false;
          };
          if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
              return $foreign.unsafeHasOwnProperty(v, value);
          };
          return false;
      };
  };                                                                                                                         
  var indexString = new Index(Data_Foreign.ErrorAtProperty.create, hasOwnPropertyImpl, hasPropertyImpl, Data_Function.flip(prop));
  var hasOwnProperty = function (dict) {
      return dict.hasOwnProperty;
  };
  var errorAt = function (dict) {
      return dict.errorAt;
  };
  exports["Index"] = Index;
  exports["errorAt"] = errorAt;
  exports["hasOwnProperty"] = hasOwnProperty;
  exports["hasProperty"] = hasProperty;
  exports["ix"] = ix;
  exports["prop"] = prop;
  exports["indexString"] = indexString;
})(PS["Data.Foreign.Index"] = PS["Data.Foreign.Index"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Index = PS["Data.Foreign.Index"];
  var Data_Foreign_Null = PS["Data.Foreign.Null"];
  var Data_Foreign_NullOrUndefined = PS["Data.Foreign.NullOrUndefined"];
  var Data_Foreign_Undefined = PS["Data.Foreign.Undefined"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Semiring = PS["Data.Semiring"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];        
  var IsForeign = function (read) {
      this.read = read;
  };
  var stringIsForeign = new IsForeign(Data_Foreign.readString);
  var read = function (dict) {
      return dict.read;
  };
  var readWith = function (dictIsForeign) {
      return function (f) {
          return function (value) {
              return Data_Either.either(function ($19) {
                  return Data_Either.Left.create(f($19));
              })(Data_Either.Right.create)(read(dictIsForeign)(value));
          };
      };
  };
  var readProp = function (dictIsForeign) {
      return function (dictIndex) {
          return function (prop) {
              return function (value) {
                  return Control_Bind.bind(Data_Either.bindEither)(Data_Foreign_Index.ix(dictIndex)(value)(prop))(readWith(dictIsForeign)(Data_Foreign_Index.errorAt(dictIndex)(prop)));
              };
          };
      };
  };                                                        
  var booleanIsForeign = new IsForeign(Data_Foreign.readBoolean);
  exports["IsForeign"] = IsForeign;
  exports["read"] = read;
  exports["readProp"] = readProp;
  exports["readWith"] = readWith;
  exports["stringIsForeign"] = stringIsForeign;
  exports["booleanIsForeign"] = booleanIsForeign;
})(PS["Data.Foreign.Class"] = PS["Data.Foreign.Class"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML.Types"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Class = PS["Data.Foreign.Class"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var windowToEventTarget = Unsafe_Coerce.unsafeCoerce;                        
  var readHTMLElement = $foreign._readHTMLElement(function ($0) {
      return Data_Either.Left.create(Data_Foreign.TypeMismatch.create("HTMLElement")($0));
  })(Data_Either.Right.create);                                          
  var htmlElementToNode = Unsafe_Coerce.unsafeCoerce;   
  var htmlDocumentToParentNode = Unsafe_Coerce.unsafeCoerce;
  exports["htmlDocumentToParentNode"] = htmlDocumentToParentNode;
  exports["htmlElementToNode"] = htmlElementToNode;
  exports["readHTMLElement"] = readHTMLElement;
  exports["windowToEventTarget"] = windowToEventTarget;
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["window"] = $foreign.window;
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var load = "load";
  exports["load"] = load;
})(PS["DOM.HTML.Event.EventTypes"] = PS["DOM.HTML.Event.EventTypes"] || {});
(function(exports) {
    "use strict";

  exports.document = function (window) {
    return function () {
      return window.document;
    };
  };
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.HTML.Window"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["document"] = $foreign.document;
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
    "use strict";

  exports.appendChild = function (node) {
    return function (parent) {
      return function () {
        return parent.appendChild(node);
      };
    };
  };
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports["null"] = null;

  exports.nullable = function(a, r, f) {
      return a == null ? r : f(a);
  };

  exports.notNull = function(x) {
      return x;
  };
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Nullable"];
  var Prelude = PS["Prelude"];
  var Data_Function = PS["Data.Function"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Show = PS["Data.Show"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ord = PS["Data.Ord"];        
  var toNullable = Data_Maybe.maybe($foreign["null"])($foreign.notNull);
  var toMaybe = function (n) {
      return $foreign.nullable(n, Data_Maybe.Nothing.value, Data_Maybe.Just.create);
  };
  exports["toMaybe"] = toMaybe;
  exports["toNullable"] = toNullable;
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Node.Node"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Enum = PS["Data.Enum"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Maybe = PS["Data.Maybe"];
  var DOM = PS["DOM"];
  var DOM_Node_NodeType = PS["DOM.Node.NodeType"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  exports["appendChild"] = $foreign.appendChild;
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
    "use strict";                                             

  exports.querySelector = function (selector) {
    return function (node) {
      return function () {
        return node.querySelector(selector);
      };
    };
  };
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["DOM.Node.ParentNode"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Nullable = PS["Data.Nullable"];
  var DOM = PS["DOM"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  exports["querySelector"] = $foreign.querySelector;
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Char

  exports.toCharCode = function (c) {
    return c.charCodeAt(0);
  };
})(PS["Data.Char"] = PS["Data.Char"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Char"];
  exports["toCharCode"] = $foreign.toCharCode;
})(PS["Data.Char"] = PS["Data.Char"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Char = PS["Data.Char"];
  var Data_Char_Unicode_Internal = PS["Data.Char.Unicode.Internal"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Show = PS["Data.Show"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Bounded = PS["Data.Bounded"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Function = PS["Data.Function"];
  var Data_Ring = PS["Data.Ring"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Boolean = PS["Data.Boolean"];
  var isDigit = function (c) {
      var diff = Data_Char.toCharCode(c) - Data_Char.toCharCode("0");
      return diff <= 9 && diff >= 0;
  };
  exports["isDigit"] = isDigit;
})(PS["Data.Char.Unicode"] = PS["Data.Char.Unicode"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Unsafe_Coerce = PS["Unsafe.Coerce"];        
  var runExistsR = Unsafe_Coerce.unsafeCoerce;
  var mkExistsR = Unsafe_Coerce.unsafeCoerce;
  exports["mkExistsR"] = mkExistsR;
  exports["runExistsR"] = runExistsR;
})(PS["Data.ExistsR"] = PS["Data.ExistsR"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Lazy

  exports.defer = function () {

    function Defer(thunk) {
      if (this instanceof Defer) {
        this.thunk = thunk;
        return this;
      } else {
        return new Defer(thunk);
      }
    }

    Defer.prototype.force = function () {
      var value = this.thunk();
      this.thunk = null;
      this.force = function () {
        return value;
      };
      return value;
    };

    return Defer;

  }();

  exports.force = function (l) {
    return l.force();
  };
})(PS["Data.Lazy"] = PS["Data.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Data.Lazy"];
  var Prelude = PS["Prelude"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Lazy = PS["Control.Lazy"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Ring = PS["Data.Ring"];
  var Data_CommutativeRing = PS["Data.CommutativeRing"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Field = PS["Data.Field"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Bounded = PS["Data.Bounded"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Monad = PS["Control.Monad"];
  var Data_Show = PS["Data.Show"];
  var Data_Unit = PS["Data.Unit"];
  exports["defer"] = $foreign.defer;
  exports["force"] = $foreign.force;
})(PS["Data.Lazy"] = PS["Data.Lazy"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Function = PS["Data.Function"];
  var Data_Semiring = PS["Data.Semiring"];        
  var Leaf = (function () {
      function Leaf() {

      };
      Leaf.value = new Leaf();
      return Leaf;
  })();
  var Two = (function () {
      function Two(value0, value1, value2, value3) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
      };
      Two.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return new Two(value0, value1, value2, value3);
                  };
              };
          };
      };
      return Two;
  })();
  var Three = (function () {
      function Three(value0, value1, value2, value3, value4, value5, value6) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
          this.value4 = value4;
          this.value5 = value5;
          this.value6 = value6;
      };
      Three.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return function (value4) {
                          return function (value5) {
                              return function (value6) {
                                  return new Three(value0, value1, value2, value3, value4, value5, value6);
                              };
                          };
                      };
                  };
              };
          };
      };
      return Three;
  })();
  var TwoLeft = (function () {
      function TwoLeft(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      TwoLeft.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new TwoLeft(value0, value1, value2);
              };
          };
      };
      return TwoLeft;
  })();
  var TwoRight = (function () {
      function TwoRight(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      TwoRight.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new TwoRight(value0, value1, value2);
              };
          };
      };
      return TwoRight;
  })();
  var ThreeLeft = (function () {
      function ThreeLeft(value0, value1, value2, value3, value4, value5) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
          this.value4 = value4;
          this.value5 = value5;
      };
      ThreeLeft.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return function (value4) {
                          return function (value5) {
                              return new ThreeLeft(value0, value1, value2, value3, value4, value5);
                          };
                      };
                  };
              };
          };
      };
      return ThreeLeft;
  })();
  var ThreeMiddle = (function () {
      function ThreeMiddle(value0, value1, value2, value3, value4, value5) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
          this.value4 = value4;
          this.value5 = value5;
      };
      ThreeMiddle.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return function (value4) {
                          return function (value5) {
                              return new ThreeMiddle(value0, value1, value2, value3, value4, value5);
                          };
                      };
                  };
              };
          };
      };
      return ThreeMiddle;
  })();
  var ThreeRight = (function () {
      function ThreeRight(value0, value1, value2, value3, value4, value5) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
          this.value4 = value4;
          this.value5 = value5;
      };
      ThreeRight.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return function (value4) {
                          return function (value5) {
                              return new ThreeRight(value0, value1, value2, value3, value4, value5);
                          };
                      };
                  };
              };
          };
      };
      return ThreeRight;
  })();
  var KickUp = (function () {
      function KickUp(value0, value1, value2, value3) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
      };
      KickUp.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return new KickUp(value0, value1, value2, value3);
                  };
              };
          };
      };
      return KickUp;
  })();
  var lookup = function (dictOrd) {
      return Partial_Unsafe.unsafePartial(function (dictPartial) {
          return function (k) {
              return function (tree) {
                  if (tree instanceof Leaf) {
                      return Data_Maybe.Nothing.value;
                  };
                  var comp = Data_Ord.compare(dictOrd);
                  var __unused = function (dictPartial1) {
                      return function ($dollar37) {
                          return $dollar37;
                      };
                  };
                  return __unused(dictPartial)((function () {
                      if (tree instanceof Two) {
                          var $162 = comp(k)(tree.value1);
                          if ($162 instanceof Data_Ordering.EQ) {
                              return new Data_Maybe.Just(tree.value2);
                          };
                          if ($162 instanceof Data_Ordering.LT) {
                              return lookup(dictOrd)(k)(tree.value0);
                          };
                          return lookup(dictOrd)(k)(tree.value3);
                      };
                      if (tree instanceof Three) {
                          var $167 = comp(k)(tree.value1);
                          if ($167 instanceof Data_Ordering.EQ) {
                              return new Data_Maybe.Just(tree.value2);
                          };
                          var $169 = comp(k)(tree.value4);
                          if ($169 instanceof Data_Ordering.EQ) {
                              return new Data_Maybe.Just(tree.value5);
                          };
                          if ($167 instanceof Data_Ordering.LT) {
                              return lookup(dictOrd)(k)(tree.value0);
                          };
                          if ($169 instanceof Data_Ordering.GT) {
                              return lookup(dictOrd)(k)(tree.value6);
                          };
                          return lookup(dictOrd)(k)(tree.value3);
                      };
                      throw new Error("Failed pattern match at Data.Map line 133, column 10 - line 147, column 39: " + [ tree.constructor.name ]);
                  })());
              };
          };
      });
  }; 
  var fromZipper = function (__copy_dictOrd) {
      return function (__copy_v) {
          return function (__copy_tree) {
              var dictOrd = __copy_dictOrd;
              var v = __copy_v;
              var tree = __copy_tree;
              tco: while (true) {
                  if (v instanceof Data_List.Nil) {
                      return tree;
                  };
                  if (v instanceof Data_List.Cons) {
                      if (v.value0 instanceof TwoLeft) {
                          var __tco_dictOrd = dictOrd;
                          var __tco_v = v.value1;
                          var __tco_tree = new Two(tree, v.value0.value0, v.value0.value1, v.value0.value2);
                          dictOrd = __tco_dictOrd;
                          v = __tco_v;
                          tree = __tco_tree;
                          continue tco;
                      };
                      if (v.value0 instanceof TwoRight) {
                          var __tco_dictOrd = dictOrd;
                          var __tco_v = v.value1;
                          var __tco_tree = new Two(v.value0.value0, v.value0.value1, v.value0.value2, tree);
                          dictOrd = __tco_dictOrd;
                          v = __tco_v;
                          tree = __tco_tree;
                          continue tco;
                      };
                      if (v.value0 instanceof ThreeLeft) {
                          var __tco_dictOrd = dictOrd;
                          var __tco_v = v.value1;
                          var __tco_tree = new Three(tree, v.value0.value0, v.value0.value1, v.value0.value2, v.value0.value3, v.value0.value4, v.value0.value5);
                          dictOrd = __tco_dictOrd;
                          v = __tco_v;
                          tree = __tco_tree;
                          continue tco;
                      };
                      if (v.value0 instanceof ThreeMiddle) {
                          var __tco_dictOrd = dictOrd;
                          var __tco_v = v.value1;
                          var __tco_tree = new Three(v.value0.value0, v.value0.value1, v.value0.value2, tree, v.value0.value3, v.value0.value4, v.value0.value5);
                          dictOrd = __tco_dictOrd;
                          v = __tco_v;
                          tree = __tco_tree;
                          continue tco;
                      };
                      if (v.value0 instanceof ThreeRight) {
                          var __tco_dictOrd = dictOrd;
                          var __tco_v = v.value1;
                          var __tco_tree = new Three(v.value0.value0, v.value0.value1, v.value0.value2, v.value0.value3, v.value0.value4, v.value0.value5, tree);
                          dictOrd = __tco_dictOrd;
                          v = __tco_v;
                          tree = __tco_tree;
                          continue tco;
                      };
                      throw new Error("Failed pattern match at Data.Map line 224, column 3 - line 229, column 88: " + [ v.value0.constructor.name ]);
                  };
                  throw new Error("Failed pattern match at Data.Map line 222, column 1 - line 222, column 27: " + [ v.constructor.name, tree.constructor.name ]);
              };
          };
      };
  };
  var insert = function (dictOrd) {
      var up = function (__copy_v) {
          return function (__copy_v1) {
              var v = __copy_v;
              var v1 = __copy_v1;
              tco: while (true) {
                  if (v instanceof Data_List.Nil) {
                      return new Two(v1.value0, v1.value1, v1.value2, v1.value3);
                  };
                  if (v instanceof Data_List.Cons) {
                      if (v.value0 instanceof TwoLeft) {
                          return fromZipper(dictOrd)(v.value1)(new Three(v1.value0, v1.value1, v1.value2, v1.value3, v.value0.value0, v.value0.value1, v.value0.value2));
                      };
                      if (v.value0 instanceof TwoRight) {
                          return fromZipper(dictOrd)(v.value1)(new Three(v.value0.value0, v.value0.value1, v.value0.value2, v1.value0, v1.value1, v1.value2, v1.value3));
                      };
                      if (v.value0 instanceof ThreeLeft) {
                          var __tco_v = v.value1;
                          var __tco_v1 = new KickUp(new Two(v1.value0, v1.value1, v1.value2, v1.value3), v.value0.value0, v.value0.value1, new Two(v.value0.value2, v.value0.value3, v.value0.value4, v.value0.value5));
                          v = __tco_v;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      if (v.value0 instanceof ThreeMiddle) {
                          var __tco_v = v.value1;
                          var __tco_v1 = new KickUp(new Two(v.value0.value0, v.value0.value1, v.value0.value2, v1.value0), v1.value1, v1.value2, new Two(v1.value3, v.value0.value3, v.value0.value4, v.value0.value5));
                          v = __tco_v;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      if (v.value0 instanceof ThreeRight) {
                          var __tco_v = v.value1;
                          var __tco_v1 = new KickUp(new Two(v.value0.value0, v.value0.value1, v.value0.value2, v.value0.value3), v.value0.value4, v.value0.value5, new Two(v1.value0, v1.value1, v1.value2, v1.value3));
                          v = __tco_v;
                          v1 = __tco_v1;
                          continue tco;
                      };
                      throw new Error("Failed pattern match at Data.Map line 260, column 5 - line 265, column 104: " + [ v.value0.constructor.name, v1.constructor.name ]);
                  };
                  throw new Error("Failed pattern match at Data.Map line 258, column 3 - line 258, column 54: " + [ v.constructor.name, v1.constructor.name ]);
              };
          };
      };
      var comp = Data_Ord.compare(dictOrd);
      var down = function (__copy_ctx) {
          return function (__copy_k) {
              return function (__copy_v) {
                  return function (__copy_v1) {
                      var ctx = __copy_ctx;
                      var k = __copy_k;
                      var v = __copy_v;
                      var v1 = __copy_v1;
                      tco: while (true) {
                          if (v1 instanceof Leaf) {
                              return up(ctx)(new KickUp(Leaf.value, k, v, Leaf.value));
                          };
                          if (v1 instanceof Two) {
                              var $290 = comp(k)(v1.value1);
                              if ($290 instanceof Data_Ordering.EQ) {
                                  return fromZipper(dictOrd)(ctx)(new Two(v1.value0, k, v, v1.value3));
                              };
                              if ($290 instanceof Data_Ordering.LT) {
                                  var __tco_ctx = new Data_List.Cons(new TwoLeft(v1.value1, v1.value2, v1.value3), ctx);
                                  var __tco_k = k;
                                  var __tco_v = v;
                                  var __tco_v1 = v1.value0;
                                  ctx = __tco_ctx;
                                  k = __tco_k;
                                  v = __tco_v;
                                  v1 = __tco_v1;
                                  continue tco;
                              };
                              var __tco_ctx = new Data_List.Cons(new TwoRight(v1.value0, v1.value1, v1.value2), ctx);
                              var __tco_k = k;
                              var __tco_v = v;
                              var __tco_v1 = v1.value3;
                              ctx = __tco_ctx;
                              k = __tco_k;
                              v = __tco_v;
                              v1 = __tco_v1;
                              continue tco;
                          };
                          if (v1 instanceof Three) {
                              var $295 = comp(k)(v1.value1);
                              if ($295 instanceof Data_Ordering.EQ) {
                                  return fromZipper(dictOrd)(ctx)(new Three(v1.value0, k, v, v1.value3, v1.value4, v1.value5, v1.value6));
                              };
                              var $297 = comp(k)(v1.value4);
                              if ($297 instanceof Data_Ordering.EQ) {
                                  return fromZipper(dictOrd)(ctx)(new Three(v1.value0, v1.value1, v1.value2, v1.value3, k, v, v1.value6));
                              };
                              if ($295 instanceof Data_Ordering.LT) {
                                  var __tco_ctx = new Data_List.Cons(new ThreeLeft(v1.value1, v1.value2, v1.value3, v1.value4, v1.value5, v1.value6), ctx);
                                  var __tco_k = k;
                                  var __tco_v = v;
                                  var __tco_v1 = v1.value0;
                                  ctx = __tco_ctx;
                                  k = __tco_k;
                                  v = __tco_v;
                                  v1 = __tco_v1;
                                  continue tco;
                              };
                              if ($295 instanceof Data_Ordering.GT && $297 instanceof Data_Ordering.LT) {
                                  var __tco_ctx = new Data_List.Cons(new ThreeMiddle(v1.value0, v1.value1, v1.value2, v1.value4, v1.value5, v1.value6), ctx);
                                  var __tco_k = k;
                                  var __tco_v = v;
                                  var __tco_v1 = v1.value3;
                                  ctx = __tco_ctx;
                                  k = __tco_k;
                                  v = __tco_v;
                                  v1 = __tco_v1;
                                  continue tco;
                              };
                              var __tco_ctx = new Data_List.Cons(new ThreeRight(v1.value0, v1.value1, v1.value2, v1.value3, v1.value4, v1.value5), ctx);
                              var __tco_k = k;
                              var __tco_v = v;
                              var __tco_v1 = v1.value6;
                              ctx = __tco_ctx;
                              k = __tco_k;
                              v = __tco_v;
                              v1 = __tco_v1;
                              continue tco;
                          };
                          throw new Error("Failed pattern match at Data.Map line 241, column 3 - line 241, column 52: " + [ ctx.constructor.name, k.constructor.name, v.constructor.name, v1.constructor.name ]);
                      };
                  };
              };
          };
      };
      return down(Data_List.Nil.value);
  };
  var empty = Leaf.value;
  var fromFoldable = function (dictOrd) {
      return function (dictFoldable) {
          return Data_Foldable.foldl(dictFoldable)(function (m) {
              return function (v) {
                  return insert(dictOrd)(v.value0)(v.value1)(m);
              };
          })(empty);
      };
  };
  exports["empty"] = empty;
  exports["fromFoldable"] = fromFoldable;
  exports["insert"] = insert;
  exports["lookup"] = lookup;
})(PS["Data.Map"] = PS["Data.Map"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine_Aff = PS["Control.Coroutine.Aff"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Data_Const = PS["Data.Const"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_Maybe = PS["Data.Maybe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];               
  var runEventSource = function (v) {
      return v;
  };
  exports["runEventSource"] = runEventSource;
})(PS["Halogen.Query.EventSource"] = PS["Halogen.Query.EventSource"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Applicative = PS["Control.Applicative"];        
  var Get = (function () {
      function Get(value0) {
          this.value0 = value0;
      };
      Get.create = function (value0) {
          return new Get(value0);
      };
      return Get;
  })();
  var Modify = (function () {
      function Modify(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Modify.create = function (value0) {
          return function (value1) {
              return new Modify(value0, value1);
          };
      };
      return Modify;
  })();
  var stateN = function (dictMonad) {
      return function (dictMonadState) {
          return function (v) {
              if (v instanceof Get) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(Control_Monad_State_Class.get(dictMonadState))(function ($22) {
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v.value0($22));
                  });
              };
              if (v instanceof Modify) {
                  return Data_Functor.voidLeft(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Control_Monad_State_Class.modify(dictMonadState)(v.value0))(v.value1);
              };
              throw new Error("Failed pattern match at Halogen.Query.StateF line 33, column 1 - line 33, column 40: " + [ v.constructor.name ]);
          };
      };
  };
  var functorStateF = new Data_Functor.Functor(function (f) {
      return function (v) {
          if (v instanceof Get) {
              return new Get(function ($24) {
                  return f(v.value0($24));
              });
          };
          if (v instanceof Modify) {
              return new Modify(v.value0, f(v.value1));
          };
          throw new Error("Failed pattern match at Halogen.Query.StateF line 21, column 3 - line 21, column 32: " + [ f.constructor.name, v.constructor.name ]);
      };
  });
  exports["Get"] = Get;
  exports["Modify"] = Modify;
  exports["stateN"] = stateN;
  exports["functorStateF"] = functorStateF;
})(PS["Halogen.Query.StateF"] = PS["Halogen.Query.StateF"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];        
  var Pending = (function () {
      function Pending() {

      };
      Pending.value = new Pending();
      return Pending;
  })();
  var StateHF = (function () {
      function StateHF(value0) {
          this.value0 = value0;
      };
      StateHF.create = function (value0) {
          return new StateHF(value0);
      };
      return StateHF;
  })();
  var SubscribeHF = (function () {
      function SubscribeHF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SubscribeHF.create = function (value0) {
          return function (value1) {
              return new SubscribeHF(value0, value1);
          };
      };
      return SubscribeHF;
  })();
  var QueryHF = (function () {
      function QueryHF(value0) {
          this.value0 = value0;
      };
      QueryHF.create = function (value0) {
          return new QueryHF(value0);
      };
      return QueryHF;
  })();
  var RenderHF = (function () {
      function RenderHF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      RenderHF.create = function (value0) {
          return function (value1) {
              return new RenderHF(value0, value1);
          };
      };
      return RenderHF;
  })();
  var RenderPendingHF = (function () {
      function RenderPendingHF(value0) {
          this.value0 = value0;
      };
      RenderPendingHF.create = function (value0) {
          return new RenderPendingHF(value0);
      };
      return RenderPendingHF;
  })();
  var HaltHF = (function () {
      function HaltHF(value0) {
          this.value0 = value0;
      };
      HaltHF.create = function (value0) {
          return new HaltHF(value0);
      };
      return HaltHF;
  })();
  var functorHalogenF = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (h) {
              if (h instanceof StateHF) {
                  return new StateHF(Data_Functor.map(Halogen_Query_StateF.functorStateF)(f)(h.value0));
              };
              if (h instanceof SubscribeHF) {
                  return new SubscribeHF(h.value0, f(h.value1));
              };
              if (h instanceof QueryHF) {
                  return new QueryHF(Data_Functor.map(dictFunctor)(f)(h.value0));
              };
              if (h instanceof RenderHF) {
                  return new RenderHF(h.value0, f(h.value1));
              };
              if (h instanceof RenderPendingHF) {
                  return new RenderPendingHF(Data_Functor.map(Data_Functor.functorFn)(f)(h.value0));
              };
              if (h instanceof HaltHF) {
                  return new HaltHF(h.value0);
              };
              throw new Error("Failed pattern match at Halogen.Query.HalogenF line 37, column 5 - line 43, column 31: " + [ h.constructor.name ]);
          };
      });
  };
  exports["StateHF"] = StateHF;
  exports["SubscribeHF"] = SubscribeHF;
  exports["QueryHF"] = QueryHF;
  exports["RenderHF"] = RenderHF;
  exports["RenderPendingHF"] = RenderPendingHF;
  exports["HaltHF"] = HaltHF;
  exports["Pending"] = Pending;
  exports["functorHalogenF"] = functorHalogenF;
})(PS["Halogen.Query.HalogenF"] = PS["Halogen.Query.HalogenF"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var PostRender = (function () {
      function PostRender(value0) {
          this.value0 = value0;
      };
      PostRender.create = function (value0) {
          return new PostRender(value0);
      };
      return PostRender;
  })();
  var Finalized = (function () {
      function Finalized(value0) {
          this.value0 = value0;
      };
      Finalized.create = function (value0) {
          return new Finalized(value0);
      };
      return Finalized;
  })();
  var FinalizedF = (function () {
      function FinalizedF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      FinalizedF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new FinalizedF(value0, value1, value2);
              };
          };
      };
      return FinalizedF;
  })();
  var runFinalized = function (k) {
      return function (f) {
          var $6 = Unsafe_Coerce.unsafeCoerce(f);
          return k($6.value0)($6.value1)($6.value2);
      };
  };
  var finalized = function (e) {
      return function (s) {
          return function (i) {
              return Unsafe_Coerce.unsafeCoerce(new FinalizedF(e, s, i));
          };
      };
  };
  exports["PostRender"] = PostRender;
  exports["Finalized"] = Finalized;
  exports["finalized"] = finalized;
  exports["runFinalized"] = runFinalized;
})(PS["Halogen.Component.Hook"] = PS["Halogen.Component.Hook"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Halogen.HTML.Events.Handler

  exports.preventDefaultImpl = function (e) {
    return function () {
      e.preventDefault();
    };
  };

  exports.stopPropagationImpl = function (e) {
    return function () {
      e.stopPropagation();
    };
  };

  exports.stopImmediatePropagationImpl = function (e) {
    return function () {
      e.stopImmediatePropagation();
    };
  };
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Halogen.HTML.Events.Handler"];
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Writer = PS["Control.Monad.Writer"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM = PS["DOM"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var PreventDefault = (function () {
      function PreventDefault() {

      };
      PreventDefault.value = new PreventDefault();
      return PreventDefault;
  })();
  var StopPropagation = (function () {
      function StopPropagation() {

      };
      StopPropagation.value = new StopPropagation();
      return StopPropagation;
  })();
  var StopImmediatePropagation = (function () {
      function StopImmediatePropagation() {

      };
      StopImmediatePropagation.value = new StopImmediatePropagation();
      return StopImmediatePropagation;
  })();
  var EventHandler = function (x) {
      return x;
  };                                                                                                                                                                                                      
  var runEventHandler = function (dictMonad) {
      return function (dictMonadEff) {
          return function (e) {
              return function (v) {
                  var applyUpdate = function (v1) {
                      if (v1 instanceof PreventDefault) {
                          return $foreign.preventDefaultImpl(e);
                      };
                      if (v1 instanceof StopPropagation) {
                          return $foreign.stopPropagationImpl(e);
                      };
                      if (v1 instanceof StopImmediatePropagation) {
                          return $foreign.stopImmediatePropagationImpl(e);
                      };
                      throw new Error("Failed pattern match at Halogen.HTML.Events.Handler line 89, column 3 - line 89, column 63: " + [ v1.constructor.name ]);
                  };
                  var $13 = Control_Monad_Writer.runWriter(v);
                  return Data_Function.apply(Control_Monad_Eff_Class.liftEff(dictMonadEff))(Control_Apply.applySecond(Control_Monad_Eff.applyEff)(Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)($13.value1)(applyUpdate))(Control_Applicative.pure(Control_Monad_Eff.applicativeEff)($13.value0)));
              };
          };
      };
  };                                                                                                                                                                                  
  var functorEventHandler = new Data_Functor.Functor(function (f) {
      return function (v) {
          return Data_Functor.map(Control_Monad_Writer_Trans.functorWriterT(Data_Identity.functorIdentity))(f)(v);
      };
  });
  var applyEventHandler = new Control_Apply.Apply(function () {
      return functorEventHandler;
  }, function (v) {
      return function (v1) {
          return Control_Apply.apply(Control_Monad_Writer_Trans.applyWriterT(Data_Semigroup.semigroupArray)(Data_Identity.applyIdentity))(v)(v1);
      };
  });
  var applicativeEventHandler = new Control_Applicative.Applicative(function () {
      return applyEventHandler;
  }, function ($23) {
      return EventHandler(Control_Applicative.pure(Control_Monad_Writer_Trans.applicativeWriterT(Data_Monoid.monoidArray)(Data_Identity.applicativeIdentity))($23));
  });
  exports["runEventHandler"] = runEventHandler;
  exports["functorEventHandler"] = functorEventHandler;
  exports["applyEventHandler"] = applyEventHandler;
  exports["applicativeEventHandler"] = applicativeEventHandler;
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Show = PS["Data.Show"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];        
  var TagName = function (x) {
      return x;
  };
  var PropName = function (x) {
      return x;
  };
  var EventName = function (x) {
      return x;
  };
  var HandlerF = (function () {
      function HandlerF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      HandlerF.create = function (value0) {
          return function (value1) {
              return new HandlerF(value0, value1);
          };
      };
      return HandlerF;
  })();
  var ClassName = function (x) {
      return x;
  };
  var AttrName = function (x) {
      return x;
  };
  var PropF = (function () {
      function PropF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      PropF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new PropF(value0, value1, value2);
              };
          };
      };
      return PropF;
  })();
  var Prop = (function () {
      function Prop(value0) {
          this.value0 = value0;
      };
      Prop.create = function (value0) {
          return new Prop(value0);
      };
      return Prop;
  })();
  var Attr = (function () {
      function Attr(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      Attr.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new Attr(value0, value1, value2);
              };
          };
      };
      return Attr;
  })();
  var Key = (function () {
      function Key(value0) {
          this.value0 = value0;
      };
      Key.create = function (value0) {
          return new Key(value0);
      };
      return Key;
  })();
  var Handler = (function () {
      function Handler(value0) {
          this.value0 = value0;
      };
      Handler.create = function (value0) {
          return new Handler(value0);
      };
      return Handler;
  })();
  var Ref = (function () {
      function Ref(value0) {
          this.value0 = value0;
      };
      Ref.create = function (value0) {
          return new Ref(value0);
      };
      return Ref;
  })();
  var Text = (function () {
      function Text(value0) {
          this.value0 = value0;
      };
      Text.create = function (value0) {
          return new Text(value0);
      };
      return Text;
  })();
  var Element = (function () {
      function Element(value0, value1, value2, value3) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
      };
      Element.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return new Element(value0, value1, value2, value3);
                  };
              };
          };
      };
      return Element;
  })();
  var Slot = (function () {
      function Slot(value0) {
          this.value0 = value0;
      };
      Slot.create = function (value0) {
          return new Slot(value0);
      };
      return Slot;
  })();
  var IsProp = function (toPropString) {
      this.toPropString = toPropString;
  };
  var toPropString = function (dict) {
      return dict.toPropString;
  };
  var tagName = TagName;
  var stringIsProp = new IsProp(function (v) {
      return function (v1) {
          return function (s) {
              return s;
          };
      };
  });
  var runTagName = function (v) {
      return v;
  };
  var runPropName = function (v) {
      return v;
  };
  var runNamespace = function (v) {
      return v;
  };
  var runEventName = function (v) {
      return v;
  };
  var runClassName = function (v) {
      return v;
  };
  var runAttrName = function (v) {
      return v;
  };
  var propName = PropName;
  var prop = function (dictIsProp) {
      return function (name) {
          return function (attr) {
              return function (v) {
                  return new Prop(Data_Exists.mkExists(new PropF(name, v, Data_Functor.map(Data_Maybe.functorMaybe)(Data_Function.flip(Data_Tuple.Tuple.create)(toPropString(dictIsProp)))(attr))));
              };
          };
      };
  }; 
  var handler = function (name) {
      return function (k) {
          return new Handler(Data_ExistsR.mkExistsR(new HandlerF(name, k)));
      };
  };
  var eventName = EventName;
  var element = Element.create(Data_Maybe.Nothing.value);
  var className = ClassName;
  var booleanIsProp = new IsProp(function (v) {
      return function (v1) {
          return function (v2) {
              if (v2) {
                  return runAttrName(v);
              };
              if (!v2) {
                  return "";
              };
              throw new Error("Failed pattern match at Halogen.HTML.Core line 138, column 3 - line 138, column 46: " + [ v.constructor.name, v1.constructor.name, v2.constructor.name ]);
          };
      };
  });                                                                            
  var attrName = AttrName;
  exports["Text"] = Text;
  exports["Element"] = Element;
  exports["Slot"] = Slot;
  exports["HandlerF"] = HandlerF;
  exports["Prop"] = Prop;
  exports["Attr"] = Attr;
  exports["Key"] = Key;
  exports["Handler"] = Handler;
  exports["Ref"] = Ref;
  exports["PropF"] = PropF;
  exports["IsProp"] = IsProp;
  exports["attrName"] = attrName;
  exports["className"] = className;
  exports["element"] = element;
  exports["eventName"] = eventName;
  exports["handler"] = handler;
  exports["prop"] = prop;
  exports["propName"] = propName;
  exports["runAttrName"] = runAttrName;
  exports["runClassName"] = runClassName;
  exports["runEventName"] = runEventName;
  exports["runNamespace"] = runNamespace;
  exports["runPropName"] = runPropName;
  exports["runTagName"] = runTagName;
  exports["tagName"] = tagName;
  exports["toPropString"] = toPropString;
  exports["stringIsProp"] = stringIsProp;
  exports["booleanIsProp"] = booleanIsProp;
})(PS["Halogen.HTML.Core"] = PS["Halogen.HTML.Core"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Lazy = PS["Data.Lazy"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Category = PS["Control.Category"];        
  var runTree = function (k) {
      return function (t) {
          var $5 = Unsafe_Coerce.unsafeCoerce(t);
          return k($5);
      };
  };
  var mkTree$prime = Unsafe_Coerce.unsafeCoerce;
  exports["mkTree'"] = mkTree$prime;
  exports["runTree"] = runTree;
})(PS["Halogen.Component.Tree"] = PS["Halogen.Component.Tree"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Category = PS["Control.Category"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var modify = function (f) {
      return Control_Monad_Free.liftF(new Halogen_Query_HalogenF.StateHF(new Halogen_Query_StateF.Modify(f, Data_Unit.unit)));
  };                                                               
  var action = function (act) {
      return act(Data_Unit.unit);
  };
  exports["action"] = action;
  exports["modify"] = modify;
})(PS["Halogen.Query"] = PS["Halogen.Query"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_ST = PS["Control.Monad.ST"];
  var Data_Array = PS["Data.Array"];
  var Data_Array_ST = PS["Data.Array.ST"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_Lazy = PS["Data.Lazy"];
  var Data_List = PS["Data.List"];
  var Data_Map = PS["Data.Map"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Partial_Unsafe = PS["Partial.Unsafe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var Control_Category = PS["Control.Category"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Apply = PS["Control.Apply"];
  var renderComponent = function (v) {
      return v.render;
  };
  var queryComponent = function (v) {
      return v["eval"];
  };
  var lifecycleComponent = function (spec) {
      var renderTree = function (html) {
          return Halogen_Component_Tree["mkTree'"]({
              slot: Data_Unit.unit, 
              html: Data_Lazy.defer(function (v) {
                  return Unsafe_Coerce.unsafeCoerce(html);
              }), 
              eq: function (v) {
                  return function (v1) {
                      return false;
                  };
              }, 
              thunk: false
          });
      };
      return {
          render: function (s) {
              return {
                  state: s, 
                  hooks: [  ], 
                  tree: renderTree(spec.render(s))
              };
          }, 
          "eval": spec["eval"], 
          initializer: spec.initializer, 
          finalizers: function (s) {
              return Data_Maybe.maybe([  ])(function (i) {
                  return [ Halogen_Component_Hook.finalized(spec["eval"])(s)(i) ];
              })(spec.finalizer);
          }
      };
  };
  var initializeComponent = function (v) {
      return v.initializer;
  };
  var component = function (spec) {
      return lifecycleComponent({
          render: spec.render, 
          "eval": spec["eval"], 
          initializer: Data_Maybe.Nothing.value, 
          finalizer: Data_Maybe.Nothing.value
      });
  };
  exports["component"] = component;
  exports["initializeComponent"] = initializeComponent;
  exports["lifecycleComponent"] = lifecycleComponent;
  exports["queryComponent"] = queryComponent;
  exports["renderComponent"] = renderComponent;
})(PS["Halogen.Component"] = PS["Halogen.Component"] || {});
(function(exports) {
  /* global exports, require */
  "use strict";
  var vcreateElement =require("virtual-dom/create-element");
  var vdiff =require("virtual-dom/diff");
  var vpatch =require("virtual-dom/patch");
  var VText =require("virtual-dom/vnode/vtext");
  var VirtualNode =require("virtual-dom/vnode/vnode");
  var SoftSetHook =require("virtual-dom/virtual-hyperscript/hooks/soft-set-hook"); 

  // jshint maxparams: 2
  exports.prop = function (key, value) {
    var props = {};
    props[key] = value;
    return props;
  };

  // jshint maxparams: 2
  exports.attr = function (key, value) {
    var props = { attributes: {} };
    props.attributes[key] = value;
    return props;
  };

  function HandlerHook (key, f) {
    this.key = key;
    this.callback = function (e) {
      f(e)();
    };
  }

  HandlerHook.prototype = {
    hook: function (node) {
      node.addEventListener(this.key, this.callback);
    },
    unhook: function (node) {
      node.removeEventListener(this.key, this.callback);
    }
  };

  // jshint maxparams: 2
  exports.handlerProp = function (key, f) {
    var props = {};
    props["halogen-hook-" + key] = new HandlerHook(key, f);
    return props;
  };

  exports.refPropImpl = function (nothing) {
    return function (just) {

      var ifHookFn = function (init) {
        // jshint maxparams: 3
        return function (node, prop, diff) {
          // jshint validthis: true
          if (typeof diff === "undefined") {
            this.f(init ? just(node) : nothing)();
          }
        };
      };

      // jshint maxparams: 1
      function RefHook (f) {
        this.f = f;
      }

      RefHook.prototype = {
        hook: ifHookFn(true),
        unhook: ifHookFn(false)
      };

      return function (f) {
        return { "halogen-ref": new RefHook(f) };
      };
    };
  };

  // jshint maxparams: 3
  function HalogenWidget (tree, eq, render) {
    this.tree = tree;
    this.eq = eq;
    this.render = render;
    this.vdom = null;
    this.el = null;
  }

  HalogenWidget.prototype = {
    type: "Widget",
    init: function () {
      this.vdom = this.render(this.tree);
      this.el = vcreateElement(this.vdom);
      return this.el;
    },
    update: function (prev, node) {
      if (!prev.tree || !this.eq(prev.tree.slot)(this.tree.slot)) {
        return this.init();
      }
      if (this.tree.thunk) {
        this.vdom = prev.vdom;
        this.el = prev.el;
      } else {
        this.vdom = this.render(this.tree);
        this.el = vpatch(node, vdiff(prev.vdom, this.vdom));
      }
    }
  };

  exports.widget = function (tree) {
    return function (eq) {
      return function (render) {
        return new HalogenWidget(tree, eq, render);
      };
    };
  };

  exports.concatProps = function () {
    // jshint maxparams: 2
    var hOP = Object.prototype.hasOwnProperty;
    var copy = function (props, result) {
      for (var key in props) {
        if (hOP.call(props, key)) {
          if (key === "attributes") {
            var attrs = props[key];
            var resultAttrs = result[key] || (result[key] = {});
            for (var attr in attrs) {
              if (hOP.call(attrs, attr)) {
                resultAttrs[attr] = attrs[attr];
              }
            }
          } else {
            result[key] = props[key];
          }
        }
      }
      return result;
    };
    return function (p1, p2) {
      return copy(p2, copy(p1, {}));
    };
  }();

  exports.emptyProps = {};

  exports.createElement = function (vtree) {
    return vcreateElement(vtree);
  };

  exports.diff = function (vtree1) {
    return function (vtree2) {
      return vdiff(vtree1, vtree2);
    };
  };

  exports.patch = function (p) {
    return function (node) {
      return function () {
        return vpatch(node, p);
      };
    };
  };

  exports.vtext = function (s) {
    return new VText(s);
  };

  exports.vnode = function (namespace) {
    return function (name) {
      return function (key) {
        return function (props) {
          return function (children) {
            if (name === "input" && props.value !== undefined) {
              props.value = new SoftSetHook(props.value);
            }
            return new VirtualNode(name, props, children, key, namespace);
          };
        };
      };
    };
  };
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var $foreign = PS["Halogen.Internal.VirtualDOM"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var semigroupProps = new Data_Semigroup.Semigroup(Data_Function_Uncurried.runFn2($foreign.concatProps));
  var refProp = $foreign.refPropImpl(Data_Maybe.Nothing.value)(Data_Maybe.Just.create);
  var monoidProps = new Data_Monoid.Monoid(function () {
      return semigroupProps;
  }, $foreign.emptyProps);
  exports["refProp"] = refProp;
  exports["semigroupProps"] = semigroupProps;
  exports["monoidProps"] = monoidProps;
  exports["attr"] = $foreign.attr;
  exports["createElement"] = $foreign.createElement;
  exports["diff"] = $foreign.diff;
  exports["handlerProp"] = $foreign.handlerProp;
  exports["patch"] = $foreign.patch;
  exports["prop"] = $foreign.prop;
  exports["vnode"] = $foreign.vnode;
  exports["vtext"] = $foreign.vtext;
  exports["widget"] = $foreign.widget;
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function_Uncurried = PS["Data.Function.Uncurried"];
  var Data_Lazy = PS["Data.Lazy"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Nullable = PS["Data.Nullable"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Bind = PS["Control.Bind"];        
  var handleAff = function ($40) {
      return Data_Functor["void"](Control_Monad_Eff.functorEff)(Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Data_Function["const"](Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))($40));
  };
  var renderProp = function (v) {
      return function (v1) {
          if (v1 instanceof Halogen_HTML_Core.Prop) {
              return Data_Exists.runExists(function (v2) {
                  return Halogen_Internal_VirtualDOM.prop(Halogen_HTML_Core.runPropName(v2.value0), v2.value1);
              })(v1.value0);
          };
          if (v1 instanceof Halogen_HTML_Core.Attr) {
              var attrName = Data_Maybe.maybe("")(function (ns$prime) {
                  return Halogen_HTML_Core.runNamespace(ns$prime) + ":";
              })(v1.value0) + Halogen_HTML_Core.runAttrName(v1.value1);
              return Halogen_Internal_VirtualDOM.attr(attrName, v1.value2);
          };
          if (v1 instanceof Halogen_HTML_Core.Handler) {
              return Data_ExistsR.runExistsR(function (v2) {
                  return Halogen_Internal_VirtualDOM.handlerProp(Halogen_HTML_Core.runEventName(v2.value0), function (ev) {
                      return Data_Function.apply(handleAff)(Control_Bind.bind(Control_Monad_Aff.bindAff)(Halogen_HTML_Events_Handler.runEventHandler(Control_Monad_Aff.monadAff)(Control_Monad_Aff.monadEffAff)(ev)(v2.value1(ev)))(Data_Maybe.maybe(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(Data_Unit.unit))(v)));
                  });
              })(v1.value0);
          };
          if (v1 instanceof Halogen_HTML_Core.Ref) {
              return Halogen_Internal_VirtualDOM.refProp(function ($41) {
                  return handleAff(v(v1.value0($41)));
              });
          };
          return Data_Monoid.mempty(Halogen_Internal_VirtualDOM.monoidProps);
      };
  };
  var findKey = function (v) {
      return function (v1) {
          if (v1 instanceof Halogen_HTML_Core.Key) {
              return new Data_Maybe.Just(v1.value0);
          };
          return v;
      };
  };
  var renderTree = function (f) {
      return Halogen_Component_Tree.runTree(function (tree) {
          var go = function (v) {
              if (v instanceof Halogen_HTML_Core.Text) {
                  return Halogen_Internal_VirtualDOM.vtext(v.value0);
              };
              if (v instanceof Halogen_HTML_Core.Slot) {
                  return Halogen_Internal_VirtualDOM.widget(v.value0)(tree.eq)(renderTree(f));
              };
              if (v instanceof Halogen_HTML_Core.Element) {
                  var tag = Halogen_HTML_Core.runTagName(v.value1);
                  var ns$prime = Data_Function.apply(Data_Nullable.toNullable)(Data_Functor.map(Data_Maybe.functorMaybe)(Halogen_HTML_Core.runNamespace)(v.value0));
                  var key = Data_Function.apply(Data_Nullable.toNullable)(Data_Foldable.foldl(Data_Foldable.foldableArray)(findKey)(Data_Maybe.Nothing.value)(v.value2));
                  return Halogen_Internal_VirtualDOM.vnode(ns$prime)(tag)(key)(Data_Foldable.foldMap(Data_Foldable.foldableArray)(Halogen_Internal_VirtualDOM.monoidProps)(renderProp(f))(v.value2))(Data_Functor.map(Data_Functor.functorArray)(go)(v.value3));
              };
              throw new Error("Failed pattern match at Halogen.HTML.Renderer.VirtualDOM line 49, column 5 - line 56, column 28: " + [ v.constructor.name ]);
          };
          return go(Data_Lazy.force(tree.html));
      });
  };
  exports["renderTree"] = renderTree;
})(PS["Halogen.HTML.Renderer.VirtualDOM"] = PS["Halogen.HTML.Renderer.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Coroutine_Stalling_1 = PS["Control.Coroutine.Stalling"];
  var Control_Coroutine_Stalling_1 = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_Node_Node = PS["DOM.Node.Node"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_HTML_Renderer_VirtualDOM = PS["Halogen.HTML.Renderer.VirtualDOM"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Functor = PS["Data.Functor"];        
  var onInitializers = function (dictFoldable) {
      return function (f) {
          var go = function (v) {
              return function (as) {
                  if (v instanceof Halogen_Component_Hook.PostRender) {
                      return new Data_List.Cons(f(v.value0), as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(dictFoldable)(go)(Data_List.Nil.value);
      };
  };
  var onFinalizers = function (dictFoldable) {
      return function (f) {
          var go = function (v) {
              return function (as) {
                  if (v instanceof Halogen_Component_Hook.Finalized) {
                      return new Data_List.Cons(f(v.value0), as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(dictFoldable)(go)(Data_List.Nil.value);
      };
  };
  var runUI = function (c) {
      return function (s) {
          return function (element) {
              var driver$prime = function (e) {
                  return function (s1) {
                      return function (i) {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar["makeVar'"](s1))(function (v) {
                              return Data_Function.flip(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff))(e(i))(function (h) {
                                  if (h instanceof Halogen_Query_HalogenF.StateHF) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(v))(function (v1) {
                                          var $29 = Control_Monad_State.runState(Halogen_Query_StateF.stateN(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity))(Control_Monad_State_Trans.monadStateStateT(Data_Identity.monadIdentity))(h.value0))(v1);
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(v)($29.value1))(function () {
                                              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)($29.value0);
                                          });
                                      });
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.RenderHF) {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.RenderPendingHF) {
                                      return Data_Function.apply(Control_Applicative.pure(Control_Monad_Aff.applicativeAff))(h.value0(Data_Maybe.Nothing.value));
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                                      return h.value0;
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                                      return Data_Function.apply(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff))(Control_Monad_Eff_Exception.error(h.value0));
                                  };
                                  throw new Error("Failed pattern match at Halogen.Driver line 145, column 7 - line 156, column 45: " + [ h.constructor.name ]);
                              });
                          });
                      };
                  };
              };
              var render = function (ref) {
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                      if (v.renderPaused) {
                          return Data_Function.apply(Control_Monad_Aff_AVar.putVar(ref))((function () {
                              var $42 = {};
                              for (var $43 in v) {
                                  if (v.hasOwnProperty($43)) {
                                      $42[$43] = v[$43];
                                  };
                              };
                              $42.renderPending = true;
                              return $42;
                          })());
                      };
                      if (!v.renderPaused) {
                          var rc = Halogen_Component.renderComponent(c)(v.state);
                          var vtree$prime = Halogen_HTML_Renderer_VirtualDOM.renderTree(driver(ref))(rc.tree);
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(Halogen_Internal_VirtualDOM.patch(Halogen_Internal_VirtualDOM.diff(v.vtree)(vtree$prime))(v.node)))(function (v1) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)({
                                  node: v1, 
                                  vtree: vtree$prime, 
                                  state: rc.state, 
                                  renderPending: false, 
                                  renderPaused: true
                              }))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onFinalizers(Data_Foldable.foldableArray)(Halogen_Component_Hook.runFinalized(driver$prime))(rc.hooks)))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onInitializers(Data_Foldable.foldableArray)(driver(ref))(rc.hooks)))(function () {
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (v2) {
                                              var $46 = {};
                                              for (var $47 in v2) {
                                                  if (v2.hasOwnProperty($47)) {
                                                      $46[$47] = v2[$47];
                                                  };
                                              };
                                              $46.renderPaused = false;
                                              return $46;
                                          })(ref))(function () {
                                              return flushRender(ref);
                                          });
                                      });
                                  });
                              });
                          });
                      };
                      throw new Error("Failed pattern match at Halogen.Driver line 161, column 5 - line 177, column 24: " + [ v.renderPaused.constructor.name ]);
                  });
              };
              var flushRender = Control_Monad_Rec_Class.tailRecM(Control_Monad_Aff.monadRecAff)(function (ref) {
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(v))(function () {
                          var $50 = !v.renderPending;
                          if ($50) {
                              return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Right(Data_Unit.unit));
                          };
                          if (!$50) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(render(ref))(function () {
                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Left(ref));
                              });
                          };
                          throw new Error("Failed pattern match at Halogen.Driver line 183, column 5 - line 187, column 24: " + [ $50.constructor.name ]);
                      });
                  });
              });
              var $$eval = function (ref) {
                  return function (rpRef) {
                      return function (h) {
                          if (h instanceof Halogen_Query_HalogenF.StateHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (v) {
                                  if (h.value0 instanceof Halogen_Query_StateF.Get) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(v))(function () {
                                          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value0.value0(v.state));
                                      });
                                  };
                                  if (h.value0 instanceof Halogen_Query_StateF.Modify) {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v1) {
                                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff_AVar.putVar(ref))((function () {
                                              var $56 = {};
                                              for (var $57 in v) {
                                                  if (v.hasOwnProperty($57)) {
                                                      $56[$57] = v[$57];
                                                  };
                                              };
                                              $56.state = h.value0.value0(v.state);
                                              return $56;
                                          })()))(function () {
                                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff_AVar.putVar(rpRef))(new Data_Maybe.Just(Halogen_Query_HalogenF.Pending.value)))(function () {
                                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value0.value1);
                                              });
                                          });
                                      });
                                  };
                                  throw new Error("Failed pattern match at Halogen.Driver line 107, column 9 - line 115, column 22: " + [ h.value0.constructor.name ]);
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                              var producer = Halogen_Query_EventSource.runEventSource(h.value0);
                              var consumer = Control_Monad_Rec_Class.forever(Control_Monad_Free_Trans.monadRecFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(Control_Bind.bindFlipped(Control_Monad_Free_Trans.bindFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(function ($78) {
                                  return Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(Control_Coroutine.functorAwait))(Control_Monad_Aff.monadAff)(driver(ref)($78));
                              })(Control_Coroutine["await"](Control_Monad_Aff.monadAff)));
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAff)(Control_Coroutine_Stalling_1.runStallingProcess(Control_Monad_Aff.monadRecAff)(Control_Coroutine_Stalling_1.fuse(Control_Monad_Aff.monadRecAff)(Control_Monad_Aff.monadParAff)(producer)(consumer))))(function () {
                                  return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.RenderHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(Data_Function["const"](h.value0))(rpRef))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isNothing(h.value0)))(render(ref)))(function () {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.RenderPendingHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(rpRef)(v))(function () {
                                      return Data_Function.apply(Control_Applicative.pure(Control_Monad_Aff.applicativeAff))(h.value0(v));
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(rpRef))(function (v) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isJust(v)))(render(ref)))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(rpRef)(Data_Maybe.Nothing.value))(function () {
                                          return h.value0;
                                      });
                                  });
                              });
                          };
                          if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                              return Data_Function.apply(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff))(Control_Monad_Eff_Exception.error(h.value0));
                          };
                          throw new Error("Failed pattern match at Halogen.Driver line 104, column 5 - line 134, column 43: " + [ h.constructor.name ]);
                      };
                  };
              };
              var driver = function (ref) {
                  return function (q) {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar["makeVar'"](Data_Maybe.Nothing.value))(function (v) {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff)($$eval(ref)(v))(Halogen_Component.queryComponent(c)(q)))(function (v1) {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(v))(function (v2) {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Applicative.when(Control_Monad_Aff.applicativeAff)(Data_Maybe.isJust(v2)))(render(ref)))(function () {
                                      return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(v1);
                                  });
                              });
                          });
                      });
                  };
              };
              return Data_Functor.map(Control_Monad_Aff.functorAff)(function (v) {
                  return v.driver;
              })(Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.makeVar)(function (v) {
                  var rc = Halogen_Component.renderComponent(c)(s);
                  var dr = driver(v);
                  var vtree = Halogen_HTML_Renderer_VirtualDOM.renderTree(dr)(rc.tree);
                  var node = Halogen_Internal_VirtualDOM.createElement(vtree);
                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(v)({
                      node: node, 
                      vtree: vtree, 
                      state: rc.state, 
                      renderPending: false, 
                      renderPaused: true
                  }))(function () {
                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(DOM_Node_Node.appendChild(DOM_HTML_Types.htmlElementToNode(node))(DOM_HTML_Types.htmlElementToNode(element))))(function () {
                          return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAll(Data_List.foldableList))(onInitializers(Data_Foldable.foldableArray)(dr)(rc.hooks)))(function () {
                              return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Aff.forkAff)(Data_Maybe.maybe(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)(Data_Unit.unit))(dr)(Halogen_Component.initializeComponent(c))))(function () {
                                  return Control_Bind.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (v1) {
                                      var $75 = {};
                                      for (var $76 in v1) {
                                          if (v1.hasOwnProperty($76)) {
                                              $75[$76] = v1[$76];
                                          };
                                      };
                                      $75.renderPaused = false;
                                      return $75;
                                  })(v))(function () {
                                      return Control_Bind.bind(Control_Monad_Aff.bindAff)(flushRender(v))(function () {
                                          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)({
                                              driver: dr
                                          });
                                      });
                                  });
                              });
                          });
                      });
                  });
              }));
          };
      };
  };
  exports["runUI"] = runUI;
})(PS["Halogen.Driver"] = PS["Halogen.Driver"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var tr = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("tr"))(xs);
  };
  var tr_ = tr([  ]);    
  var thead = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("thead"))(xs);
  };
  var thead_ = thead([  ]);
  var th = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("th"))(xs);
  };
  var th_ = th([  ]);
  var td = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("td"))(xs);
  };
  var td_ = td([  ]);
  var tbody = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("tbody"))(xs);
  };
  var tbody_ = tbody([  ]);
  var table = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("table"))(xs);
  };
  var table_ = table([  ]);  
  var span = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("span"))(xs);
  };                         
  var label = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("label"))(xs);
  };                   
  var input = function (props) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("input"))(props)([  ]);
  };                 
  var div = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("div"))(xs);
  };
  var div_ = div([  ]);
  var button = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("button"))(xs);
  };
  exports["button"] = button;
  exports["div"] = div;
  exports["div_"] = div_;
  exports["input"] = input;
  exports["label"] = label;
  exports["span"] = span;
  exports["table"] = table;
  exports["table_"] = table_;
  exports["tbody"] = tbody;
  exports["tbody_"] = tbody_;
  exports["td"] = td;
  exports["td_"] = td_;
  exports["th"] = th;
  exports["th_"] = th_;
  exports["thead"] = thead;
  exports["thead_"] = thead_;
  exports["tr"] = tr;
  exports["tr_"] = tr_;
})(PS["Halogen.HTML.Elements"] = PS["Halogen.HTML.Elements"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Data_Functor = PS["Data.Functor"];        
  var text = Halogen_HTML_Core.Text.create;
  exports["text"] = text;
})(PS["Halogen.HTML"] = PS["Halogen.HTML"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Data_Function = PS["Data.Function"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Functor = PS["Data.Functor"];
  var value = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("value"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("value")));
  var type_ = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("type"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("type")));
  var title = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("title"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("title")));
  var placeholder = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("placeholder"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("placeholder")));
  var name = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("name"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("name")));
  var id_ = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("id"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("id")));
  var $$for = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("htmlFor"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("for")));
  var class_ = function ($9) {
      return Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("className"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("class")))(Halogen_HTML_Core.runClassName($9));
  };
  var checked = Halogen_HTML_Core.prop(Halogen_HTML_Core.booleanIsProp)(Halogen_HTML_Core.propName("checked"))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_HTML_Core.attrName("checked")));
  exports["checked"] = checked;
  exports["class_"] = class_;
  exports["for"] = $$for;
  exports["id_"] = id_;
  exports["name"] = name;
  exports["placeholder"] = placeholder;
  exports["title"] = title;
  exports["type_"] = type_;
  exports["value"] = value;
})(PS["Halogen.HTML.Properties"] = PS["Halogen.HTML.Properties"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties_1 = PS["Halogen.HTML.Properties"];
  var Halogen_HTML_Properties_1 = PS["Halogen.HTML.Properties"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var InputButton = (function () {
      function InputButton() {

      };
      InputButton.value = new InputButton();
      return InputButton;
  })();
  var InputCheckbox = (function () {
      function InputCheckbox() {

      };
      InputCheckbox.value = new InputCheckbox();
      return InputCheckbox;
  })();
  var InputColor = (function () {
      function InputColor() {

      };
      InputColor.value = new InputColor();
      return InputColor;
  })();
  var InputDate = (function () {
      function InputDate() {

      };
      InputDate.value = new InputDate();
      return InputDate;
  })();
  var InputDatetime = (function () {
      function InputDatetime() {

      };
      InputDatetime.value = new InputDatetime();
      return InputDatetime;
  })();
  var InputDatetimeLocal = (function () {
      function InputDatetimeLocal() {

      };
      InputDatetimeLocal.value = new InputDatetimeLocal();
      return InputDatetimeLocal;
  })();
  var InputEmail = (function () {
      function InputEmail() {

      };
      InputEmail.value = new InputEmail();
      return InputEmail;
  })();
  var InputFile = (function () {
      function InputFile() {

      };
      InputFile.value = new InputFile();
      return InputFile;
  })();
  var InputHidden = (function () {
      function InputHidden() {

      };
      InputHidden.value = new InputHidden();
      return InputHidden;
  })();
  var InputImage = (function () {
      function InputImage() {

      };
      InputImage.value = new InputImage();
      return InputImage;
  })();
  var InputMonth = (function () {
      function InputMonth() {

      };
      InputMonth.value = new InputMonth();
      return InputMonth;
  })();
  var InputNumber = (function () {
      function InputNumber() {

      };
      InputNumber.value = new InputNumber();
      return InputNumber;
  })();
  var InputPassword = (function () {
      function InputPassword() {

      };
      InputPassword.value = new InputPassword();
      return InputPassword;
  })();
  var InputRadio = (function () {
      function InputRadio() {

      };
      InputRadio.value = new InputRadio();
      return InputRadio;
  })();
  var InputRange = (function () {
      function InputRange() {

      };
      InputRange.value = new InputRange();
      return InputRange;
  })();
  var InputReset = (function () {
      function InputReset() {

      };
      InputReset.value = new InputReset();
      return InputReset;
  })();
  var InputSearch = (function () {
      function InputSearch() {

      };
      InputSearch.value = new InputSearch();
      return InputSearch;
  })();
  var InputSubmit = (function () {
      function InputSubmit() {

      };
      InputSubmit.value = new InputSubmit();
      return InputSubmit;
  })();
  var InputTel = (function () {
      function InputTel() {

      };
      InputTel.value = new InputTel();
      return InputTel;
  })();
  var InputText = (function () {
      function InputText() {

      };
      InputText.value = new InputText();
      return InputText;
  })();
  var InputTime = (function () {
      function InputTime() {

      };
      InputTime.value = new InputTime();
      return InputTime;
  })();
  var InputUrl = (function () {
      function InputUrl() {

      };
      InputUrl.value = new InputUrl();
      return InputUrl;
  })();
  var InputWeek = (function () {
      function InputWeek() {

      };
      InputWeek.value = new InputWeek();
      return InputWeek;
  })();
  var renderInputType = function (ty) {
      if (ty instanceof InputButton) {
          return "button";
      };
      if (ty instanceof InputCheckbox) {
          return "checkbox";
      };
      if (ty instanceof InputColor) {
          return "color";
      };
      if (ty instanceof InputDate) {
          return "date";
      };
      if (ty instanceof InputDatetime) {
          return "datetime";
      };
      if (ty instanceof InputDatetimeLocal) {
          return "datetime-local";
      };
      if (ty instanceof InputEmail) {
          return "email";
      };
      if (ty instanceof InputFile) {
          return "file";
      };
      if (ty instanceof InputHidden) {
          return "hidden";
      };
      if (ty instanceof InputImage) {
          return "image";
      };
      if (ty instanceof InputMonth) {
          return "month";
      };
      if (ty instanceof InputNumber) {
          return "number";
      };
      if (ty instanceof InputPassword) {
          return "password";
      };
      if (ty instanceof InputRadio) {
          return "radio";
      };
      if (ty instanceof InputRange) {
          return "range";
      };
      if (ty instanceof InputReset) {
          return "reset";
      };
      if (ty instanceof InputSearch) {
          return "search";
      };
      if (ty instanceof InputSubmit) {
          return "submit";
      };
      if (ty instanceof InputTel) {
          return "tel";
      };
      if (ty instanceof InputText) {
          return "text";
      };
      if (ty instanceof InputTime) {
          return "time";
      };
      if (ty instanceof InputUrl) {
          return "url";
      };
      if (ty instanceof InputWeek) {
          return "week";
      };
      throw new Error("Failed pattern match at Halogen.HTML.Properties.Indexed line 184, column 3 - line 209, column 1: " + [ ty.constructor.name ]);
  };
  var refine = Unsafe_Coerce.unsafeCoerce;              
  var title = refine(Halogen_HTML_Properties_1.title);
  var value = refine(Halogen_HTML_Properties_1.value);      
  var placeholder = refine(Halogen_HTML_Properties_1.placeholder);
  var name = refine(Halogen_HTML_Properties_1.name);
  var inputType = function ($20) {
      return refine(Halogen_HTML_Properties_1.type_)(renderInputType($20));
  };
  var id_ = refine(Halogen_HTML_Properties_1.id_);      
  var $$for = refine(Halogen_HTML_Properties_1["for"]);   
  var class_ = refine(Halogen_HTML_Properties_1.class_);
  var checked = refine(Halogen_HTML_Properties_1.checked);
  exports["InputButton"] = InputButton;
  exports["InputCheckbox"] = InputCheckbox;
  exports["InputColor"] = InputColor;
  exports["InputDate"] = InputDate;
  exports["InputDatetime"] = InputDatetime;
  exports["InputDatetimeLocal"] = InputDatetimeLocal;
  exports["InputEmail"] = InputEmail;
  exports["InputFile"] = InputFile;
  exports["InputHidden"] = InputHidden;
  exports["InputImage"] = InputImage;
  exports["InputMonth"] = InputMonth;
  exports["InputNumber"] = InputNumber;
  exports["InputPassword"] = InputPassword;
  exports["InputRadio"] = InputRadio;
  exports["InputRange"] = InputRange;
  exports["InputReset"] = InputReset;
  exports["InputSearch"] = InputSearch;
  exports["InputSubmit"] = InputSubmit;
  exports["InputTel"] = InputTel;
  exports["InputText"] = InputText;
  exports["InputTime"] = InputTime;
  exports["InputUrl"] = InputUrl;
  exports["InputWeek"] = InputWeek;
  exports["checked"] = checked;
  exports["class_"] = class_;
  exports["for"] = $$for;
  exports["id_"] = id_;
  exports["inputType"] = inputType;
  exports["name"] = name;
  exports["placeholder"] = placeholder;
  exports["title"] = title;
  exports["value"] = value;
})(PS["Halogen.HTML.Properties.Indexed"] = PS["Halogen.HTML.Properties.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Halogen_HTML_Elements_1 = PS["Halogen.HTML.Elements"];
  var Halogen_HTML_Elements_1 = PS["Halogen.HTML.Elements"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];                                    
  var td = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.td);        
  var span = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.span);    
  var label = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.label);
  var input = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.input);  
  var button = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements_1.button);
  exports["button"] = button;
  exports["input"] = input;
  exports["label"] = label;
  exports["span"] = span;
  exports["td"] = td;
})(PS["Halogen.HTML.Elements.Indexed"] = PS["Halogen.HTML.Elements.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];                                      
  var onClick = Halogen_HTML_Core.handler(Halogen_HTML_Core.eventName("click"));
  var input_ = function (f) {
      return function (v) {
          return Data_Function.apply(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_Query.action(f)));
      };
  };
  var input = function (f) {
      return function (x) {
          return Data_Function.apply(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler))(Data_Function.apply(Data_Maybe.Just.create)(Halogen_Query.action(f(x))));
      };
  };
  exports["input"] = input;
  exports["input_"] = input_;
  exports["onClick"] = onClick;
})(PS["Halogen.HTML.Events"] = PS["Halogen.HTML.Events"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Class = PS["Data.Foreign.Class"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Foreign_Index = PS["Data.Foreign.Index"];        
  var addForeignPropHandler = function (dictIsForeign) {
      return function (key) {
          return function (prop) {
              return function (f) {
                  return Halogen_HTML_Core.handler(Halogen_HTML_Core.eventName(key))(function ($2) {
                      return Data_Either.either(Data_Function.apply(Data_Function["const"])(Control_Applicative.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Data_Maybe.Nothing.value)))(f)(Data_Foreign_Class.readProp(dictIsForeign)(Data_Foreign_Index.indexString)(prop)(Data_Foreign.toForeign((function (v) {
                          return v.target;
                      })($2))));
                  });
              };
          };
      };
  };
  var onChecked = addForeignPropHandler(Data_Foreign_Class.booleanIsForeign)("change")("checked"); 
  var onValueInput = addForeignPropHandler(Data_Foreign_Class.stringIsForeign)("input")("value");
  exports["onChecked"] = onChecked;
  exports["onValueInput"] = onValueInput;
})(PS["Halogen.HTML.Events.Forms"] = PS["Halogen.HTML.Events.Forms"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Data_Maybe = PS["Data.Maybe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_1 = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Events_1 = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Events_Forms = PS["Halogen.HTML.Events.Forms"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];        
  var refine$prime = Unsafe_Coerce.unsafeCoerce;
  var refine = Unsafe_Coerce.unsafeCoerce;
  var onValueInput = refine$prime(Halogen_HTML_Events_Forms.onValueInput);
  var onClick = refine(Halogen_HTML_Events_1.onClick);
  var onChecked = refine$prime(Halogen_HTML_Events_Forms.onChecked);
  exports["onChecked"] = onChecked;
  exports["onClick"] = onClick;
  exports["onValueInput"] = onValueInput;
})(PS["Halogen.HTML.Events.Indexed"] = PS["Halogen.HTML.Events.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Foreign = PS["Data.Foreign"];
  var DOM = PS["DOM"];
  var DOM_Event_EventTarget = PS["DOM.Event.EventTarget"];
  var DOM_HTML_Event_EventTypes = PS["DOM.HTML.Event.EventTypes"];
  var DOM_HTML = PS["DOM.HTML"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_HTML_Window = PS["DOM.HTML.Window"];
  var DOM_Node_ParentNode = PS["DOM.Node.ParentNode"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];        
  var selectElement = function (query) {
      return Control_Bind.bind(Control_Monad_Aff.bindAff)(Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))(Data_Functor.map(Control_Monad_Eff.functorEff)(Data_Nullable.toMaybe)(Control_Bind.bindFlipped(Control_Monad_Eff.bindEff)(Control_Bind.composeKleisliFlipped(Control_Monad_Eff.bindEff)(function ($8) {
          return DOM_Node_ParentNode.querySelector(query)(DOM_HTML_Types.htmlDocumentToParentNode($8));
      })(DOM_HTML_Window.document))(DOM_HTML.window))))(function (v) {
          return Control_Applicative.pure(Control_Monad_Aff.applicativeAff)((function () {
              if (v instanceof Data_Maybe.Nothing) {
                  return Data_Maybe.Nothing.value;
              };
              if (v instanceof Data_Maybe.Just) {
                  return Data_Function.apply(Data_Either.either(Data_Function["const"](Data_Maybe.Nothing.value))(Data_Maybe.Just.create))(DOM_HTML_Types.readHTMLElement(Data_Foreign.toForeign(v.value0)));
              };
              throw new Error("Failed pattern match at Halogen.Util line 54, column 3 - line 56, column 76: " + [ v.constructor.name ]);
          })());
      });
  };
  var runHalogenAff = function ($9) {
      return Data_Functor["void"](Control_Monad_Eff.functorEff)(Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Data_Function["const"](Control_Applicative.pure(Control_Monad_Eff.applicativeEff)(Data_Unit.unit)))($9));
  };
  var awaitLoad = Control_Monad_Aff.makeAff(function (v) {
      return function (callback) {
          return Data_Function.apply(Control_Monad_Eff_Class.liftEff(Control_Monad_Eff_Class.monadEffEff))(function __do() {
              var $10 = DOM_HTML.window();
              return DOM_Event_EventTarget.addEventListener(DOM_HTML_Event_EventTypes.load)(DOM_Event_EventTarget.eventListener(function (v1) {
                  return callback(Data_Unit.unit);
              }))(false)(DOM_HTML_Types.windowToEventTarget($10))();
          });
      };
  });
  var awaitBody = Control_Bind.bind(Control_Monad_Aff.bindAff)(awaitLoad)(function () {
      return Control_Bind.bindFlipped(Control_Monad_Aff.bindAff)(Data_Maybe.maybe(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff)(Control_Monad_Eff_Exception.error("Could not find body")))(Control_Applicative.pure(Control_Monad_Aff.applicativeAff)))(selectElement("body"));
  });
  exports["awaitBody"] = awaitBody;
  exports["awaitLoad"] = awaitLoad;
  exports["runHalogenAff"] = runHalogenAff;
  exports["selectElement"] = selectElement;
})(PS["Halogen.Util"] = PS["Halogen.Util"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Function = PS["Data.Function"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var shiftAccountNumberRight = function (digits) {
      return Data_List.concat(new Data_List.Cons(Data_List.take(6)(digits), new Data_List.Cons(new Data_List.Cons(0, Data_List.Nil.value), new Data_List.Cons(Data_List.take(7)(Data_List.drop(6)(digits)), Data_List.Nil.value))));
  };
  var getDigit = function (code) {
      return function (digits) {
          var toEither = function (v) {
              if (v instanceof Data_Maybe.Nothing) {
                  return Data_Function.apply(Data_Either.Left.create)("Implementation error: char index " + (Data_Show.show(Data_Show.showChar)(code) + (" is not valid for digits: " + Data_Show.show(Data_List.showList(Data_Show.showInt))(digits))));
              };
              if (v instanceof Data_Maybe.Just) {
                  return new Data_Either.Right(v.value0);
              };
              throw new Error("Failed pattern match at ModulusCheck.Data.AccountNumber line 46, column 5 - line 46, column 128: " + [ v.constructor.name ]);
          };
          return toEither(Control_Bind.bind(Data_Maybe.bindMaybe)(Data_String.indexOf(Data_String.singleton(code))("uvwxyzabcdefgh"))(function (v) {
              return Data_List.index(digits)(v);
          }));
      };
  };
  var expectedDigitsLength = 14;
  var replacePrefix = function (newPrefix) {
      return function (x) {
          var replacementLength = Data_List.length(newPrefix);
          var newDigits = (function () {
              if (replacementLength > expectedDigitsLength) {
                  return Data_Function.apply(Data_Either.Left.create)("Implementation error: cannot replace with new prefix: " + (Data_Show.show(Data_List.showList(Data_Show.showInt))(newPrefix) + ("in " + Data_Show.show(Data_List.showList(Data_Show.showInt))(x))));
              };
              if (Data_Boolean.otherwise) {
                  return Data_Function.apply(Data_Either.Right.create)(Data_List.concat(new Data_List.Cons(newPrefix, new Data_List.Cons(Data_List.drop(replacementLength)(x), Data_List.Nil.value))));
              };
              throw new Error("Failed pattern match at ModulusCheck.Data.AccountNumber line 54, column 5 - line 56, column 111: " + [  ]);
          })();
          return newDigits;
      };
  };
  var accountNumber = function (sortCodeString) {
      return function (digits) {
          return {
              sortCodeString: sortCodeString, 
              digits: digits
          };
      };
  };
  exports["accountNumber"] = accountNumber;
  exports["getDigit"] = getDigit;
  exports["replacePrefix"] = replacePrefix;
  exports["shiftAccountNumberRight"] = shiftAccountNumberRight;
})(PS["ModulusCheck.Data.AccountNumber"] = PS["ModulusCheck.Data.AccountNumber"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_List = PS["Data.List"];
  var Data_Show = PS["Data.Show"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];        
  var DblAl = (function () {
      function DblAl() {

      };
      DblAl.value = new DblAl();
      return DblAl;
  })();
  var Mod10 = (function () {
      function Mod10() {

      };
      Mod10.value = new Mod10();
      return Mod10;
  })();
  var Mod11 = (function () {
      function Mod11() {

      };
      Mod11.value = new Mod11();
      return Mod11;
  })();
  var zeroiseUtoB = function (row) {
      var zeroPrefix = Data_Functor.map(Data_List.functorList)(Data_Function["const"](0))(Data_List.range(1)(8));
      var drop8 = Data_List.drop(8)(row.weights);
      var $1 = {};
      for (var $2 in row) {
          if (row.hasOwnProperty($2)) {
              $1[$2] = row[$2];
          };
      };
      $1.weights = Data_List.concat(new Data_List.Cons(zeroPrefix, new Data_List.Cons(drop8, Data_List.Nil.value)));
      return $1;
  };
  var checkRow = function (from) {
      return function (to) {
          return function (checkMethod) {
              return function (weights) {
                  return function (exceptionCode) {
                      return {
                          from: from, 
                          to: to, 
                          checkMethod: checkMethod, 
                          weights: weights, 
                          exceptionCode: exceptionCode
                      };
                  };
              };
          };
      };
  };
  exports["DblAl"] = DblAl;
  exports["Mod10"] = Mod10;
  exports["Mod11"] = Mod11;
  exports["checkRow"] = checkRow;
  exports["zeroiseUtoB"] = zeroiseUtoB;
})(PS["ModulusCheck.Data.CheckRow"] = PS["ModulusCheck.Data.CheckRow"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_String = PS["Data.String"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Ring = PS["Data.Ring"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];        
  var Position = (function () {
      function Position(value0) {
          this.value0 = value0;
      };
      Position.create = function (value0) {
          return new Position(value0);
      };
      return Position;
  })();
  var updatePosString = function (pos) {
      return function (str) {
          var updatePosChar = function (v) {
              return function (c) {
                  if (c === "\n") {
                      return new Position({
                          line: v.value0.line + 1 | 0, 
                          column: 1
                      });
                  };
                  if (c === "\r") {
                      return new Position({
                          line: v.value0.line + 1 | 0, 
                          column: 1
                      });
                  };
                  if (c === "\t") {
                      return new Position({
                          line: v.value0.line, 
                          column: (v.value0.column + 8 | 0) - (v.value0.column - 1) % 8
                      });
                  };
                  return new Position({
                      line: v.value0.line, 
                      column: v.value0.column + 1 | 0
                  });
              };
          };
          return Data_Foldable.foldl(Data_Foldable.foldableArray)(updatePosChar)(pos)(Data_String.split("")(str));
      };
  }; 
  var initialPos = new Position({
      line: 1, 
      column: 1
  });
  exports["Position"] = Position;
  exports["initialPos"] = initialPos;
  exports["updatePosString"] = updatePosString;
})(PS["Text.Parsing.Parser.Pos"] = PS["Text.Parsing.Parser.Pos"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Data_Show = PS["Data.Show"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Function = PS["Data.Function"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad = PS["Control.Monad"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];        
  var ParseError = (function () {
      function ParseError(value0) {
          this.value0 = value0;
      };
      ParseError.create = function (value0) {
          return new ParseError(value0);
      };
      return ParseError;
  })();
  var PState = (function () {
      function PState(value0) {
          this.value0 = value0;
      };
      PState.create = function (value0) {
          return new PState(value0);
      };
      return PState;
  })();
  var ParserT = function (x) {
      return x;
  };
  var unParserT = function (v) {
      return v;
  }; 
  var runParserT = function (dictMonad) {
      return function (s) {
          return function (p) {
              return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p)(s))(function (v) {
                  return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(v.result);
              });
          };
      };
  };
  var runParser = function (s) {
      return function ($65) {
          return Data_Identity.runIdentity(runParserT(Data_Identity.monadIdentity)(new PState({
              input: s, 
              position: Text_Parsing_Parser_Pos.initialPos
          }))($65));
      };
  };
  var parseFailed = function (s) {
      return function (pos) {
          return function (message) {
              return {
                  input: s, 
                  consumed: false, 
                  result: new Data_Either.Left(new ParseError({
                      message: message, 
                      position: pos
                  })), 
                  position: pos
              };
          };
      };
  }; 
  var lazyParserT = new Control_Lazy.Lazy(function (f) {
      return Data_Function.apply(ParserT)(function (s) {
          return unParserT(f(Data_Unit.unit))(s);
      });
  });
  var functorParserT = function (dictFunctor) {
      return new Data_Functor.Functor(function (f) {
          return function (p) {
              var f$prime = function (o) {
                  return {
                      input: o.input, 
                      result: Data_Functor.map(Data_Either.functorEither)(f)(o.result), 
                      consumed: o.consumed, 
                      position: o.position
                  };
              };
              return Data_Function.apply(ParserT)(function (s) {
                  return Data_Functor.map(dictFunctor)(f$prime)(unParserT(p)(s));
              });
          };
      });
  };
  var fail = function (dictMonad) {
      return function (message) {
          return Data_Function.apply(ParserT)(function (v) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))(parseFailed(v.value0.input)(v.value0.position)(message));
          });
      };
  };
  var monadParserT = function (dictMonad) {
      return new Control_Monad.Monad(function () {
          return applicativeParserT(dictMonad);
      }, function () {
          return bindParserT(dictMonad);
      });
  };
  var bindParserT = function (dictMonad) {
      return new Control_Bind.Bind(function () {
          return applyParserT(dictMonad);
      }, function (p) {
          return function (f) {
              var updateConsumedFlag = function (c) {
                  return function (o) {
                      return {
                          input: o.input, 
                          consumed: c || o.consumed, 
                          result: o.result, 
                          position: o.position
                      };
                  };
              };
              return Data_Function.apply(ParserT)(function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p)(s))(function (o) {
                      if (o.result instanceof Data_Either.Left) {
                          return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())({
                              input: o.input, 
                              result: new Data_Either.Left(o.result.value0), 
                              consumed: o.consumed, 
                              position: o.position
                          });
                      };
                      if (o.result instanceof Data_Either.Right) {
                          return Data_Functor.map(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(updateConsumedFlag(o.consumed))(unParserT(f(o.result.value0))(new PState({
                              input: o.input, 
                              position: o.position
                          })));
                      };
                      throw new Error("Failed pattern match at Text.Parsing.Parser line 79, column 5 - line 81, column 117: " + [ o.result.constructor.name ]);
                  });
              });
          };
      });
  };
  var applyParserT = function (dictMonad) {
      return new Control_Apply.Apply(function () {
          return functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, Control_Monad.ap(monadParserT(dictMonad)));
  };
  var applicativeParserT = function (dictMonad) {
      return new Control_Applicative.Applicative(function () {
          return applyParserT(dictMonad);
      }, function (a) {
          return Data_Function.apply(ParserT)(function (v) {
              return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())({
                  input: v.value0.input, 
                  result: new Data_Either.Right(a), 
                  consumed: false, 
                  position: v.value0.position
              });
          });
      });
  };
  var altParserT = function (dictMonad) {
      return new Control_Alt.Alt(function () {
          return functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]());
      }, function (p1) {
          return function (p2) {
              return Data_Function.apply(ParserT)(function (s) {
                  return Control_Bind.bind(dictMonad["__superclass_Control.Bind.Bind_1"]())(unParserT(p1)(s))(function (o) {
                      if (o.result instanceof Data_Either.Left && !o.consumed) {
                          return unParserT(p2)(s);
                      };
                      return Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]())(o);
                  });
              });
          };
      });
  };
  var plusParserT = function (dictMonad) {
      return new Control_Plus.Plus(function () {
          return altParserT(dictMonad);
      }, fail(dictMonad)("No alternative"));
  };
  var alternativeParserT = function (dictMonad) {
      return new Control_Alternative.Alternative(function () {
          return applicativeParserT(dictMonad);
      }, function () {
          return plusParserT(dictMonad);
      });
  };
  exports["PState"] = PState;
  exports["ParseError"] = ParseError;
  exports["ParserT"] = ParserT;
  exports["fail"] = fail;
  exports["parseFailed"] = parseFailed;
  exports["runParser"] = runParser;
  exports["runParserT"] = runParserT;
  exports["unParserT"] = unParserT;
  exports["functorParserT"] = functorParserT;
  exports["applyParserT"] = applyParserT;
  exports["applicativeParserT"] = applicativeParserT;
  exports["altParserT"] = altParserT;
  exports["plusParserT"] = plusParserT;
  exports["alternativeParserT"] = alternativeParserT;
  exports["bindParserT"] = bindParserT;
  exports["monadParserT"] = monadParserT;
  exports["lazyParserT"] = lazyParserT;
})(PS["Text.Parsing.Parser"] = PS["Text.Parsing.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Control_Alt = PS["Control.Alt"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Apply = PS["Control.Apply"];        
  var withErrorMessage = function (dictMonad) {
      return function (p) {
          return function (msg) {
              return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(p)(Text_Parsing_Parser.fail(dictMonad)("Expected " + msg));
          };
      };
  };
  var $$try = function (dictFunctor) {
      return function (p) {
          var try$prime = function (v) {
              return function (v1) {
                  return function (v2) {
                      if (v2.result instanceof Data_Either.Left) {
                          return {
                              input: v, 
                              result: v2.result, 
                              consumed: false, 
                              position: v1
                          };
                      };
                      return v2;
                  };
              };
          };
          return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
              return Data_Functor.map(dictFunctor)(try$prime(v.value0.input)(v.value0.position))(Text_Parsing_Parser.unParserT(p)(new Text_Parsing_Parser.PState({
                  input: v.value0.input, 
                  position: v.value0.position
              })));
          });
      };
  };
  var sepEndBy1 = function (dictMonad) {
      return function (p) {
          return function (sep) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(p)(function (v) {
                  return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(sep)(function () {
                      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(sepEndBy(dictMonad)(p)(sep))(function (v1) {
                          return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(new Data_List.Cons(v, v1));
                      });
                  }))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_List.singleton(v)));
              });
          };
      };
  };
  var sepEndBy = function (dictMonad) {
      return function (p) {
          return function (sep) {
              return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(sepEndBy1(dictMonad)(p)(sep))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_List.Nil.value));
          };
      };
  };
  var optional = function (dictMonad) {
      return function (p) {
          return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(p)(function () {
              return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit);
          }))(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(Data_Unit.unit));
      };
  };
  var option = function (dictMonad) {
      return function (a) {
          return function (p) {
              return Control_Alt.alt(Text_Parsing_Parser.altParserT(dictMonad))(p)(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(a));
          };
      };
  };
  var optionMaybe = function (dictMonad) {
      return function (p) {
          return option(dictMonad)(Data_Maybe.Nothing.value)(Data_Functor.map(Text_Parsing_Parser.functorParserT(((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]()))(Data_Maybe.Just.create)(p));
      };
  };
  exports["option"] = option;
  exports["optionMaybe"] = optionMaybe;
  exports["optional"] = optional;
  exports["sepEndBy"] = sepEndBy;
  exports["sepEndBy1"] = sepEndBy1;
  exports["try"] = $$try;
  exports["withErrorMessage"] = withErrorMessage;
})(PS["Text.Parsing.Parser.Combinators"] = PS["Text.Parsing.Parser.Combinators"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Unit = PS["Data.Unit"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Eq = PS["Data.Eq"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];        
  var string = function (dictMonad) {
      return function (str) {
          return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
              return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
                  var $16 = Data_String.indexOf(str)(v.value0.input);
                  if ($16 instanceof Data_Maybe.Just && $16.value0 === 0) {
                      return {
                          consumed: true, 
                          input: Data_String.drop(Data_String.length(str))(v.value0.input), 
                          result: new Data_Either.Right(str), 
                          position: Text_Parsing_Parser_Pos.updatePosString(v.value0.position)(str)
                      };
                  };
                  return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Expected " + str);
              })());
          });
      };
  };
  var eof = function (dictMonad) {
      return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
          return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
              if (v.value0.input === "") {
                  return {
                      consumed: false, 
                      input: v.value0.input, 
                      result: new Data_Either.Right(Data_Unit.unit), 
                      position: v.value0.position
                  };
              };
              return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Expected EOF");
          })());
      });
  };
  var anyChar = function (dictMonad) {
      return Data_Function.apply(Text_Parsing_Parser.ParserT)(function (v) {
          return Data_Function.apply(Control_Applicative.pure(dictMonad["__superclass_Control.Applicative.Applicative_0"]()))((function () {
              var $27 = Data_String.charAt(0)(v.value0.input);
              if ($27 instanceof Data_Maybe.Nothing) {
                  return Text_Parsing_Parser.parseFailed(v.value0.input)(v.value0.position)("Unexpected EOF");
              };
              if ($27 instanceof Data_Maybe.Just) {
                  return {
                      consumed: true, 
                      input: Data_String.drop(1)(v.value0.input), 
                      result: new Data_Either.Right($27.value0), 
                      position: Text_Parsing_Parser_Pos.updatePosString(v.value0.position)(Data_String.singleton($27.value0))
                  };
              };
              throw new Error("Failed pattern match at Text.Parsing.Parser.String line 33, column 3 - line 35, column 113: " + [ $27.constructor.name ]);
          })());
      });
  };
  var satisfy = function (dictMonad) {
      return function (f) {
          return Text_Parsing_Parser_Combinators["try"](((dictMonad["__superclass_Control.Bind.Bind_1"]())["__superclass_Control.Apply.Apply_0"]())["__superclass_Data.Functor.Functor_0"]())(Control_Bind.bind(Text_Parsing_Parser.bindParserT(dictMonad))(anyChar(dictMonad))(function (v) {
              var $33 = f(v);
              if ($33) {
                  return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(dictMonad))(v);
              };
              if (!$33) {
                  return Data_Function.apply(Text_Parsing_Parser.fail(dictMonad))("Character '" + (Data_String.singleton(v) + "' did not satisfy predicate"));
              };
              throw new Error("Failed pattern match at Text.Parsing.Parser.String line 41, column 3 - line 44, column 1: " + [ $33.constructor.name ]);
          }));
      };
  };
  exports["anyChar"] = anyChar;
  exports["eof"] = eof;
  exports["satisfy"] = satisfy;
  exports["string"] = string;
})(PS["Text.Parsing.Parser.String"] = PS["Text.Parsing.Parser.String"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Data_Array = PS["Data.Array"];
  var Data_Char = PS["Data.Char"];
  var Data_Char_Unicode_1 = PS["Data.Char.Unicode"];
  var Data_Char_Unicode_1 = PS["Data.Char.Unicode"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Int = PS["Data.Int"];
  var Data_List_1 = PS["Data.List"];
  var Data_List_1 = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Data_Tuple = PS["Data.Tuple"];
  var $$Math = PS["Math"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Text_Parsing_Parser_String = PS["Text.Parsing.Parser.String"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Control_Bind = PS["Control.Bind"];
  var Control_MonadZero = PS["Control.MonadZero"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Eq = PS["Data.Eq"];
  var Data_Ordering = PS["Data.Ordering"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Control_Alt = PS["Control.Alt"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Ring = PS["Data.Ring"];
  var Control_Category = PS["Control.Category"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Show = PS["Data.Show"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Unfoldable = PS["Data.Unfoldable"];
  var digit = function (dictMonad) {
      return Text_Parsing_Parser_Combinators.withErrorMessage(dictMonad)(Text_Parsing_Parser_String.satisfy(dictMonad)(Data_Char_Unicode_1.isDigit))("digit");
  };
  exports["digit"] = digit;
})(PS["Text.Parsing.Parser.Token"] = PS["Text.Parsing.Parser.Token"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Data_List = PS["Data.List"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Int = PS["Data.Int"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Pos = PS["Text.Parsing.Parser.Pos"];
  var Text_Parsing_Parser_String = PS["Text.Parsing.Parser.String"];
  var Text_Parsing_Parser_Token = PS["Text.Parsing.Parser.Token"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Function = PS["Data.Function"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Eq = PS["Data.Eq"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Unit = PS["Data.Unit"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Data_Show = PS["Data.Show"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Ring = PS["Data.Ring"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Boolean = PS["Data.Boolean"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Semiring = PS["Data.Semiring"];        
  var whiteSpace = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Data_Function.apply(Data_List.many(Text_Parsing_Parser.alternativeParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser.lazyParserT))(Text_Parsing_Parser_String.satisfy(Data_Identity.monadIdentity)(function (c) {
      return c === " " || c === "\t";
  })))(function () {
      return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(Data_Unit.unit);
  });
  var parseWithError = function (error) {
      return function (input) {
          return function (p) {
              return Data_Function.apply(Data_Bifunctor.lmap(Data_Either.bifunctorEither)(Data_Function["const"](error)))(Text_Parsing_Parser.runParser(input)(p));
          };
      };
  };
  var parseErrorToError = function (v) {
      return v.value0.message + (", line: " + (Data_Show.show(Data_Show.showInt)(v.value0.position.value0.line) + (", column: " + Data_Show.show(Data_Show.showInt)(v.value0.position.value0.column))));
  };
  var parse = function (input) {
      return function (p) {
          return Data_Function.apply(Data_Bifunctor.lmap(Data_Either.bifunctorEither)(parseErrorToError))(Text_Parsing_Parser.runParser(input)(p));
      };
  };
  var exactly = function (n) {
      return function (p) {
          var loop = function (n1) {
              return function (a) {
                  if (n1 === 1) {
                      return a;
                  };
                  if (n1 > 1) {
                      return Data_Function.apply(loop(n1 - 1))(Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Data_Identity.functorIdentity))(Data_List.Cons.create)(p))(a));
                  };
                  if (Data_Boolean.otherwise) {
                      return Text_Parsing_Parser.fail(Data_Identity.monadIdentity)("negative or zero n in exactly");
                  };
                  throw new Error("Failed pattern match at ModulusCheck.Parsers line 52, column 5 - line 57, column 1: " + [ n1.constructor.name, a.constructor.name ]);
              };
          };
          var initial = Data_Functor.map(Text_Parsing_Parser.functorParserT(Data_Identity.functorIdentity))(Data_Function.flip(Data_List.Cons.create)(Data_List.Nil.value))(p);
          return loop(n)(initial);
      };
  };
  var stringDigitsParser = function (n) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(exactly(n)(Text_Parsing_Parser_Token.digit(Data_Identity.monadIdentity)))(function ($18) {
          return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(Data_Foldable.foldl(Data_List.foldableList)(function (a) {
              return function (x) {
                  return a + Data_String.singleton(x);
              };
          })("")($18));
      });
  };
  var eol = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Data_Function.apply(Data_List.many(Text_Parsing_Parser.alternativeParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser.lazyParserT))(Text_Parsing_Parser_String.satisfy(Data_Identity.monadIdentity)(function (c) {
      return c === "\n" || c === "\r";
  })))(function () {
      return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(Data_Unit.unit);
  });
  var digitParser = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_Token.digit(Data_Identity.monadIdentity))(function (v) {
      var $14 = Data_Function.apply(Data_Int.fromString)(Data_String.singleton(v));
      if ($14 instanceof Data_Maybe.Just) {
          return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))($14.value0);
      };
      if ($14 instanceof Data_Maybe.Nothing) {
          return Data_Function.apply(Text_Parsing_Parser.fail(Data_Identity.monadIdentity))("expected digit, got: " + Data_Show.show(Data_Show.showChar)(v));
      };
      throw new Error("Failed pattern match at ModulusCheck.Parsers line 42, column 3 - line 44, column 56: " + [ $14.constructor.name ]);
  });
  var digitsParser = function (n) {
      return exactly(n)(digitParser);
  };
  var integerParser = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(digitParser)(function (v) {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Data_List.many(Text_Parsing_Parser.alternativeParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser.lazyParserT)(digitParser))(function (v1) {
          return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity)))(Data_Foldable.foldl(Data_List.foldableList)(function (a) {
              return function (x) {
                  return (a * 10 | 0) + x | 0;
              };
          })(0)(new Data_List.Cons(v, v1)));
      });
  });
  var signedIntegerParser = Control_Alt.alt(Text_Parsing_Parser.altParserT(Data_Identity.monadIdentity))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_String.string(Data_Identity.monadIdentity)("-"))(integerParser))(function (x) {
      return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity)))(-x);
  }))(integerParser);
  exports["digitsParser"] = digitsParser;
  exports["eol"] = eol;
  exports["exactly"] = exactly;
  exports["integerParser"] = integerParser;
  exports["parse"] = parse;
  exports["parseWithError"] = parseWithError;
  exports["signedIntegerParser"] = signedIntegerParser;
  exports["stringDigitsParser"] = stringDigitsParser;
  exports["whiteSpace"] = whiteSpace;
})(PS["ModulusCheck.Parsers"] = PS["ModulusCheck.Parsers"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Apply = PS["Control.Apply"];
  var Data_List = PS["Data.List"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_String = PS["Text.Parsing.Parser.String"];
  var ModulusCheck_Data_CheckRow = PS["ModulusCheck.Data.CheckRow"];
  var ModulusCheck_Parsers = PS["ModulusCheck.Parsers"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Functor = PS["Data.Functor"];        
  var checkMethodParser = Control_Alt.alt(Text_Parsing_Parser.altParserT(Data_Identity.monadIdentity))(Control_Alt.alt(Text_Parsing_Parser.altParserT(Data_Identity.monadIdentity))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_String.string(Data_Identity.monadIdentity)("DBLAL"))(Data_Function["const"](Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(ModulusCheck_Data_CheckRow.DblAl.value))))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_String.string(Data_Identity.monadIdentity)("MOD10"))(Data_Function["const"](Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(ModulusCheck_Data_CheckRow.Mod10.value)))))(Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_String.string(Data_Identity.monadIdentity)("MOD11"))(Data_Function["const"](Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(ModulusCheck_Data_CheckRow.Mod11.value))));
  var checkRowParser = Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Data_Identity.functorIdentity))(ModulusCheck_Data_CheckRow.checkRow)(ModulusCheck_Parsers.stringDigitsParser(6)))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(ModulusCheck_Parsers.stringDigitsParser(6))))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(checkMethodParser)))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(ModulusCheck_Parsers.exactly(14)(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(ModulusCheck_Parsers.signedIntegerParser)))))(Text_Parsing_Parser_Combinators.optionMaybe(Data_Identity.monadIdentity)(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(ModulusCheck_Parsers.integerParser)));
  var checkRowTableParser = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.eol)(ModulusCheck_Parsers.whiteSpace))(function () {
      return Text_Parsing_Parser_Combinators.sepEndBy1(Data_Identity.monadIdentity)(checkRowParser)(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.eol)(ModulusCheck_Parsers.whiteSpace));
  });
  exports["checkRowTableParser"] = checkRowTableParser;
})(PS["ModulusCheck.Data.CheckRow.Parser"] = PS["ModulusCheck.Data.CheckRow.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Map = PS["Data.Map"];
  var Data_Tuple = PS["Data.Tuple"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var ModulusCheck_Data_AccountNumber = PS["ModulusCheck.Data.AccountNumber"];
  var ModulusCheck_Data_SubstitutionRow = PS["ModulusCheck.Data.SubstitutionRow"];
  var ModulusCheck_Parsers = PS["ModulusCheck.Parsers"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Ord = PS["Data.Ord"];
  var Data_List = PS["Data.List"];        
  var substitutionRowParser = Control_Apply.apply(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Data_Functor.map(Text_Parsing_Parser.functorParserT(Data_Identity.functorIdentity))(Data_Tuple.Tuple.create)(ModulusCheck_Parsers.stringDigitsParser(6)))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.whiteSpace)(ModulusCheck_Parsers.digitsParser(6)));
  var sortCodeSubstitutionTableParser = Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.eol)(ModulusCheck_Parsers.whiteSpace))(function () {
      return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_Combinators.sepEndBy1(Data_Identity.monadIdentity)(substitutionRowParser)(Control_Apply.applySecond(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.eol)(ModulusCheck_Parsers.whiteSpace)))(function (v) {
          return Data_Function.apply(Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity)))(Data_Map.fromFoldable(Data_Ord.ordString)(Data_List.foldableList)(v));
      });
  });
  exports["sortCodeSubstitutionTableParser"] = sortCodeSubstitutionTableParser;
})(PS["ModulusCheck.Data.SubstitutionRow.Parser"] = PS["ModulusCheck.Data.SubstitutionRow.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var valacdos_v390 = "\n  010004 016715 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  050000 050020 MOD11    0    0    0    0    0    0    2    1    7    5    8    2    4    1\n  050022 058999 MOD11    0    0    0    0    0    0    2    1    7    5    8    2    4    1\n  070116 070116 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1  12\n  070116 070116 MOD10    0    3    2    4    5    8    9    4    5    6    7    8    9   -1  13\n  070246 070246 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  070436 070436 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  070806 070806 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  070976 070976 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  071096 071096 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  071226 071226 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  071306 071306 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  071986 071986 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1\n  074456 074456 MOD11    0    0    7    6    5    8    9    4    5    6    7    8    9   -1  12\n  074456 074456 MOD10    0    3    2    4    5    8    9    4    5    6    7    8    9   -1  13\n  080211 080211 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  080228 080228 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  086001 086001 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  086020 086020 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  086086 086086 MOD11    0    0    0    0    0    8    9    4    5    6    7    8    9   -1\n  086090 086090 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1   8\n  089000 089999 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  090013 090013 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090105 090105 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090118 090118 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  090126 090129 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090131 090136 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  090150 090156 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  090180 090185 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090190 090196 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090204 090204 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090222 090222 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090356 090356 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  090500 090599 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090704 090704 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090705 090705 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090710 090710 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090715 090715 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090720 090726 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  090736 090739 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  090790 090790 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  091600 091600 MOD10    0    0    0    0    0    1    7    1    3    7    1    3    7    1\n  091601 091601 MOD10    0    0    3    7    1    3    7    1    3    7    1    3    7    1\n  091740 091743 MOD10    0    0    0    0    0    1    7    1    3    7    1    3    7    1\n  091800 091809 MOD10    0    0    0    0    0    1    7    1    3    7    1    3    7    1\n  091811 091865 MOD10    0    0    0    0    0    1    7    1    3    7    1    3    7    1\n  100000 101099 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  101101 101498 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  101500 101999 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  102400 107999 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  108000 108079 MOD11    0    0    0    0    0    3    2    7    6    5    4    3    2    1\n  108080 108099 MOD11    0    0    0    0    4    3    2    7    6    5    4    3    2    1\n  108100 109999 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  110000 119280 DBLAL    0    0    2    1    2    1    2    1    2    1    2    1    2    1   1\n  119282 119283 DBLAL    0    0    2    1    2    1    2    1    2    1    2    1    2    1   1\n  119285 119999 DBLAL    0    0    2    1    2    1    2    1    2    1    2    1    2    1   1\n  120000 120961 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  120963 122009 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  122011 122101 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  122103 122129 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  122131 122135 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  122213 122299 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  122400 122999 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  124000 124999 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  133000 133999 MOD11    0    0    0    0    0   10    7    8    4    6    3    5    2    1\n  134012 134020 MOD11    0    0    0    7    5    9    8    4    6    3    5    2    0    0   4\n  134121 134121 MOD11    0    0    0    1    0    0    8    4    6    3    5    2    0    0   4\n  150000 158000 MOD11    4    3    0    0    0    0    2    7    6    5    4    3    2    1\n  159800 159800 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  159900 159900 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  159910 159910 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  160000 161027 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161029 161029 MOD11    0    0    0    0    0    0    2    7    6    5    4    3    2    1\n  161030 161041 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161050 161050 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161055 161055 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161060 161060 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161065 161065 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161070 161070 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161075 161075 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161080 161080 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161085 161085 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161090 161090 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  161100 162028 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  162030 164300 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  165901 166001 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  166050 167600 MOD11    0    0    6    5    4    3    2    7    6    5    4    3    2    1\n  168600 168600 MOD11    0    0    0    0    0    0    2    7    6    5    4    3    2    1\n  170000 179499 MOD11    0    0    4    2    7    9    2    7    6    5    4    3    2    1\n  180002 180002 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180005 180005 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180009 180009 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180036 180036 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180038 180038 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180091 180092 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180104 180104 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180109 180110 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  180156 180156 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  185001 185001 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1  14\n  185003 185025 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  185027 185099 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  200000 200002 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200000 200002 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200004 200004 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200004 200004 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200051 200077 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200051 200077 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200079 200097 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200079 200097 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200099 200156 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200099 200156 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200158 200387 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200158 200387 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200403 200405 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200403 200405 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200407 200407 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200407 200407 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200411 200412 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200411 200412 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200414 200423 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200414 200423 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200425 200899 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200425 200899 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  200901 201159 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  200901 201159 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  201161 201177 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  201161 201177 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  201179 201351 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  201179 201351 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  201353 202698 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  201353 202698 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  202700 203239 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  202700 203239 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  203241 203255 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  203241 203255 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  203259 203519 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  203259 203519 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  203521 204476 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  203521 204476 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  204478 205475 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  204478 205475 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  205477 205954 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  205477 205954 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  205956 206124 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  205956 206124 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  206126 206157 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  206126 206157 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  206159 206390 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  206159 206390 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  206392 206799 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  206392 206799 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  206802 206874 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  206802 206874 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  206876 207170 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  206876 207170 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  207173 208092 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  207173 208092 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  208094 208721 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  208094 208721 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  208723 209034 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  208723 209034 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  209036 209128 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  209036 209128 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  209130 209999 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1   6\n  209130 209999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   6\n  230338 230338 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  230338 230338 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  230580 230580 MOD11    0    0    0    0    0    0    2    7    6    5    4    3    2    1  12\n  230580 230580 MOD11    0    0    0    0    0    0    5    7    6    5    4    3    2    1  13\n  230614 230614 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  230614 230614 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  230709 230709 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  230709 230709 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  230872 230872 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  230872 230872 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  230933 230933 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  230933 230933 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231018 231018 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231018 231018 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231213 231213 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231213 231213 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231354 231354 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231354 231354 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231469 231469 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231469 231469 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231558 231558 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231558 231558 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231679 231679 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231679 231679 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231843 231843 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231843 231843 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  231985 231985 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  231985 231985 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232130 232130 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232130 232130 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232279 232279 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232279 232279 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232283 232283 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232283 232283 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232445 232445 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232445 232445 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232571 232571 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232571 232571 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232636 232636 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232636 232636 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232704 232704 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232704 232704 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232725 232725 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232725 232725 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232813 232813 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232813 232813 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  232939 232939 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  232939 232939 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233080 233080 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233080 233080 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233142 233142 MOD10    2    1    2    1    2    1   30   36   24   20   16   12    8    4\n  233171 233171 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233171 233171 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233188 233188 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233188 233188 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233231 233231 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233231 233231 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233344 233344 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233344 233344 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233438 233438 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233438 233438 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233456 233456 MOD10    2    1    2    1    2    1    0   64   32   16    8    4    2    1\n  233483 233483 MOD11    0    0    0    0    0    0    2    7    6    5    4    3    2    1\n  233556 233556 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233556 233556 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233658 233658 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233658 233658 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233693 233693 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233693 233693 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  233752 233752 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  233752 233752 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234081 234081 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234081 234081 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234193 234193 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234193 234193 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234252 234252 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234252 234252 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234321 234321 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234321 234321 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234377 234377 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234377 234377 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234570 234570 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234570 234570 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234666 234666 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234666 234666 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234779 234779 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234779 234779 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234828 234828 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234828 234828 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  234985 234985 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  234985 234985 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235054 235054 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235054 235054 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235164 235164 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235164 235164 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235262 235262 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235262 235262 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235323 235323 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235323 235323 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235451 235451 MOD11    0    0    0    0    0    0    2    7    6    5    4    3    2    1\n  235459 235459 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235459 235459 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235519 235519 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235519 235519 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235676 235676 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235676 235676 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235711 235711 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235711 235711 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235756 235756 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235756 235756 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  235945 235945 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  235945 235945 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236006 236006 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236006 236006 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236119 236119 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236119 236119 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236233 236233 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236233 236233 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236247 236247 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  236293 236293 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236293 236293 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236422 236422 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236422 236422 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236527 236527 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236527 236527 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236538 236538 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236538 236538 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236643 236643 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236643 236643 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236761 236761 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236761 236761 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  236907 236907 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  236907 236907 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237130 237130 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237130 237130 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237265 237265 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237265 237265 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237355 237355 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237355 237355 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237423 237423 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237423 237423 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237427 237427 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237427 237427 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237563 237563 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237563 237563 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237622 237622 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237622 237622 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237728 237728 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237728 237728 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  237873 237873 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  237873 237873 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238020 238020 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238020 238020 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238043 238043 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238043 238043 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238051 238051 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238051 238051 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238175 238175 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238175 238175 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238257 238257 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238257 238257 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238392 238431 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  238392 238431 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238432 238432 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238432 238432 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238433 238583 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  238433 238583 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238585 238590 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  238585 238590 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238599 238599 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238599 238599 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238613 238613 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238613 238613 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238672 238672 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238672 238672 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238717 238717 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238717 238717 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  238890 238899 MOD11    0    0    0    0    4    3    2    7    6    5    4    3    2    1\n  238908 238908 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  238908 238908 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239071 239071 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239071 239071 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239126 239126 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239126 239126 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239136 239140 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  239136 239140 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239143 239144 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  239143 239144 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239282 239283 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  239282 239283 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239285 239294 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  239285 239294 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239295 239295 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239295 239295 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239296 239318 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  239296 239318 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239360 239360 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239360 239360 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239380 239380 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239380 239380 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239435 239435 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239435 239435 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239525 239525 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239525 239525 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239642 239642 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239642 239642 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  239751 239751 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  239751 239751 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  300000 300006 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  300000 300006 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  300008 300009 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  300008 300009 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  300050 300051 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  300134 300138 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  300134 300138 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  300161 300161 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1\n  300176 300176 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1\n  301001 301001 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301001 301001 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301004 301004 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301004 301004 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301007 301007 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301007 301007 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301012 301012 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301012 301012 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301022 301022 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301027 301027 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301047 301047 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301047 301047 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301049 301049 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301049 301049 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301052 301052 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301052 301052 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301075 301076 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301075 301076 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301108 301108 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301108 301108 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301112 301112 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301112 301112 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301127 301127 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301127 301127 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301137 301137 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301142 301142 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301148 301148 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301148 301148 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301154 301155 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301161 301161 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301161 301161 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301166 301166 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301170 301170 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301174 301175 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301174 301175 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301191 301191 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301191 301191 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301194 301195 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301194 301195 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301204 301205 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301204 301205 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301209 301210 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301209 301210 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301215 301215 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301215 301215 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301218 301218 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301218 301218 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301220 301221 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301220 301221 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301234 301234 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301234 301234 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301251 301251 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301251 301251 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301259 301259 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301259 301259 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301274 301274 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301274 301274 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301280 301280 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301280 301280 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301286 301286 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301286 301286 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301295 301296 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301295 301296 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301299 301299 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301299 301299 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301301 301301 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301301 301301 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301305 301305 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301305 301305 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301318 301318 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301318 301318 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301330 301330 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301330 301330 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301332 301332 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301332 301332 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301335 301335 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301335 301335 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301342 301342 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301342 301342 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301350 301355 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301350 301355 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301364 301364 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301364 301364 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301368 301368 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301368 301368 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301376 301376 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301376 301376 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301380 301380 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301380 301380 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301388 301388 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301388 301388 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301390 301390 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301390 301390 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301395 301395 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301395 301395 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301400 301400 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301400 301400 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301424 301424 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301424 301424 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301432 301432 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301432 301432 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301433 301433 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301435 301435 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301437 301437 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301437 301437 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301439 301439 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301440 301440 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301440 301440 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301443 301443 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301444 301444 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301444 301444 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301447 301447 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301447 301447 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301451 301451 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301451 301451 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301456 301456 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301456 301456 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301458 301458 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301460 301460 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301460 301460 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301463 301463 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301464 301464 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301464 301464 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301466 301466 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301469 301469 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301469 301469 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301471 301471 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301471 301471 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301474 301474 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301477 301477 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301477 301477 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301482 301482 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301483 301483 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301483 301483 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301485 301485 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301487 301487 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301504 301504 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301504 301504 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301510 301510 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301514 301514 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301517 301517 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301525 301525 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301539 301539 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301539 301539 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301542 301542 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301542 301542 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301552 301553 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301552 301553 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301557 301557 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301557 301557 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301573 301573 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301593 301593 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301593 301593 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301595 301595 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301595 301595 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301597 301597 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301597 301597 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301599 301599 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301599 301599 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301607 301607 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301609 301609 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301609 301609 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301611 301611 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301611 301611 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301620 301620 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301620 301620 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301628 301628 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301628 301628 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301634 301634 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301634 301634 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301641 301642 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301641 301642 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301653 301653 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301653 301653 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301657 301657 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301662 301662 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301662 301662 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301664 301664 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301664 301664 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301670 301670 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301670 301670 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301674 301674 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301674 301674 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301684 301684 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301684 301684 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301695 301696 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301695 301696 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301700 301702 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301700 301702 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301705 301705 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  301712 301712 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301712 301712 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301716 301716 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301716 301716 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301748 301748 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301748 301748 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301773 301773 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301773 301773 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301777 301777 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301777 301777 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301780 301780 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301780 301780 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301785 301785 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301785 301785 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301803 301803 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301803 301803 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301805 301805 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301805 301805 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301806 301806 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301806 301806 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301816 301816 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301816 301816 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301825 301825 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301825 301825 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301830 301830 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301830 301830 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301834 301834 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301834 301834 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301843 301843 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301843 301843 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301845 301845 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301845 301845 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301855 301856 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301855 301856 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301864 301864 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301864 301864 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301868 301869 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301868 301869 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301883 301883 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301883 301883 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301886 301888 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301886 301888 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301898 301898 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301898 301898 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  301914 301996 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  301914 301996 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  302500 302500 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  302500 302500 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  302556 302556 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  302556 302556 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  302579 302580 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  302579 302580 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  303460 303461 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  303460 303461 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305907 305939 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305907 305939 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305941 305960 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305941 305960 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305971 305971 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305971 305971 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305974 305974 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305974 305974 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305978 305978 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305978 305978 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305982 305982 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305982 305982 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305984 305988 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305984 305988 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  305990 305993 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  305990 305993 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306017 306018 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306017 306018 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306020 306020 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306020 306020 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306028 306028 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306028 306028 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306038 306038 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306038 306038 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306150 306151 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306150 306151 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306154 306155 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306154 306155 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306228 306228 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306228 306228 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306229 306229 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306229 306229 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306232 306232 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306232 306232 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306242 306242 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306242 306242 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306245 306245 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306245 306245 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306249 306249 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306249 306249 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306255 306255 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306255 306255 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306259 306263 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306259 306263 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306272 306279 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306272 306279 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306281 306281 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306281 306281 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306289 306289 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306289 306289 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306296 306296 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306296 306296 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306299 306299 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306299 306299 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306300 306300 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306300 306300 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306347 306347 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306347 306347 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306354 306355 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306354 306355 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306357 306357 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306357 306357 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306359 306359 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306359 306359 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306364 306364 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306364 306364 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306394 306394 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306394 306394 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306397 306397 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306397 306397 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306410 306410 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306410 306410 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306412 306412 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306412 306412 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306414 306415 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306414 306415 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306418 306419 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306418 306419 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306422 306422 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306422 306422 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306434 306434 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306434 306434 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306437 306438 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306437 306438 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306442 306444 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306442 306444 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306457 306457 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306457 306457 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306472 306472 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306472 306472 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306479 306479 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306479 306479 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306497 306497 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306497 306497 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306521 306522 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306521 306522 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306537 306539 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306537 306539 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306541 306541 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306541 306541 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306549 306549 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306549 306549 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306562 306565 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306562 306565 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306572 306572 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306572 306572 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306585 306586 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306585 306586 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306592 306593 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306592 306593 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306675 306677 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306675 306677 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306689 306689 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306689 306689 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306695 306696 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306695 306696 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306733 306735 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306733 306735 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306747 306749 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306747 306749 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306753 306753 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306753 306753 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306756 306756 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306756 306756 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306759 306759 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306759 306759 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306762 306762 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306762 306762 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306764 306764 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306764 306764 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306766 306767 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306766 306767 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306769 306769 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306769 306769 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306772 306772 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306772 306772 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306775 306776 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306775 306776 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306779 306779 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306779 306779 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306782 306782 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306782 306782 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306788 306789 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306788 306789 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  306799 306799 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  306799 306799 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307184 307184 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307184 307184 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307188 307190 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307188 307190 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307198 307198 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307198 307198 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307271 307271 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307271 307271 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307274 307274 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307274 307274 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307654 307654 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307654 307654 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307779 307779 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307779 307779 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307788 307789 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307788 307789 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  307809 307809 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  307809 307809 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308012 308012 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308012 308012 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308016 308016 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308016 308016 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308026 308027 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308026 308027 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308033 308034 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308033 308034 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308037 308037 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308037 308037 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308042 308042 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308042 308042 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308045 308045 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308045 308045 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308048 308049 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308048 308049 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308054 308055 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308054 308055 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308063 308063 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308063 308063 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308076 308077 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308076 308077 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308082 308083 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308082 308083 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308085 308085 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308085 308085 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308087 308089 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308087 308089 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308095 308097 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308095 308097 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308404 308404 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308404 308404 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308412 308412 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308412 308412 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308420 308427 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308420 308427 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308433 308434 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308433 308434 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308441 308446 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308441 308446 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308448 308448 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308448 308448 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308451 308454 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308451 308454 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308457 308459 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308457 308459 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308462 308463 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308462 308463 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308467 308469 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308467 308469 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308472 308473 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308472 308473 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308475 308477 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308475 308477 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308479 308479 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308479 308479 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308482 308482 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308482 308482 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308484 308487 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308484 308487 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308784 308784 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308784 308784 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308804 308804 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308804 308804 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308822 308822 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308822 308822 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  308952 308952 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  308952 308952 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  309001 309633 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  309001 309633 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  309634 309634 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1\n  309635 309746 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  309635 309746 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  309748 309871 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  309748 309871 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  309873 309915 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  309873 309915 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  309917 309999 MOD11    0    0    3    2    9    8    5    7    6    5    4    3    2    1   2\n  309917 309999 MOD11    0    0    3    2    9    8    1    7    6    5    4    3    2    1   9\n  400000 400193 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  400000 400193 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  400196 400514 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  400196 400514 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  400515 400515 MOD11    0    0    0    0    0    0    8    5    7    3    4    9    2    1\n  400516 404799 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  400516 404799 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  406420 406420 MOD10    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  500000 501029 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  502101 560070 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600000 600108 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600110 600124 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600127 600142 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600144 600149 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600180 600304 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600307 600312 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600314 600355 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600357 600851 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  600901 601360 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  601403 608028 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  608301 608301 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  608316 608316 MOD10    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  609593 609593 MOD10    0    0    0    0    0    0    7    1    3    7    1    3    7    1\n  609599 609599 MOD10    0    0    0    0    0    0    0    5    7    5    2    1    2    1\n  640001 640001 MOD11    0    0    0    0    0    0    8    7    6    5    4    3    2    1\n  720000 720249 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  720251 724443 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  725000 725251 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  725253 725616 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  726000 726616 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  770100 771799 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  771877 771877 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  771900 772799 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  772813 772817 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  772901 773999 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  774100 774599 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  774700 774830 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  774832 777789 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  777791 777999 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  778001 778001 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  778300 778799 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  778855 778855 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  778900 779174 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  779414 779999 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1   7\n  800000 802005 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802007 802042 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802044 802065 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802067 802109 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802111 802114 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802116 802123 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802151 802154 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802156 802179 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  802181 803599 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  803609 819999 MOD11    0    0    1    8    2    6    3    7    9    5    8    4    2    1\n  820000 826917 MOD11    0    0    0    0    0    0    0    0    7    3    4    9    2    1\n  820000 826917 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   3\n  826919 827999 MOD11    0    0    0    0    0    0    0    0    7    3    4    9    2    1\n  826919 827999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   3\n  829000 829999 MOD11    0    0    0    0    0    0    0    0    7    3    4    9    2    1\n  829000 829999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1   3\n  830000 835700 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836500 836501 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836505 836506 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836510 836510 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836515 836515 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836530 836530 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836535 836535 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836540 836540 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836560 836560 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836565 836565 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836570 836570 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836585 836585 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836590 836590 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836595 836595 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836620 836620 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836625 836625 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  836630 836630 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  837550 837550 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  837560 837560 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  837570 837570 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  837580 837580 MOD11    0    0    4    3    2    7    2    7    6    5    4    3    2    1\n  839105 839106 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  839105 839106 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  839130 839131 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    1    0\n  839130 839131 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  839147 839147 MOD10    0    0    0    0    0    0    0    5    7    5    2    1    2    1\n  870000 872791 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  870000 872791 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  872793 876899 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  872793 876899 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876919 876919 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876919 876919 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876921 876923 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876921 876923 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876925 876932 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876925 876932 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876935 876935 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876935 876935 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876951 876951 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876951 876951 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876953 876955 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876953 876955 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876957 876957 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876957 876957 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  876961 876965 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  876961 876965 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877000 877070 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877000 877070 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877071 877071 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877071 877071 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877078 877078 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877078 877078 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877088 877088 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877088 877088 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877090 877090 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877090 877090 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877098 877098 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877098 877098 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  877099 879999 MOD11    0    0    1    2    5    3    6    4    8    7   10    9    3    1  10\n  877099 879999 MOD11    0    0    5   10    9    8    0    7    6    5    4    3    2    1  11\n  890000 890699 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  891000 891616 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  892000 892616 MOD11    0    0    0    0    0    9    8    7    6    5    4    3    2    1\n  900000 902396 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  900000 902396 MOD11   32   16    8    4    2    1    0    0    0    0    0    0    0    0\n  902398 909999 MOD11    0    0    0    0    0    0  128   64   32   16    8    4    2    1\n  902398 909999 MOD11   32   16    8    4    2    1    0    0    0    0    0    0    0    0\n  938000 938696 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    0    0   5\n  938000 938696 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    0   5\n  938698 938999 MOD11    7    6    5    4    3    2    7    6    5    4    3    2    0    0   5\n  938698 938999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    0   5\n  950000 950002 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  950000 950002 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  950004 950479 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  950004 950479 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  950500 959999 MOD11    0    0    0    0    0    0    0    7    6    5    4    3    2    1\n  950500 959999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  980000 980004 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  980000 980004 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  980006 983000 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  980006 983000 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  983003 987000 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  983003 987000 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  987004 989999 MOD11    0    0    0    0    0    0    7    6    5    4    3    2    1    0\n  987004 989999 DBLAL    2    1    2    1    2    1    2    1    2    1    2    1    2    1\n  ";
  var scsubtab = "\n  938173 938017\n  938289 938068\n  938297 938076\n  938600 938611\n  938602 938343\n  938604 938603\n  938608 938408\n  938609 938424\n  938613 938017\n  938616 938068\n  938618 938657\n  938620 938343\n  938622 938130\n  938628 938181\n  938643 938246\n  938647 938611\n  938648 938246\n  938649 938394\n  938651 938335\n  938653 938424\n  938654 938621\n  ";
  exports["scsubtab"] = scsubtab;
  exports["valacdos_v390"] = valacdos_v390;
})(PS["ModulusCheck.Resources"] = PS["ModulusCheck.Resources"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_List = PS["Data.List"];
  var Data_Map = PS["Data.Map"];
  var Data_Maybe = PS["Data.Maybe"];
  var ModulusCheck_Data_AccountNumber = PS["ModulusCheck.Data.AccountNumber"];
  var ModulusCheck_Data_CheckRow = PS["ModulusCheck.Data.CheckRow"];
  var ModulusCheck_Data_CheckRow_Parser = PS["ModulusCheck.Data.CheckRow.Parser"];
  var ModulusCheck_Data_SubstitutionRow_Parser = PS["ModulusCheck.Data.SubstitutionRow.Parser"];
  var ModulusCheck_Parsers = PS["ModulusCheck.Parsers"];
  var ModulusCheck_Resources = PS["ModulusCheck.Resources"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Data_Ord = PS["Data.Ord"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Data_Function = PS["Data.Function"];        
  var sortCodeSubstitutionTable = ModulusCheck_Parsers.parse(ModulusCheck_Resources.scsubtab)(ModulusCheck_Data_SubstitutionRow_Parser.sortCodeSubstitutionTableParser);
  var getSortCodeSubstitution = function (sortCode) {
      return Control_Bind.bind(Data_Either.bindEither)(sortCodeSubstitutionTable)(function ($6) {
          return Control_Applicative.pure(Data_Either.applicativeEither)(Data_Map.lookup(Data_Ord.ordString)(sortCode)($6));
      });
  };
  var checkRowsTable = ModulusCheck_Parsers.parse(ModulusCheck_Resources.valacdos_v390)(ModulusCheck_Data_CheckRow_Parser.checkRowTableParser);
  var getCheckRows = function (sortCodeString) {
      var relevantRow = function (v) {
          return v.from <= sortCodeString && v.to >= sortCodeString;
      };
      return Control_Bind.bind(Data_Either.bindEither)(checkRowsTable)(function (v) {
          return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(Data_List.filter(relevantRow)(v));
      });
  };
  exports["getCheckRows"] = getCheckRows;
  exports["getSortCodeSubstitution"] = getSortCodeSubstitution;
})(PS["ModulusCheck.Data.Tables"] = PS["ModulusCheck.Data.Tables"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Int = PS["Data.Int"];
  var Data_Lazy = PS["Data.Lazy"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var $$Math = PS["Math"];
  var ModulusCheck_Data_AccountNumber = PS["ModulusCheck.Data.AccountNumber"];
  var ModulusCheck_Data_CheckRow = PS["ModulusCheck.Data.CheckRow"];
  var ModulusCheck_Data_Tables = PS["ModulusCheck.Data.Tables"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Data_Ord = PS["Data.Ord"];
  var Data_Semiring = PS["Data.Semiring"];
  var Data_Boolean = PS["Data.Boolean"];
  var Data_EuclideanRing = PS["Data.EuclideanRing"];
  var Data_Function = PS["Data.Function"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Eq = PS["Data.Eq"];
  var Control_Semigroupoid = PS["Control.Semigroupoid"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_Ring = PS["Data.Ring"];
  var Data_HeytingAlgebra = PS["Data.HeytingAlgebra"];
  var Control_Apply = PS["Control.Apply"];        
  var sumDigits = function (xs) {
      var digitSumLoop = function (__copy_acc) {
          return function (__copy_x) {
              var acc = __copy_acc;
              var x = __copy_x;
              tco: while (true) {
                  if (x < 10) {
                      return acc + x | 0;
                  };
                  if (Data_Boolean.otherwise) {
                      var __tco_acc = acc + Data_Int.round($$Math.remainder(Data_Int.toNumber(x))(10.0)) | 0;
                      var __tco_x = x / 10 | 0;
                      acc = __tco_acc;
                      x = __tco_x;
                      continue tco;
                  };
                  throw new Error("Failed pattern match at ModulusCheck.Checks line 224, column 5 - line 226, column 88: " + [ acc.constructor.name, x.constructor.name ]);
              };
          };
      };
      var digitSum = function (x) {
          return digitSumLoop(0)(x);
      };
      return Data_Function.apply(Data_Foldable.sum(Data_List.foldableList)(Data_Semiring.semiringInt))(Data_Functor.map(Data_List.functorList)(digitSum)(xs));
  };
  var modCheck = function (modulus) {
      return function (expected) {
          return function (x) {
              return Data_Int.round($$Math.remainder(Data_Int.toNumber(x))(Data_Int.toNumber(modulus))) === expected;
          };
      };
  };
  var isStandardCheck = function (v) {
      if (v.exceptionCode instanceof Data_Maybe.Nothing) {
          return true;
      };
      return false;
  };
  var dotMul = function (xs) {
      return function (ys) {
          return Data_List.zipWith(Data_Semiring.mul(Data_Semiring.semiringInt))(xs)(ys);
      };
  };
  var doubleAlternateSum = function (weights) {
      return function (digits) {
          return Data_Function.apply(sumDigits)(dotMul(weights)(digits));
      };
  };
  var doubleAlternateCheck = function (w) {
      return function ($77) {
          return modCheck(10)(0)(doubleAlternateSum(w)($77));
      };
  };
  var exception1Check = function (checkRow) {
      return function (accountNumber) {
          return Data_Function.apply(modCheck(10)(0))(27 + doubleAlternateSum(checkRow.weights)(accountNumber.digits) | 0);
      };
  };
  var standardModSum = function (weights) {
      return function (digits) {
          return Data_Function.apply(Data_Foldable.sum(Data_List.foldableList)(Data_Semiring.semiringInt))(dotMul(weights)(digits));
      };
  };
  var exception4Check = function (w) {
      return function (accountNumber) {
          return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("g")(accountNumber.digits))(function (v) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("h")(accountNumber.digits))(function (v1) {
                  return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(Data_Function.apply(modCheck(11)((v * 10 | 0) + v1 | 0))(standardModSum(w)(accountNumber.digits)));
              });
          });
      };
  };
  var exception5Check = function (mod11Weights) {
      return function (dblAlWeights) {
          return function (accountNumber) {
              var sortCodeReplaced = Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_Tables.getSortCodeSubstitution(accountNumber.sortCodeString))(function (v) {
                  if (v instanceof Data_Maybe.Just) {
                      return ModulusCheck_Data_AccountNumber.replacePrefix(v.value0)(accountNumber.digits);
                  };
                  if (v instanceof Data_Maybe.Nothing) {
                      return Control_Applicative.pure(Data_Either.applicativeEither)(accountNumber.digits);
                  };
                  throw new Error("Failed pattern match at ModulusCheck.Checks line 99, column 7 - line 101, column 45: " + [ v.constructor.name ]);
              });
              var performMod11Check = function (v) {
                  return function (v1) {
                      if (v1 === 0) {
                          return modCheck(11)(0)(v);
                      };
                      if (v1 === 1) {
                          return false;
                      };
                      return modCheck(11)(11 - v1)(v);
                  };
              };
              var performDblAlCheck = function (sum) {
                  return function (v) {
                      if (v === 0) {
                          return modCheck(10)(0)(sum);
                      };
                      return modCheck(10)(10 - v)(sum);
                  };
              };
              var secondCheck = function (w) {
                  return function (d) {
                      return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("h")(d))(function ($78) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(performDblAlCheck(doubleAlternateSum(w)(d))($78));
                      });
                  };
              };
              var firstCheck = function (w) {
                  return function (d) {
                      return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("g")(d))(function ($79) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(performMod11Check(standardModSum(w)(d))($79));
                      });
                  };
              };
              return Control_Bind.bind(Data_Either.bindEither)(sortCodeReplaced)(function (v) {
                  return Control_Bind.bind(Data_Either.bindEither)(firstCheck(mod11Weights)(v))(function (v1) {
                      return Control_Bind.bind(Data_Either.bindEither)(secondCheck(dblAlWeights)(v))(function (v2) {
                          return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(v1 && v2);
                      });
                  });
              });
          };
      };
  };
  var mod10Check = function (w) {
      return function ($80) {
          return modCheck(10)(0)(standardModSum(w)($80));
      };
  };
  var mod11Check = function (w) {
      return function ($81) {
          return modCheck(11)(0)(standardModSum(w)($81));
      };
  };
  var exception2Check = function (weights) {
      return function (accountNumber) {
          var nonNineSubstitute = new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(1, new Data_List.Cons(2, new Data_List.Cons(5, new Data_List.Cons(3, new Data_List.Cons(6, new Data_List.Cons(4, new Data_List.Cons(8, new Data_List.Cons(7, new Data_List.Cons(10, new Data_List.Cons(9, new Data_List.Cons(3, new Data_List.Cons(1, Data_List.Nil.value))))))))))))));
          var nineSubstitute = new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(0, new Data_List.Cons(8, new Data_List.Cons(7, new Data_List.Cons(10, new Data_List.Cons(9, new Data_List.Cons(3, new Data_List.Cons(1, Data_List.Nil.value))))))))))))));
          var newWeights = function (v) {
              return function (v1) {
                  if (v === 0) {
                      return weights;
                  };
                  if (v1 === 9) {
                      return nineSubstitute;
                  };
                  return nonNineSubstitute;
              };
          };
          var w = Control_Apply.apply(Data_Either.applyEither)(Data_Functor.map(Data_Either.functorEither)(newWeights)(ModulusCheck_Data_AccountNumber.getDigit("a")(accountNumber.digits)))(ModulusCheck_Data_AccountNumber.getDigit("g")(accountNumber.digits));
          return Data_Functor.map(Data_Either.functorEither)(Data_Function.flip(mod11Check)(accountNumber.digits))(w);
      };
  };
  var exception9Check = function (weights) {
      return function (accountNumber) {
          var sortCodeReplacement = new Data_List.Cons(3, new Data_List.Cons(0, new Data_List.Cons(9, new Data_List.Cons(6, new Data_List.Cons(3, new Data_List.Cons(4, Data_List.Nil.value))))));
          return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.replacePrefix(sortCodeReplacement)(accountNumber.digits))(function ($82) {
              return Control_Applicative.pure(Data_Either.applicativeEither)(mod11Check(weights)($82));
          });
      };
  };
  var performStandardCheck = function (v) {
      return function (accountNumber) {
          if (v.checkMethod instanceof ModulusCheck_Data_CheckRow.DblAl) {
              return doubleAlternateCheck(v.weights)(accountNumber.digits);
          };
          if (v.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod10) {
              return mod10Check(v.weights)(accountNumber.digits);
          };
          if (v.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod11) {
              return mod11Check(v.weights)(accountNumber.digits);
          };
          throw new Error("Failed pattern match at ModulusCheck.Checks line 37, column 1 - line 37, column 132: " + [ v.constructor.name, accountNumber.constructor.name ]);
      };
  };
  var exception10Check = function (row) {
      return function (accountNumber) {
          var performException10Check = function (v) {
              return function (v1) {
                  return function (v2) {
                      if (v1 === 9 && (v2 === 9 && (v === 0 || v === 9))) {
                          return performStandardCheck(ModulusCheck_Data_CheckRow.zeroiseUtoB(row))(accountNumber);
                      };
                      return performStandardCheck(row)(accountNumber);
                  };
              };
          };
          return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("a")(accountNumber.digits))(function (v) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("b")(accountNumber.digits))(function (v1) {
                  return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("g")(accountNumber.digits))(function (v2) {
                      return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(performException10Check(v)(v1)(v2));
                  });
              });
          });
      };
  };
  var exception11Check = function (row) {
      return function ($83) {
          return Control_Applicative.pure(Data_Either.applicativeEither)(performStandardCheck(row)($83));
      };
  };
  var exception3Check = function (standardCheckRow) {
      return function (dblAlCheckWeights) {
          return function (accountNumber) {
              var performException3Check = function (v) {
                  return function (v1) {
                      return function (v2) {
                          if (v === 6) {
                              return true;
                          };
                          if (v === 9) {
                              return true;
                          };
                          return doubleAlternateCheck(v1)(v2.digits);
                      };
                  };
              };
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("c")(accountNumber.digits))(function (c) {
                  return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(performStandardCheck(standardCheckRow)(accountNumber) && performException3Check(c)(dblAlCheckWeights)(accountNumber));
              });
          };
      };
  };
  var exception6Check = function (row1) {
      return function (row2) {
          return function (accountNumber) {
              var performCheck = function (v) {
                  return function (v1) {
                      if (v === 4 && v1) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(true);
                      };
                      if (v === 5 && v1) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(true);
                      };
                      if (v === 6 && v1) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(true);
                      };
                      if (v === 7 && v1) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(true);
                      };
                      if (v === 8 && v1) {
                          return Control_Applicative.pure(Data_Either.applicativeEither)(true);
                      };
                      return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(performStandardCheck(row1)(accountNumber) && performStandardCheck(row2)(accountNumber));
                  };
              };
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("a")(accountNumber.digits))(function (v) {
                  return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("g")(accountNumber.digits))(function (v1) {
                      return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("h")(accountNumber.digits))(function (v2) {
                          return performCheck(v)(v1 === v2);
                      });
                  });
              });
          };
      };
  };
  var exception7Check = function (row) {
      return function (accountNumber) {
          var performCheck = function (v) {
              if (v === 9) {
                  return performStandardCheck(ModulusCheck_Data_CheckRow.zeroiseUtoB(row))(accountNumber);
              };
              return performStandardCheck(row)(accountNumber);
          };
          return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("g")(accountNumber.digits))(function ($84) {
              return Control_Applicative.pure(Data_Either.applicativeEither)(performCheck($84));
          });
      };
  };
  var exception8Check = function (row) {
      return function (accountNumber) {
          var replacement = new Data_List.Cons(0, new Data_List.Cons(9, new Data_List.Cons(0, new Data_List.Cons(1, new Data_List.Cons(2, new Data_List.Cons(6, Data_List.Nil.value))))));
          var replaceSortCode = function (x) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.replacePrefix(replacement)(x.digits))(function (newDigits) {
                  return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))((function () {
                      var $69 = {};
                      for (var $70 in x) {
                          if (x.hasOwnProperty($70)) {
                              $69[$70] = x[$70];
                          };
                      };
                      $69.digits = newDigits;
                      return $69;
                  })());
              });
          };
          return Control_Bind.bind(Data_Either.bindEither)(replaceSortCode(accountNumber))(function ($85) {
              return Control_Applicative.pure(Data_Either.applicativeEither)(performStandardCheck(row)($85));
          });
      };
  };
  var exceptions12and13Check = function (row1) {
      return function (row2) {
          return function (accountNumber) {
              return performStandardCheck(row1)(accountNumber) || performStandardCheck(row2)(accountNumber);
          };
      };
  };
  var anyEither = function (v) {
      return function (v1) {
          if (v instanceof Data_Either.Left) {
              return v;
          };
          if (v instanceof Data_Either.Right && v.value0) {
              return v;
          };
          return Data_Lazy.force(v1);
      };
  };
  var exception14Check = function (row) {
      return function (accountNumber) {
          var checkWithH = function (h) {
              if (h === 0 || (h === 1 || h === 9)) {
                  return mod11Check(row.weights)(ModulusCheck_Data_AccountNumber.shiftAccountNumberRight(accountNumber.digits));
              };
              if (Data_Boolean.otherwise) {
                  return false;
              };
              throw new Error("Failed pattern match at ModulusCheck.Checks line 186, column 5 - line 188, column 48: " + [ h.constructor.name ]);
          };
          var performExceptionCheck = function (v) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber.getDigit("h")(accountNumber.digits))(function ($86) {
                  return Control_Applicative.pure(Data_Either.applicativeEither)(checkWithH($86));
              });
          };
          return anyEither(Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(mod11Check(row.weights)(accountNumber.digits)))(Data_Lazy.defer(performExceptionCheck));
      };
  };
  var exceptions10and11Check = function (row1) {
      return function (row2) {
          return function (accountNumber) {
              return anyEither(exception10Check(row1)(accountNumber))(Data_Lazy.defer(function (unit) {
                  return exception11Check(row2)(accountNumber);
              }));
          };
      };
  };
  var exceptions2And9Check = function (weights2) {
      return function (weights9) {
          return function (accountNumber) {
              return anyEither(exception2Check(weights2)(accountNumber))(Data_Lazy.defer(function (unit) {
                  return exception9Check(weights9)(accountNumber);
              }));
          };
      };
  };
  exports["exception14Check"] = exception14Check;
  exports["exception1Check"] = exception1Check;
  exports["exception3Check"] = exception3Check;
  exports["exception4Check"] = exception4Check;
  exports["exception5Check"] = exception5Check;
  exports["exception6Check"] = exception6Check;
  exports["exception7Check"] = exception7Check;
  exports["exception8Check"] = exception8Check;
  exports["exceptions10and11Check"] = exceptions10and11Check;
  exports["exceptions12and13Check"] = exceptions12and13Check;
  exports["exceptions2And9Check"] = exceptions2And9Check;
  exports["isStandardCheck"] = isStandardCheck;
  exports["performStandardCheck"] = performStandardCheck;
})(PS["ModulusCheck.Checks"] = PS["ModulusCheck.Checks"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Either = PS["Data.Either"];
  var Data_List = PS["Data.List"];
  var Text_Parsing_Parser = PS["Text.Parsing.Parser"];
  var Text_Parsing_Parser_Combinators = PS["Text.Parsing.Parser.Combinators"];
  var Text_Parsing_Parser_String = PS["Text.Parsing.Parser.String"];
  var ModulusCheck_Data_AccountNumber = PS["ModulusCheck.Data.AccountNumber"];
  var ModulusCheck_Parsers = PS["ModulusCheck.Parsers"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Bind = PS["Control.Bind"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];        
  var standardAccountNumberParser = {
      accountDigitsParser: Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(8))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity)), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(s, new Data_List.Cons(a, Data_List.Nil.value)));
          };
      }
  };
  var sortCodeParser = Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(6))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity));
  var sixDigitAccountNumberParser = {
      accountDigitsParser: Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(6))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity)), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(s, new Data_List.Cons(new Data_List.Cons(0, new Data_List.Cons(0, Data_List.Nil.value)), new Data_List.Cons(a, Data_List.Nil.value))));
          };
      }
  };
  var sevenDigitAccountNumberParser = {
      accountDigitsParser: Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(7))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity)), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(s, new Data_List.Cons(new Data_List.Cons(0, Data_List.Nil.value), new Data_List.Cons(a, Data_List.Nil.value))));
          };
      }
  };
  var santanderAccountNumberParser = {
      accountDigitsParser: Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(9))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity)), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(Data_List.take(5)(s), new Data_List.Cons(a, Data_List.Nil.value)));
          };
      }
  };
  var parseAccountNumber = function (sortCodeString) {
      return function (accountNumberString) {
          return function (parser) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Parsers.parseWithError("Sort code must contain exactly 6 decimal digits without dashes")(sortCodeString)(sortCodeParser))(function (v) {
                  return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Parsers.parseWithError("Account number format is not valid")(accountNumberString)(parser.accountDigitsParser))(function (v1) {
                      return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(ModulusCheck_Data_AccountNumber.accountNumber(sortCodeString)(parser.transform(v)(v1)));
                  });
              });
          };
      };
  };
  var nationalWestMinsterAccountNumberParser = {
      accountDigitsParser: Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(2))(function (v) {
          return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_Combinators.optional(Data_Identity.monadIdentity)(Text_Parsing_Parser_String.string(Data_Identity.monadIdentity)("-")))(function (v1) {
              return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(8))(function (v2) {
                  return Control_Bind.bind(Text_Parsing_Parser.bindParserT(Data_Identity.monadIdentity))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity))(function (v3) {
                      return Control_Applicative.pure(Text_Parsing_Parser.applicativeParserT(Data_Identity.monadIdentity))(v2);
                  });
              });
          });
      }), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(s, new Data_List.Cons(a, Data_List.Nil.value)));
          };
      }
  };
  var coOperativeAccountNumberParser = {
      accountDigitsParser: Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(Control_Apply.applyFirst(Text_Parsing_Parser.applyParserT(Data_Identity.monadIdentity))(ModulusCheck_Parsers.digitsParser(8))(ModulusCheck_Parsers.digitsParser(2)))(Text_Parsing_Parser_String.eof(Data_Identity.monadIdentity)), 
      transform: function (s) {
          return function (a) {
              return Data_List.concat(new Data_List.Cons(s, new Data_List.Cons(a, Data_List.Nil.value)));
          };
      }
  };
  exports["coOperativeAccountNumberParser"] = coOperativeAccountNumberParser;
  exports["nationalWestMinsterAccountNumberParser"] = nationalWestMinsterAccountNumberParser;
  exports["parseAccountNumber"] = parseAccountNumber;
  exports["santanderAccountNumberParser"] = santanderAccountNumberParser;
  exports["sevenDigitAccountNumberParser"] = sevenDigitAccountNumberParser;
  exports["sixDigitAccountNumberParser"] = sixDigitAccountNumberParser;
  exports["standardAccountNumberParser"] = standardAccountNumberParser;
})(PS["ModulusCheck.Data.AccountNumber.Parser"] = PS["ModulusCheck.Data.AccountNumber.Parser"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var ModulusCheck_Checks = PS["ModulusCheck.Checks"];
  var ModulusCheck_Data_AccountNumber = PS["ModulusCheck.Data.AccountNumber"];
  var ModulusCheck_Data_AccountNumber_Parser = PS["ModulusCheck.Data.AccountNumber.Parser"];
  var ModulusCheck_Data_CheckRow = PS["ModulusCheck.Data.CheckRow"];
  var ModulusCheck_Data_Tables = PS["ModulusCheck.Data.Tables"];
  var ModulusCheckTypes = PS["ModulusCheckTypes"];
  var Data_Function = PS["Data.Function"];
  var Control_Applicative = PS["Control.Applicative"];
  var Data_BooleanAlgebra = PS["Data.BooleanAlgebra"];
  var Control_Bind = PS["Control.Bind"];        
  var performCheck = function (v) {
      return function (v1) {
          if (v instanceof Data_List.Nil) {
              return new Data_Either.Right(true);
          };
          if (v instanceof Data_List.Cons && (v.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.DblAl && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 1 && v.value1 instanceof Data_List.Nil)))) {
              return Data_Function.apply(Data_Either.Right.create)(ModulusCheck_Checks.exception1Check(v.value0)(v1));
          };
          if (v instanceof Data_List.Cons && (v.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod11 && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 2 && (v.value1 instanceof Data_List.Cons && (v.value1.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod11 && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 9 && v.value1.value1 instanceof Data_List.Nil)))))))) {
              return ModulusCheck_Checks.exceptions2And9Check(v.value0.weights)(v.value1.value0.weights)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Nothing && (v.value1 instanceof Data_List.Cons && (v.value1.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.DblAl && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 3 && v.value1.value1 instanceof Data_List.Nil)))))) {
              return ModulusCheck_Checks.exception3Check(v.value0)(v.value1.value0.weights)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod11 && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 4 && v.value1 instanceof Data_List.Nil)))) {
              return ModulusCheck_Checks.exception4Check(v.value0.weights)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.Mod11 && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 5 && (v.value1 instanceof Data_List.Cons && (v.value1.value0.checkMethod instanceof ModulusCheck_Data_CheckRow.DblAl && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 5 && v.value1.value1 instanceof Data_List.Nil)))))))) {
              return ModulusCheck_Checks.exception5Check(v.value0.weights)(v.value1.value0.weights)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 6 && (v.value1 instanceof Data_List.Cons && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 6 && v.value1.value1 instanceof Data_List.Nil)))))) {
              return ModulusCheck_Checks.exception6Check(v.value0)(v.value1.value0)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 7 && v.value1 instanceof Data_List.Nil))) {
              return ModulusCheck_Checks.exception7Check(v.value0)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 8 && v.value1 instanceof Data_List.Nil))) {
              return ModulusCheck_Checks.exception8Check(v.value0)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 10 && (v.value1 instanceof Data_List.Cons && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 11 && v.value1.value1 instanceof Data_List.Nil)))))) {
              return ModulusCheck_Checks.exceptions10and11Check(v.value0)(v.value1.value0)(v1);
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 12 && (v.value1 instanceof Data_List.Cons && (v.value1.value0.exceptionCode instanceof Data_Maybe.Just && (v.value1.value0.exceptionCode.value0 === 13 && v.value1.value1 instanceof Data_List.Nil)))))) {
              return Data_Function.apply(Control_Applicative.pure(Data_Either.applicativeEither))(ModulusCheck_Checks.exceptions12and13Check(v.value0)(v.value1.value0)(v1));
          };
          if (v instanceof Data_List.Cons && (v.value0.exceptionCode instanceof Data_Maybe.Just && (v.value0.exceptionCode.value0 === 14 && v.value1 instanceof Data_List.Nil))) {
              return ModulusCheck_Checks.exception14Check(v.value0)(v1);
          };
          if (Data_Foldable.all(Data_List.foldableList)(Data_BooleanAlgebra.booleanAlgebraBoolean)(ModulusCheck_Checks.isStandardCheck)(v)) {
              return Data_Function.apply(Data_Either.Right.create)(Data_Foldable.all(Data_List.foldableList)(Data_BooleanAlgebra.booleanAlgebraBoolean)(function (c) {
                  return ModulusCheck_Checks.performStandardCheck(c)(v1);
              })(v));
          };
          return new Data_Either.Left("Check not implemented for the given account number");
      };
  };
  var check = function (sortCode) {
      return function (accountNumber) {
          var performCheckWithParser = function (accountNumberParser) {
              return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_AccountNumber_Parser.parseAccountNumber(sortCode)(accountNumber)(accountNumberParser))(function (v) {
                  return Control_Bind.bind(Data_Either.bindEither)(ModulusCheck_Data_Tables.getCheckRows(v.sortCodeString))(function (v1) {
                      return performCheck(v1)(v);
                  });
              });
          };
          var parsers = new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.standardAccountNumberParser, new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.sixDigitAccountNumberParser, new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.sevenDigitAccountNumberParser, new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.santanderAccountNumberParser, new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.nationalWestMinsterAccountNumberParser, new Data_List.Cons(ModulusCheck_Data_AccountNumber_Parser.coOperativeAccountNumberParser, Data_List.Nil.value))))));
          var collectResult = function (v) {
              return function (v1) {
                  if (v instanceof Data_Maybe.Nothing) {
                      return Data_Function.apply(Data_Maybe.Just.create)(performCheckWithParser(v1));
                  };
                  if (v instanceof Data_Maybe.Just && (v.value0 instanceof Data_Either.Right && v.value0.value0)) {
                      return new Data_Maybe.Just(v.value0);
                  };
                  if (v instanceof Data_Maybe.Just) {
                      var $88 = performCheckWithParser(v1);
                      if ($88 instanceof Data_Either.Right) {
                          return new Data_Maybe.Just($88);
                      };
                      return new Data_Maybe.Just(v.value0);
                  };
                  throw new Error("Failed pattern match at ModulusCheck line 57, column 5 - line 57, column 88: " + [ v.constructor.name, v1.constructor.name ]);
              };
          };
          var $91 = Data_Foldable.foldl(Data_List.foldableList)(collectResult)(Data_Maybe.Nothing.value)(parsers);
          if ($91 instanceof Data_Maybe.Just) {
              return $91.value0;
          };
          if ($91 instanceof Data_Maybe.Nothing) {
              return new Data_Either.Left("Implementation error: no account number parsers defined");
          };
          throw new Error("Failed pattern match at ModulusCheck line 42, column 5 - line 45, column 3: " + [ $91.constructor.name ]);
      };
  };
  exports["check"] = check;
})(PS["ModulusCheck"] = PS["ModulusCheck"] || {});
(function(exports) {
  // Generated by psc version 0.9.3
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Array = PS["Data.Array"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Halogen = PS["Halogen"];
  var Halogen_HTML_Events_Indexed = PS["Halogen.HTML.Events.Indexed"];
  var Halogen_HTML_Indexed = PS["Halogen.HTML.Indexed"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Halogen_Util = PS["Halogen.Util"];
  var ModulusCheck = PS["ModulusCheck"];
  var Data_Function = PS["Data.Function"];
  var Data_Semigroup = PS["Data.Semigroup"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Halogen_HTML_Elements_Indexed = PS["Halogen.HTML.Elements.Indexed"];
  var Halogen_HTML_Events = PS["Halogen.HTML.Events"];
  var Halogen_HTML = PS["Halogen.HTML"];
  var Data_Functor = PS["Data.Functor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query = PS["Halogen.Query"];
  var Control_Applicative = PS["Control.Applicative"];
  var Halogen_Component = PS["Halogen.Component"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Halogen_Driver = PS["Halogen.Driver"];        
  var SetValidateOnChange = (function () {
      function SetValidateOnChange(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SetValidateOnChange.create = function (value0) {
          return function (value1) {
              return new SetValidateOnChange(value0, value1);
          };
      };
      return SetValidateOnChange;
  })();
  var SetSortCode = (function () {
      function SetSortCode(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SetSortCode.create = function (value0) {
          return function (value1) {
              return new SetSortCode(value0, value1);
          };
      };
      return SetSortCode;
  })();
  var SetAccountNumber = (function () {
      function SetAccountNumber(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SetAccountNumber.create = function (value0) {
          return function (value1) {
              return new SetAccountNumber(value0, value1);
          };
      };
      return SetAccountNumber;
  })();
  var PerformCheck = (function () {
      function PerformCheck(value0) {
          this.value0 = value0;
      };
      PerformCheck.create = function (value0) {
          return new PerformCheck(value0);
      };
      return PerformCheck;
  })();
  var Valid = (function () {
      function Valid() {

      };
      Valid.value = new Valid();
      return Valid;
  })();
  var Invalid = (function () {
      function Invalid() {

      };
      Invalid.value = new Invalid();
      return Invalid;
  })();
  var $$Error = (function () {
      function Error(value0) {
          this.value0 = value0;
      };
      Error.create = function (value0) {
          return new Error(value0);
      };
      return Error;
  })();
  var emptyRow = function (v) {
      return {
          sortCode: "", 
          accountNumber: "", 
          checkResult: v
      };
  };
  var initialState = {
      validateOnChange: false, 
      currentRow: emptyRow(Data_Maybe.Nothing.value), 
      previousRows: [  ]
  };
  var checkAccountNumber = function (sortCode) {
      return function (accountNumber) {
          var toCheckResult = function (v) {
              if (v instanceof Data_Either.Right && v.value0) {
                  return Valid.value;
              };
              if (v instanceof Data_Either.Right && !v.value0) {
                  return Invalid.value;
              };
              if (v instanceof Data_Either.Left) {
                  return new $$Error(v.value0);
              };
              throw new Error("Failed pattern match at Main line 51, column 5 - line 51, column 40: " + [ v.constructor.name ]);
          };
          return Data_Function.apply(toCheckResult)(ModulusCheck.check(sortCode)(accountNumber));
      };
  };
  var ui = (function () {
      var resultString = function (v) {
          if (v instanceof Valid) {
              return "valid";
          };
          if (v instanceof Invalid) {
              return "invalid";
          };
          if (v instanceof $$Error) {
              return "error: " + v.value0;
          };
          throw new Error("Failed pattern match at Main line 75, column 3 - line 76, column 3: " + [ v.constructor.name ]);
      };
      var resultClassName = function (v) {
          if (v instanceof Valid) {
              return Halogen_HTML_Core.className("valid");
          };
          if (v instanceof Invalid) {
              return Halogen_HTML_Core.className("invalid");
          };
          if (v instanceof $$Error) {
              return Halogen_HTML_Core.className("error");
          };
          throw new Error("Failed pattern match at Main line 80, column 3 - line 81, column 3: " + [ v.constructor.name ]);
      };
      var renderValidateOnChangeToggle = function (value) {
          return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements_Indexed.input([ Halogen_HTML_Properties_Indexed.inputType(Halogen_HTML_Properties_Indexed.InputCheckbox.value), Halogen_HTML_Properties_Indexed.title("Validate on keypress"), Halogen_HTML_Properties_Indexed.id_("validateOnChange"), Halogen_HTML_Properties_Indexed.checked(value), Halogen_HTML_Events_Indexed.onChecked(Halogen_HTML_Events.input(SetValidateOnChange.create)) ]), Halogen_HTML_Elements_Indexed.label([ Halogen_HTML_Properties_Indexed["for"]("validateOnChange") ])([ Halogen_HTML.text("Validate on keypress") ]) ]);
      };
      var renderPreviousRow = function (row) {
          return Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text(row.sortCode) ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(row.accountNumber) ]), Halogen_HTML_Elements_Indexed.td([ Halogen_HTML_Properties_Indexed.class_(resultClassName(row.checkResult)) ])([ Halogen_HTML.text(resultString(row.checkResult)) ]) ]);
      };
      var renderPreviousRowsTable = function (rows) {
          return Halogen_HTML_Elements.table_([ Halogen_HTML_Elements.thead_([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.th_([ Halogen_HTML.text("sort code") ]), Halogen_HTML_Elements.th_([ Halogen_HTML.text("account number") ]), Halogen_HTML_Elements.th_([ Halogen_HTML.text("result") ]) ]) ]), Halogen_HTML_Elements.tbody_(Data_Functor.map(Data_Functor.functorArray)(renderPreviousRow)(rows)) ]);
      };
      var renderCurrentRow = function (row) {
          var resultClass = function (v) {
              if (v instanceof Data_Maybe.Nothing) {
                  return Halogen_HTML_Core.className("nothing");
              };
              if (v instanceof Data_Maybe.Just) {
                  return resultClassName(v.value0);
              };
              throw new Error("Failed pattern match at Main line 135, column 7 - line 136, column 7: " + [ v.constructor.name ]);
          };
          var result = function (v) {
              if (v instanceof Data_Maybe.Nothing) {
                  return "";
              };
              if (v instanceof Data_Maybe.Just) {
                  return resultString(v.value0);
              };
              throw new Error("Failed pattern match at Main line 139, column 7 - line 140, column 7: " + [ v.constructor.name ]);
          };
          return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements_Indexed.input([ Halogen_HTML_Properties_Indexed.inputType(Halogen_HTML_Properties_Indexed.InputText.value), Halogen_HTML_Properties_Indexed.placeholder("sort code"), Halogen_HTML_Properties_Indexed.value(row.sortCode), Halogen_HTML_Events_Indexed.onValueInput(Halogen_HTML_Events.input(SetSortCode.create)) ]), Halogen_HTML_Elements_Indexed.input([ Halogen_HTML_Properties_Indexed.inputType(Halogen_HTML_Properties_Indexed.InputText.value), Halogen_HTML_Properties_Indexed.placeholder("account number"), Halogen_HTML_Properties_Indexed.value(row.accountNumber), Halogen_HTML_Events_Indexed.onValueInput(Halogen_HTML_Events.input(SetAccountNumber.create)) ]), Halogen_HTML_Elements_Indexed.button([ Halogen_HTML_Properties_Indexed.title("Check"), Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_(PerformCheck.create)) ])([ Halogen_HTML.text("Check") ]), Halogen_HTML_Elements_Indexed.span([ Halogen_HTML_Properties_Indexed.id_("validation-inline"), Halogen_HTML_Properties_Indexed.class_(resultClass(row.checkResult)) ])([ Halogen_HTML.text(result(row.checkResult)) ]) ]);
      };
      var render = function (state) {
          return Halogen_HTML_Elements.div_([ renderValidateOnChangeToggle(state.validateOnChange), renderCurrentRow(state.currentRow), renderPreviousRowsTable(state.previousRows) ]);
      };
      var checkRow = function (row) {
          var $21 = {};
          for (var $22 in row) {
              if (row.hasOwnProperty($22)) {
                  $21[$22] = row[$22];
              };
          };
          $21.checkResult = checkAccountNumber(row.sortCode)(row.accountNumber);
          return $21;
      };
      var checkCurrentRow = function (row) {
          var checked = checkRow(row);
          var $24 = {};
          for (var $25 in checked) {
              if (checked.hasOwnProperty($25)) {
                  $24[$25] = checked[$25];
              };
          };
          $24.checkResult = new Data_Maybe.Just(checked.checkResult);
          return $24;
      };
      var performOptionalCurrentRowCheck = function (v) {
          return function (row) {
              if (v) {
                  return checkCurrentRow(row);
              };
              if (!v) {
                  var $29 = {};
                  for (var $30 in row) {
                      if (row.hasOwnProperty($30)) {
                          $29[$30] = row[$30];
                      };
                  };
                  $29.checkResult = Data_Maybe.Nothing.value;
                  return $29;
              };
              throw new Error("Failed pattern match at Main line 159, column 3 - line 159, column 65: " + [ v.constructor.name, row.constructor.name ]);
          };
      };
      var updateCurrentRow = function (currentRow) {
          return function (state) {
              var $32 = {};
              for (var $33 in state) {
                  if (state.hasOwnProperty($33)) {
                      $32[$33] = state[$33];
                  };
              };
              $32.currentRow = performOptionalCurrentRowCheck(state.validateOnChange)(currentRow);
              return $32;
          };
      };
      var $$eval = function (v) {
          if (v instanceof SetValidateOnChange) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                  return updateCurrentRow(state.currentRow)((function () {
                      var $36 = {};
                      for (var $37 in state) {
                          if (state.hasOwnProperty($37)) {
                              $36[$37] = state[$37];
                          };
                      };
                      $36.validateOnChange = v.value0;
                      return $36;
                  })());
              }))(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
              });
          };
          if (v instanceof SetSortCode) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                  return updateCurrentRow((function () {
                      var $41 = {};
                      for (var $42 in state.currentRow) {
                          if (state.currentRow.hasOwnProperty($42)) {
                              $41[$42] = state.currentRow[$42];
                          };
                      };
                      $41.sortCode = v.value0;
                      return $41;
                  })())(state);
              }))(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
              });
          };
          if (v instanceof SetAccountNumber) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                  return updateCurrentRow((function () {
                      var $46 = {};
                      for (var $47 in state.currentRow) {
                          if (state.currentRow.hasOwnProperty($47)) {
                              $46[$47] = state.currentRow[$47];
                          };
                      };
                      $46.accountNumber = v.value0;
                      return $46;
                  })())(state);
              }))(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value1);
              });
          };
          if (v instanceof PerformCheck) {
              return Control_Bind.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                  var $51 = {};
                  for (var $52 in state) {
                      if (state.hasOwnProperty($52)) {
                          $51[$52] = state[$52];
                      };
                  };
                  $51.currentRow = emptyRow(Data_Maybe.Nothing.value);
                  $51.previousRows = Data_Array.snoc(state.previousRows)(checkRow(state.currentRow));
                  return $51;
              }))(function () {
                  return Control_Applicative.pure(Control_Monad_Free.freeApplicative)(v.value0);
              });
          };
          throw new Error("Failed pattern match at Main line 167, column 3 - line 169, column 14: " + [ v.constructor.name ]);
      };
      return Halogen_Component.component({
          render: render, 
          "eval": $$eval
      });
  })();
  var main = Halogen_Util.runHalogenAff(Control_Bind.bind(Control_Monad_Aff.bindAff)(Halogen_Util.awaitBody)(function (v) {
      return Halogen_Driver.runUI(ui)(initialState)(v);
  }));
  exports["Valid"] = Valid;
  exports["Invalid"] = Invalid;
  exports["Error"] = $$Error;
  exports["SetValidateOnChange"] = SetValidateOnChange;
  exports["SetSortCode"] = SetSortCode;
  exports["SetAccountNumber"] = SetAccountNumber;
  exports["PerformCheck"] = PerformCheck;
  exports["checkAccountNumber"] = checkAccountNumber;
  exports["emptyRow"] = emptyRow;
  exports["initialState"] = initialState;
  exports["main"] = main;
  exports["ui"] = ui;
})(PS["Main"] = PS["Main"] || {});
PS["Main"].main();

},{"virtual-dom/create-element":4,"virtual-dom/diff":5,"virtual-dom/patch":6,"virtual-dom/virtual-hyperscript/hooks/soft-set-hook":13,"virtual-dom/vnode/vnode":21,"virtual-dom/vnode/vtext":23}]},{},[27]);
