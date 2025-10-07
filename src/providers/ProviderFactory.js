/**
 * ProviderFactory
 *
 * Factory class for creating and managing media providers.
 * Handles provider registration, validation, and instantiation.
 */

const LocalMediaProvider = require("./LocalMediaProvider");
const SbMediaProvider = require("./SbMediaProvider");

// Simple structured logging
const log = {
    info: (message, meta = {}) =>
        console.log(
            JSON.stringify({
                level: "info",
                message,
                ...meta,
                timestamp: new Date().toISOString(),
            }),
        ),
    error: (message, meta = {}) =>
        console.error(
            JSON.stringify({
                level: "error",
                message,
                ...meta,
                timestamp: new Date().toISOString(),
            }),
        ),
    warn: (message, meta = {}) =>
        console.warn(
            JSON.stringify({
                level: "warn",
                message,
                ...meta,
                timestamp: new Date().toISOString(),
            }),
        ),
};

class ProviderFactory {
    constructor() {
        // Registry of available providers
        this.providers = new Map();
        this.registerDefaultProviders();
    }

    /**
     * Register default providers
     */
    registerDefaultProviders() {
        this.registerProvider("local", LocalMediaProvider);
        this.registerProvider("sb", SbMediaProvider);
    }

    /**
     * Register a new provider type
     * @param {string} type - Provider type identifier
     * @param {Class} ProviderClass - Provider class constructor
     */
    registerProvider(type, ProviderClass) {
        this.providers.set(type, ProviderClass);
        log.info("Provider registered", { type, className: ProviderClass.name });
    }

    /**
     * Get list of available provider types
     * @returns {Array<string>} Array of provider type names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Validate provider type
     * @param {string} providerType - Provider type to validate
     * @returns {boolean} True if provider type is valid
     */
    isValidProvider(providerType) {
        return this.providers.has(providerType);
    }

    /**
     * Get provider configuration schema
     * @param {string} providerType - Provider type
     * @returns {Object} Configuration schema
     */
    getProviderConfigSchema(providerType) {
        const ProviderClass = this.providers.get(providerType);
        if (!ProviderClass) {
            throw new Error(`Unknown provider type: ${providerType}`);
        }
        return ProviderClass.getConfigSchema();
    }

    /**
     * Validate provider configuration
     * @param {string} providerType - Provider type
     * @param {Object} args - Configuration arguments
     * @returns {Object} Validation result with success status and error details
     */
    validateProviderConfig(providerType, args) {
        if (!this.isValidProvider(providerType)) {
            return {
                success: false,
                error: `Invalid provider type: ${providerType}`,
                validProviders: this.getAvailableProviders(),
            };
        }

        const ProviderClass = this.providers.get(providerType);
        return ProviderClass.validateConfig(args);
    }

    /**
     * Create and initialize a provider instance
     * @param {string} providerType - Provider type
     * @param {Object} args - Configuration arguments
     * @returns {Promise<Object>} Result with provider instance or error
     */
    async createProvider(providerType, args) {
        try {
            // Validate provider type
            if (!this.isValidProvider(providerType)) {
                return {
                    success: false,
                    error: `Invalid provider type: ${providerType}`,
                    validProviders: this.getAvailableProviders(),
                };
            }

            // Validate configuration
            const validation = this.validateProviderConfig(providerType, args);
            if (!validation.success) {
                return validation;
            }

            // Create provider instance
            const ProviderClass = this.providers.get(providerType);
            const provider = new ProviderClass(...validation.constructorArgs);

            // Initialize provider
            const initResult = await provider.initialize();
            if (!initResult.success) {
                return {
                    success: false,
                    error: `Failed to initialize ${providerType} provider: ${initResult.error}`,
                };
            }

            log.info("Provider created and initialized successfully", {
                providerType,
                className: ProviderClass.name,
            });

            return {
                success: true,
                provider,
            };
        } catch (error) {
            log.error("Failed to create provider", {
                providerType,
                error: error.message,
            });
            return {
                success: false,
                error: `Failed to create provider: ${error.message}`,
            };
        }
    }

    /**
     * Generate usage information for all providers
     * @returns {Object} Usage information for each provider
     */
    generateUsageInfo() {
        const usage = {};

        for (const [type, ProviderClass] of this.providers) {
            try {
                const schema = ProviderClass.getConfigSchema();
                usage[type] = {
                    description: schema.description,
                    example: schema.example,
                    requiredArgs: schema.requiredArgs,
                    optionalArgs: schema.optionalArgs,
                };
            } catch (error) {
                usage[type] = {
                    description: `${type} provider`,
                    error: `Failed to get schema: ${error.message}`,
                };
            }
        }

        return usage;
    }
}

module.exports = ProviderFactory;