/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// SVG imports with ?react suffix return React components
declare module '*.svg?react' {
  import * as React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
