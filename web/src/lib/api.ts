export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Browser: use public URL from env or fallback to current hostname
    return (
      process.env.NEXT_PUBLIC_API_URL || 
      `http://${window.location.hostname}:8000`
    );
  }
  // Server: use local API URL
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
};
