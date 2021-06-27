import options from './options';
import {
	TYPE_FUNCTION,
	TYPE_ELEMENT,
	TYPE_TEXT,
	TYPE_CLASS,
	TYPE_ROOT,
	INHERITED_MODES,
	TYPE_COMPONENT,
	TYPE_DOM,
	MODE_SVG,
	UNDEFINED
} from './constants';

/**
 * Create an internal tree node
 * @param {import('./internal').VNode | string} vnode
 * @param {import('./internal').Internal} [parentInternal]
 * @returns {import('./internal').Internal}
 */
export function createInternal(vnode, parentInternal) {
	let type = null,
		props,
		key,
		ref;

	/** @type {number} */
	let flags = parentInternal ? parentInternal.flags & INHERITED_MODES : 0;

	// Text VNodes/Internals use NaN as an ID so that two are never equal.
	let vnodeId = NaN;

	if (typeof vnode === 'string') {
		// type = null;
		flags |= TYPE_TEXT;
		props = vnode;
	} else if (vnode.constructor !== UNDEFINED) {
		flags |= TYPE_TEXT;
		props = '';
	} else {
		type = vnode.type;
		props = vnode.props || {};
		key = vnode.key;
		ref = vnode.ref;
		vnodeId = vnode._vnodeId;

		// @TODO re-enable this when we stop removing key+ref from VNode props
		// if (props) {
		// 	if ((key = props.key) != null) {
		// 		props.key = UNDEFINED;
		// 	}
		// 	if (typeof type !== 'function' && (ref = props.ref) != null) {
		// 		props.ref = UNDEFINED;
		// 	}
		// } else {
		// 	props = {};
		// }

		// flags = typeof type === 'function' ? COMPONENT_NODE : ELEMENT_NODE;
		flags |=
			typeof type === 'function'
				? type.prototype && 'render' in type.prototype
					? TYPE_CLASS
					: props._parentDom
					? TYPE_ROOT
					: TYPE_FUNCTION
				: TYPE_ELEMENT;

		if (flags & TYPE_ELEMENT && type === 'svg') {
			flags |= MODE_SVG;
		} else if (
			parentInternal &&
			parentInternal.flags & MODE_SVG &&
			parentInternal.type === 'foreignObject'
		) {
			flags &= ~MODE_SVG;
		}
	}

	/** @type {import('./internal').Internal} */
	const internal = {
		type,
		props,
		key,
		ref,
		children: null,
		parent: parentInternal,
		id: vnodeId,
		dom: null,
		component: null,
		flags: flags,
		depth: parentInternal ? parentInternal.depth + 1 : 0
	};

	if (options._internal) options._internal(internal, vnode);

	return internal;
}

const shouldSearchComponent = internal =>
	internal._flags & TYPE_COMPONENT &&
	(!(internal._flags & TYPE_ROOT) ||
		internal.props._parentDom == getParentDom(internal._parent));

/**
 * @param {import('./internal').Internal} internal
 * @param {number | null} [childIndex]
 * @returns {import('./internal').PreactNode}
 */
export function getDomSibling(internal, childIndex) {
	if (childIndex == null) {
		// Use childIndex==null as a signal to resume the search from the vnode's sibling
		return getDomSibling(
			internal.parent,
			internal.parent.children.indexOf(internal) + 1
		);
	}

	let childDom = getChildDom(internal, childIndex);
	if (childDom) {
		return childDom;
	}

	// If we get here, we have not found a DOM node in this vnode's children. We
	// must resume from this vnode's sibling (in it's parent _children array).
	// Only climb up and search the parent if we aren't searching through a DOM
	// VNode (meaning we reached the DOM parent of the original vnode that began
	// the search). Note, the top of the tree has _parent == null so avoiding that
	// here.
	return internal.parent && shouldSearchComponent(internal)
		? getDomSibling(internal)
		: null;
}

/**
 * @param {import('./internal').Internal} internal
 * @param {number} [i]
 * @returns {import('./internal').PreactElement}
 */
export function getChildDom(internal, i) {
	if (internal.children == null) {
		return null;
	}

	for (i = i || 0; i < internal.children.length; i++) {
		let child = internal.children[i];
		if (child != null) {
			if (child.flags & TYPE_DOM) {
				return child.dom;
			}

			if (shouldSearchComponent(child)) {
				let childDom = getChildDom(child);
				if (childDom) {
					return childDom;
				}
			}
		}
	}

	return null;
}

/**
 * @param {import('./internal').Internal} internal
 * @returns {import('./internal').PreactElement}
 */
export function getParentDom(internal) {
	let parentDom =
		internal.flags & TYPE_ROOT ? internal.props._parentDom : null;

	let parent = internal.parent;
	while (parentDom == null && parent) {
		if (parent.flags & TYPE_ROOT) {
			parentDom = parent.props._parentDom;
		} else if (parent.flags & TYPE_ELEMENT) {
			parentDom = parent.dom;
		}

		parent = parent.parent;
	}

	return parentDom;
}
