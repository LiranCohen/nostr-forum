import React, { ErrorInfo, ReactNode } from 'react'

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

interface Props {
  className?: string
  children: ReactNode
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  get className(): string {
    return this.props.className ? this.props.className : 'boundary'
  }

  render() {
    if (this.state.hasError) {
      return <div className={`${this.className} error`}>
        {this.props.children}
        <span className={`${this.className} error-message`}>{this.state.error?.message}</span>;
      </div>
    }

    return <div className={`${this.className}`}>{this.props.children}</div>
  }
}

export {ErrorBoundary}