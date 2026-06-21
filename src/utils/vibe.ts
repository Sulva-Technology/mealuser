/**
 * Safeguard wrapper around navigator.vibrate.
 * Handles iframe constraints, browser support, and standard touch vibration feedback.
 */
export const triggerVibration = (pattern: number | number[]) => {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration failures (some contexts like iframe permissions might block it)
      console.warn('Vibration feedback blocked or unsupported in this context:', e);
    }
  }
};

/**
 * Standard tactile vibration patterns
 */
export const VIBE_PATTERNS = {
  /**
   * Light click/haptic tick for adding to cart or simple button selections (e.g. 40ms)
   */
  TICK: 40,

  /**
   * Medium accent for standard success elements (e.g. 70ms)
   */
  MEDIUM: 70,

  /**
   * Distinct dual pulse for major successful achievements like completing checkout (e.g. [100, 50, 100])
   */
  SUCCESS: [100, 50, 100],

  /**
   * Heavy double pulse for important confirmations or actions (e.g. [120, 60, 120])
   */
  CONFIRM: [120, 60, 120],

  /**
   * Triple pulse warning style for error messages or validation blockages
   */
  ERROR: [100, 50, 100, 50, 150],
};
