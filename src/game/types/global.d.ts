import type { NeonDebugApi } from './Chapter';

declare global {
  interface Window {
    __NEON_DEBUG__?: NeonDebugApi;
  }
}

export {};
