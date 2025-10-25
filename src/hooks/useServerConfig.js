import { useState, useEffect } from "react";

/**
 * Hook to fetch and manage server configuration
 * Provides provider capabilities and UI configuration
 */
function useServerConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/config");
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const configData = await response.json();
      setConfig(configData);
    } catch (err) {
      console.error("Failed to fetch server config:", err);
      setError(err.message);

      // Fallback to basic config if fetch fails
      setConfig({
        provider: {
          type: "unknown",
          capabilities: {
            canRescan: false,
            canRegenerateThumbnails: false,
            canManageTags: false,
            canGetFileHashForPath: false,
            supportsLocalFiles: false,
            supportsRemoteFiles: false,
          },
        },
        ui: {
          showDirectoryInfo: true,
          directoryLabel: "Directory",
          showRescanButton: false,
          showRegenerateThumbnailsButton: false,
          showTagManager: false,
          showConnectionStatus: false,
          availableActions: [],
        },
        availableProviders: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Helper functions for common checks
  const canPerformAction = (action) => {
    if (!config?.ui?.availableActions) return false;
    return config.ui.availableActions.includes(action);
  };

  const getProviderType = () => {
    return config?.provider?.type || "unknown";
  };

  const getProviderCapabilities = () => {
    return config?.provider?.capabilities || {};
  };

  const getUIConfig = () => {
    return config?.ui || {};
  };

  const isProviderType = (type) => {
    return getProviderType() === type;
  };

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,

    // Helper functions
    canPerformAction,
    getProviderType,
    getProviderCapabilities,
    getUIConfig,
    isProviderType,

    // Common capability checks
    canRescan: canPerformAction("rescan-directory"),
    canRegenerateThumbnails: canPerformAction("regenerate-thumbnails"),
    canManageTags: canPerformAction("manage-tags"),
    showConnectionStatus: getUIConfig().showConnectionStatus,
    showDirectoryInfo: getUIConfig().showDirectoryInfo,
    directoryLabel: getUIConfig().directoryLabel || "Directory",

    // Directory information from provider config
    directoryName:
      config?.provider?.config?.directoryPath ||
      config?.provider?.config?.sbUrl ||
      "",
  };
}

export default useServerConfig;
