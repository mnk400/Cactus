#!/bin/bash
bunx concurrently "bun run dev" "bun src/server.js $*"
