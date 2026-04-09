import React, { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { captureHandledError } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component for graceful error handling.
 * Catches JavaScript errors in child components and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error in development only
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
    // Forward to Sentry in all environments — silent no-op if DSN not configured.
    captureHandledError(error, { componentStack: errorInfo.componentStack ?? '' });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-black px-6">
          <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
            <AlertTriangle size={32} color="#EF4444" />
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Something went wrong
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
            We encountered an unexpected error. Please try again.
          </Text>
          {__DEV__ && this.state.error && (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6 max-w-full">
              <Text className="text-xs text-red-600 dark:text-red-400 font-mono">
                {this.state.error.message}
              </Text>
            </View>
          )}
          <Pressable
            onPress={this.handleRetry}
            className="flex-row items-center bg-teal-500 px-6 py-3 rounded-xl active:opacity-80"
          >
            <RefreshCw size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold ml-2">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
