"use client";

import { Component, type ReactNode } from "react";

/** Shows `fallback` if a model or texture fails to load, so one bad file never blanks the scene. */
export class AssetBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("3D asset failed to load; drawing the plain version instead.", error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
