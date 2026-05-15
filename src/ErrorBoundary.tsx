import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: ReactNode | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    const errorText = '' + (error as any).toString();
    return { error: <p>{errorText}</p> };
  }

  componentDidCatch() {}

  render() {
    if (this.state.error !== null) {
      return (
        <div className="bg-red-500/20 border border-red-500/50 p-8 flex flex-col gap-4 container mx-auto">
          <h1 className="text-xl font-bold">Caught an error while rendering:</h1>
          {this.state.error}
        </div>
      );
    }

    return this.props.children;
  }
}
