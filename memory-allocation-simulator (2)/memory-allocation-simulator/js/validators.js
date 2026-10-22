/**
 * validators.js
 * Parsing and validation of user input (mirrors validators.py).
 * Kept separate from the algorithms and the UI so rules can change independently.
 */
(function (root) {
  "use strict";

  const MIN_BLOCK_SIZE = 1;
  const MAX_BLOCK_SIZE = 1000000; // KB, sanity bound
  const MAX_ITEMS = 50;

  /** Error whose message is shown directly to the user. */
  class InputValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = "InputValidationError";
    }
  }

  /**
   * Convert "100, 500, 200" into a validated array of positive integers (KB).
   * @param {string} rawText   text typed by the user
   * @param {string} fieldName label used in error messages
   * @returns {number[]}
   * @throws {InputValidationError}
   */
  function parseSizeList(rawText, fieldName) {
    if (rawText === null || rawText === undefined || rawText.trim() === "") {
      throw new InputValidationError(`${fieldName} cannot be empty.`);
    }

    const tokens = rawText.split(",").map((t) => t.trim());

    if (tokens.some((t) => t === "")) {
      throw new InputValidationError(
        `${fieldName} contains an empty value (check for stray commas).`
      );
    }
    if (tokens.length > MAX_ITEMS) {
      throw new InputValidationError(
        `${fieldName}: please enter no more than ${MAX_ITEMS} values.`
      );
    }

    return tokens.map((tok) => {
      // Strict whole-number check: rejects "12abc", "1.5", "1e3", "0x10"
      if (!/^[+-]?\d+$/.test(tok)) {
        throw new InputValidationError(
          `${fieldName}: '${tok}' is not a valid whole number.`
        );
      }
      const value = parseInt(tok, 10);
      if (value < MIN_BLOCK_SIZE) {
        throw new InputValidationError(
          `${fieldName}: '${tok}' must be a positive number (KB).`
        );
      }
      if (value > MAX_BLOCK_SIZE) {
        throw new InputValidationError(
          `${fieldName}: '${tok}' exceeds the maximum allowed size of ${MAX_BLOCK_SIZE} KB.`
        );
      }
      return value;
    });
  }

  /** Last boundary check before an algorithm runs. */
  function validateNonEmptyLists(blocks, processes) {
    if (!blocks.length) throw new InputValidationError("At least one memory block is required.");
    if (!processes.length) throw new InputValidationError("At least one process is required.");
  }

  const api = { parseSizeList, validateNonEmptyLists, InputValidationError, MAX_BLOCK_SIZE, MAX_ITEMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Validators = api;
})(typeof window !== "undefined" ? window : globalThis);
