/**
 * SentryTestButton - Temporary component for verifying Sentry error tracking
 * 
 * Usage: Import and render this component to test if Sentry is capturing errors.
 * After confirming errors appear in Sentry dashboard, remove this component.
 * 
 * Note: Sentry is only enabled in production (import.meta.env.PROD),
 * so you'll need to deploy to test error tracking.
 */
function SentryTestButton() {
  return (
    <button
      onClick={() => {
        throw new Error("This is your first Sentry test error!");
      }}
      className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors font-medium"
    >
      Break the world (Test Sentry)
    </button>
  );
}

export default SentryTestButton;
