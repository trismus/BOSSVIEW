/**
 * SKYNEX Design System ESLint Plugin
 *
 * Local ESLint rules for enforcing design system conventions.
 */

import noHardcodedColors from './no-hardcoded-colors.js';

export default {
  rules: {
    'no-hardcoded-colors': noHardcodedColors,
  },
};
