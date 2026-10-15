/**
 * @file ErrorBoundary.jsx
 * @summary Standard React Error Boundary class component. Wraps child component trees 
 *          to catch uncaught JavaScript rendering exceptions, log details in development mode, 
 *          and render a user-friendly fallback state panel to prevent browser screen crashes.
 * 
 * @functions
 * - constructor: Initializes the error tracking state object.
 * - getDerivedStateFromError: Static lifecycle hook triggered when a child throws an error, updating state to enable fallback rendering.
 * - componentDidCatch: Lifecycle hook that catches error information and logs diagnostics in local development environments.
 * - render: Evaluates state to return either the standard child nodes or the user-friendly `<ErrorState>` fallback panel.
 */

import React from "react";
import { ErrorState } from "./FeedbackUI";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("Interview UI error boundary caught:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 p-4 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <ErrorState
              title="This page hit a UI error"
              message="Refresh the page or go back to the dashboard. Your saved interview data is not affected."
              onRetry={() => this.setState({ hasError: false })}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
