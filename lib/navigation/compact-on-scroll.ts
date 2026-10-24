/**
 * When the phone bottom bar shrinks: scrolling down past the top zone makes it compact, scrolling back up by a few
 * pixels (or reaching the top) makes it full again. Small jitters, the bounce at the end of the page and the first
 * pixels of a page never change it. Pure, so the hook that reads the scroll position stays thin and this stays tested.
 */

/** Scroll offset (px) under which the bar is always full: the top of a page is where people read the title. */
export const COMPACT_TOP_ZONE_PX = 48;
/** Distance (px) the user must scroll in one direction before the bar changes, so small jitters do nothing. */
export const COMPACT_DISTANCE_PX = 16;

export interface CompactScrollState {
  compact: boolean;
  /** Turning point of the current direction: the lowest offset while compact, the highest while full. */
  anchor: number;
}

export const INITIAL_COMPACT_STATE: CompactScrollState = { compact: false, anchor: 0 };

/**
 * Next state for a new scroll offset `y` of a container that can scroll up to `maxY`.
 * Near the bottom edge the state is kept: the rubber-band bounce there moves upwards without the user asking to.
 */
export function nextCompactState(state: CompactScrollState, y: number, maxY: number): CompactScrollState {
  if (y <= COMPACT_TOP_ZONE_PX) return { compact: false, anchor: Math.max(y, 0) };
  if (y >= maxY - COMPACT_DISTANCE_PX) return { compact: state.compact, anchor: state.compact ? Math.max(state.anchor, y) : state.anchor };
  if (state.compact) {
    if (state.anchor - y >= COMPACT_DISTANCE_PX) return { compact: false, anchor: y };
    return { compact: true, anchor: Math.max(state.anchor, y) };
  }
  if (y - state.anchor >= COMPACT_DISTANCE_PX) return { compact: true, anchor: y };
  return { compact: false, anchor: Math.min(state.anchor, y) };
}
