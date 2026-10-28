// The Portal loads React from a CDN as a global (window.React). The Volunteer Hub files mirrored into src/hub
// import from 'react', so the build points that import here (see the "build" script in package.json).
const R = window.React;
export default R;
export const useState = R.useState;
export const useEffect = R.useEffect;
export const useRef = R.useRef;
export const useMemo = R.useMemo;
export const useCallback = R.useCallback;
export const useContext = R.useContext;
export const createContext = R.createContext;
export const useLayoutEffect = R.useLayoutEffect;
export const Fragment = R.Fragment;
export const lazy = R.lazy;
export const Suspense = R.Suspense;
