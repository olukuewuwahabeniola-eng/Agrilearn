import { Component, Fragment } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("AgriLearn UI error:", error?.message || error);
  }

  handleRetry = () => {
    this.setState((current) => ({
      hasError: false,
      resetKey: current.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-loading-screen" role="alert">
          <div style={{ textAlign: "center", maxWidth: 420, padding: "1.25rem" }}>
            <strong style={{ display: "block", marginBottom: "0.55rem", fontSize: "1.05rem" }}>
              Something went wrong
            </strong>
            <p style={{ margin: "0 0 1rem", color: "#5f7366", fontSize: "0.92rem" }}>
              This part of AgriLearn could not load. You can try again without
              losing the rest of the site.
            </p>
            <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
              Try again
            </button>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

export default ErrorBoundary;
