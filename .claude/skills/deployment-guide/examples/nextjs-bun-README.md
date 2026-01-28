# Next.js with Bun Multi-Stage Dockerfile

This Dockerfile pattern is optimized for Next.js applications using Bun runtime with multi-stage builds for production deployments.

## Features

- Multi-stage build (deps → builder → runner)
- Bun + Node.js 22 dual runtime support
- Non-root user for security
- Standalone Next.js build output
- Cached dependencies between stages
- Optimized for Render.com deployment

## Usage

```yaml
services:
  - type: web
    name: my-nextjs-app
    runtime: docker
    dockerfilePath: ./docker/app.Dockerfile
    dockerContext: .
    dockerCommand: bun apps/sim/server.js
    healthCheckPath: /api/health
```

## Customization

1. Update app paths to match your project structure
2. Adjust Node.js/Bun versions as needed
3. Modify EXPOSE port if different from 3000
4. Update startup command to match your entry point

## Requirements

- Bun 1.3.3+
- Node.js 22
- Next.js with standalone output enabled
