import type { ConditionOperator } from "@formbuilder/form-schema";

/** Each condition operator as the editor names it. The docs' "For developers" sections repeat these words. */
export const OPERATOR_TEXT: Record<ConditionOperator, string> = {
  exists: "is answered",
  "=": "is",
  "!=": "is not",
  contains: "includes",
  ">": "is greater than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most",
};
