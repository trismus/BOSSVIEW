/**
 * ESLint rule: no-hardcoded-colors
 *
 * Disallows hardcoded hex color values in JSX style props.
 * Colors should come from the centralized data-viz-colors.ts or Tailwind classes.
 *
 * Bad:  style={{ color: '#ff0000' }}
 * Good: style={{ color: STATUS_COLORS.red }}
 * Good: className="text-red-500"
 */

const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3}){1,2}\b/;
const RGB_REGEX = /rgb(a)?\s*\(/i;

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded color values in style props',
      recommended: true,
    },
    messages: {
      noHardcodedHex:
        'Hardcoded hex color "{{value}}" in style prop. Import from data-viz-colors.ts or use Tailwind classes instead.',
      noHardcodedRgb:
        'Hardcoded rgb(a) color in style prop. Import from data-viz-colors.ts or use Tailwind classes instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Match JSXAttribute with name="style"
      'JSXAttribute[name.name="style"]'(node) {
        // style={{ ... }} → value is JSXExpressionContainer
        if (node.value?.type !== 'JSXExpressionContainer') return;

        const expr = node.value.expression;

        // style={{ color: '#fff' }} → ObjectExpression
        if (expr.type !== 'ObjectExpression') return;

        for (const prop of expr.properties) {
          if (prop.type !== 'Property') continue;

          // Check if the value is a string literal with a hex color
          if (prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
            const val = prop.value.value;

            if (HEX_COLOR_REGEX.test(val)) {
              context.report({
                node: prop.value,
                messageId: 'noHardcodedHex',
                data: { value: val },
              });
            } else if (RGB_REGEX.test(val)) {
              context.report({
                node: prop.value,
                messageId: 'noHardcodedRgb',
              });
            }
          }

          // Check template literals: `${something}#fff`
          if (prop.value.type === 'TemplateLiteral') {
            for (const quasi of prop.value.quasis) {
              const raw = quasi.value.raw;
              if (HEX_COLOR_REGEX.test(raw)) {
                context.report({
                  node: quasi,
                  messageId: 'noHardcodedHex',
                  data: { value: raw.match(HEX_COLOR_REGEX)[0] },
                });
              }
            }
          }
        }
      },
    };
  },
};
