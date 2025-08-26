// Minimal type declaration to use react-dom's flushSync without installing @types/react-dom
declare module 'react-dom' {
  export function flushSync(fn: (...args: any[]) => any): void;
}

