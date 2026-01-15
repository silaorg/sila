export type PageSearchMatch = {
  element: HTMLElement;
};

export type PageSearchHighlightResult = {
  matches: PageSearchMatch[];
};

export type PageSearchConfig = {
  enabled: boolean;
  useNative: boolean;
};

export type PageSearchController = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (value: string) => void;
  next: () => void;
  prev: () => void;
};

const BASE_MARK_CLASSES =
  "chat-find-mark bg-secondary-200-800 text-surface-900-50 rounded";
const ACTIVE_MARK_CLASSES = ["bg-secondary-500", "text-secondary-50"];

export function clearPageSearchHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll("mark[data-chat-find]");
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

export function highlightPageSearchMatches(
  container: HTMLElement,
  query: string,
  maxMatches = 1000,
): PageSearchHighlightResult {
  clearPageSearchHighlights(container);

  const trimmed = query.trim();
  if (!trimmed) {
    return { matches: [] };
  }

  const matches: PageSearchMatch[] = [];
  const queryLower = trimmed.toLowerCase();
  const textNodes = collectTextNodes(container);

  for (const node of textNodes) {
    if (matches.length >= maxMatches) break;
    if (!node.nodeValue) continue;
    const result = wrapTextNodeMatches(node, queryLower, matches, maxMatches);
    if (!result && matches.length >= maxMatches) break;
  }

  return { matches };
}

export function setActivePageSearchMatch(match: PageSearchMatch | null): void {
  if (!match) return;
  match.element.dataset.chatFindActive = "true";
  match.element.classList.add(...ACTIVE_MARK_CLASSES);
  match.element.scrollIntoView({ block: "center" });
}

export function clearActivePageSearchMatch(match: PageSearchMatch | null): void {
  if (!match) return;
  delete match.element.dataset.chatFindActive;
  match.element.classList.remove(...ACTIVE_MARK_CLASSES);
}

function collectTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || node.nodeValue.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function shouldSkipElement(element: HTMLElement): boolean {
  const skipTags = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);
  if (skipTags.has(element.tagName)) return true;
  if (element.closest("pre, code, kbd, samp")) return true;
  if (element.closest("[contenteditable='true'], [contenteditable='plaintext-only']")) {
    return true;
  }
  return false;
}

function wrapTextNodeMatches(
  node: Text,
  queryLower: string,
  matches: PageSearchMatch[],
  maxMatches: number,
): boolean {
  const text = node.nodeValue ?? "";
  const lower = text.toLowerCase();
  let index = 0;
  let found = lower.indexOf(queryLower, index);
  if (found === -1) return false;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  while (found !== -1) {
    if (matches.length >= maxMatches) break;

    if (found > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, found)));
    }

    const mark = document.createElement("mark");
    mark.dataset.chatFind = "true";
    mark.className = BASE_MARK_CLASSES;
    const matchText = text.slice(found, found + queryLower.length);
    mark.textContent = matchText;
    fragment.appendChild(mark);
    matches.push({ element: mark });

    lastIndex = found + queryLower.length;
    index = lastIndex;
    found = lower.indexOf(queryLower, index);
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  node.parentNode?.replaceChild(fragment, node);
  return true;
}
