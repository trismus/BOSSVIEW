import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'SKYNEX Dark',
      values: [
        { name: 'SKYNEX Dark', value: '#0b0e14' },
        { name: 'Surface Container', value: '#161a21' },
        { name: 'Surface Container Low', value: '#10131a' },
      ],
    },
    a11y: {
      // Enable accessibility testing
      element: '#storybook-root',
      config: {},
      options: {
        checks: { 'color-contrast': { options: { noScroll: true } } },
        restoreScroll: true,
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'SKYNEX Theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [{ value: 'dark', title: 'Dark (Default)' }],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
