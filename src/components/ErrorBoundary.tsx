import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred';
      let isFirestoreError = false;

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.authInfo && parsed.operationType) {
          isFirestoreError = true;
          errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8">
          <div className="max-w-md w-full border-4 border-[#141414] bg-white p-12 text-center shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-center mb-8">
              <div className="bg-red-50 p-4 border-2 border-red-500">
                <ShieldAlert className="h-12 w-12 text-red-500" />
              </div>
            </div>
            <h2 className="text-3xl font-bold uppercase tracking-tighter mb-4 italic">System Fault</h2>
            <p className="text-[10px] font-mono font-bold uppercase opacity-50 mb-8 leading-relaxed whitespace-pre-wrap break-words">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="flex w-full items-center justify-center gap-3 border-4 border-[#141414] bg-[#141414] px-6 py-4 text-xs font-bold uppercase text-[#E4E3E0] transition-all hover:bg-white hover:text-[#141414]"
            >
              <RefreshCw className="h-5 w-5" />
              Restart System
            </button>
            {isFirestoreError && (
              <p className="mt-6 text-[8px] font-mono opacity-40 uppercase">
                Note: Ensure your Vercel domain is authorized in Firebase Console Settings.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
