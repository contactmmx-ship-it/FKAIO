/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws on render
function ThrowOnRender({ message }: { message: string }): never {
  throw new Error(message);
}

// Helper to suppress React error boundary console output during tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('catches render errors and shows error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="Test error" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="Specific error details here" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Specific error details here')).toBeInTheDocument();
  });

  it('has a Try Again button', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="Test" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('has a Back to Dashboard button', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="Test" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('shows error was logged message', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="Test" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/logged for review/)).toBeInTheDocument();
  });

  it('renders without crashing for null children', () => {
    render(<ErrorBoundary>{null}</ErrorBoundary>);
    // Should not throw
  });

  it('renders without crashing for undefined children', () => {
    render(<ErrorBoundary>{undefined}</ErrorBoundary>);
    // Should not throw
  });

  it('renders multiple children when no error', () => {
    render(
      <ErrorBoundary>
        <div>First</div>
        <div>Second</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('catches errors in deeply nested children', () => {
    function Parent() {
      return (
        <div>
          <ThrowOnRender message="Deep error" />
        </div>
      );
    }

    render(
      <ErrorBoundary>
        <Parent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
