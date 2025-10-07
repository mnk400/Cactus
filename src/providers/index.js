/**
 * Media Providers Module
 *
 * This module exports the MediaSourceProvider interface and its implementations.
 */

const MediaSourceProvider = require("./MediaSourceProvider");
const LocalMediaProvider = require("./LocalMediaProvider");
const SbMediaProvider = require("./SbMediaProvider");
const ProviderFactory = require("./ProviderFactory");

module.exports = {
  MediaSourceProvider,
  LocalMediaProvider,
  SbMediaProvider,
  ProviderFactory,
};
