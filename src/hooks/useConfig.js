import { useState, useEffect } from "react";

export function useConfig() {
  const [config, setConfig] = useState({
    predictEnabled: false,
    predictApiUrl: "",
    provider: { type: "local" }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          throw new Error("Failed to fetch config");
        }
        const data = await response.json();
        setConfig(data);
      } catch (err) {
        setError(err.message);
        console.error("Failed to fetch config:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading, error };
}