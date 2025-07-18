/**
 * Media Providers Module
 * 
 * This module exports the MediaSourceProvider interface and its implementations.
 */

const MediaSourceProvider = require('./MediaSourceProvider');
const LocalMediaProvider = require('./LocalMediaProvider');

module.exports = {
  MediaSourceProvider,
  LocalMediaProvider,
  // StashMediaProvider will be added here when implemented
};