import type { FieldValidator } from "@zoworkhq/forms/core";
import { validators as ownValidator } from "../../../content/docs/examples/own-validator.validators.js";

/**
 * The validators a live example runs, by the name its page gives
 * `<LiveExample validators="…">`. A function can't come from the server page,
 * so the example imports them here. Each is the file beside its page, which
 * the page shows word for word (own-validator-example.test.ts).
 */
export const EXAMPLE_VALIDATORS: Record<string, readonly FieldValidator[]> = {
  "own-validator": ownValidator,
};
