/**
 * Media Providers Module
 * 
 * This module exports the MediaSourceProvider interface and its implementations.
 */

const MediaSourceProvider = require('./MediaSourceProvider');
const LocalMediaProvider = require('./LocalMediaProvider');
const SbMediaProvider = require('./SbMediaProvider');

module.exports = {
  MediaSourceProvider,
  LocalMediaProvider,
  SbMediaProvider,
};