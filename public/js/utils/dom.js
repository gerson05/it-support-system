// DOM manipulation utilities
const DOM = {
  // Selectors
  query(selector) {
    return document.querySelector(selector);
  },

  queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  },

  id(id) {
    return document.getElementById(id);
  },

  // Creation
  create(tag, attrs = {}, html = '') {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    if (html) el.innerHTML = html;
    return el;
  },

  // Manipulation
  addClass(el, className) {
    el?.classList.add(className);
  },

  removeClass(el, className) {
    el?.classList.remove(className);
  },

  toggleClass(el, className) {
    el?.classList.toggle(className);
  },

  hasClass(el, className) {
    return el?.classList.contains(className) ?? false;
  },

  setAttr(el, key, value) {
    el?.setAttribute(key, value);
  },

  getAttr(el, key) {
    return el?.getAttribute(key);
  },

  show(el) {
    if (el) el.style.display = '';
  },

  hide(el) {
    if (el) el.style.display = 'none';
  },

  toggle(el) {
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  },

  // Content
  html(el, content) {
    if (el) el.innerHTML = content;
  },

  text(el, content) {
    if (el) el.textContent = content;
  },

  append(parent, child) {
    if (parent) parent.appendChild(child);
  },

  remove(el) {
    el?.remove();
  },

  // Events
  on(el, event, handler) {
    el?.addEventListener(event, handler);
  },

  off(el, event, handler) {
    el?.removeEventListener(event, handler);
  },

  delegate(parent, selector, event, handler) {
    parent?.addEventListener(event, (e) => {
      if (e.target.matches(selector)) handler(e);
    });
  }
};
