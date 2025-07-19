# ⚙️ LavaMusic Configuration Files

This folder contains deployment and environment configuration files for the LavaMusic Discord bot project.

**Note**: Core build configuration files (tsconfig.json, tsup.config.ts, biome.json) are kept in the project root for build tool compatibility.

## 📋 Configuration Files

### 🔧 Build & Development Configuration
- **[tsconfig.json](../tsconfig.json)** - TypeScript compiler configuration (in root for build tools)
- **[tsup.config.ts](../tsup.config.ts)** - Build tool configuration for bundling (in root for build tools)
- **[biome.json](../biome.json)** - Code formatting and linting configuration (in root for build tools)

### 🎵 Audio & Lavalink Configuration
- **[application.yml](./application.yml)** - Basic Lavalink configuration (legacy)

### 🚀 Deployment Configuration
- **[process.json](./process.json)** - PM2 process manager configuration
- **[replit.nix](./replit.nix)** - Replit environment configuration

## 📖 Configuration Details

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    // ... other TypeScript options
  }
}
```

**Purpose**: Configures TypeScript compilation settings for the project.

### Build Configuration (tsup.config.ts)
```typescript
export default {
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  // ... other build options
}
```

**Purpose**: Configures the build process for creating production bundles.

### Code Quality (biome.json)
```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  },
  "linter": {
    "enabled": true
  }
}
```

**Purpose**: Configures code formatting and linting rules.

### Process Management (process.json)
```json
{
  "apps": [{
    "name": "lavamusic",
    "script": "dist/index.js",
    "instances": 1
  }]
}
```

**Purpose**: Configures PM2 process manager for production deployment.

## 🔄 Configuration Updates

### When to Update Configurations

1. **tsconfig.json**: When changing TypeScript version or compilation targets
2. **tsup.config.ts**: When modifying build process or adding new entry points
3. **biome.json**: When updating code style guidelines
4. **process.json**: When changing deployment strategy or scaling requirements

### Safe Update Practices

1. **Backup**: Always backup working configurations before changes
2. **Test**: Test configuration changes in development environment first
3. **Validate**: Use appropriate tools to validate configuration syntax
4. **Document**: Update this README when making significant changes

## 🛠️ Development Setup

### Initial Configuration
```bash
# Install dependencies
npm install

# Validate TypeScript configuration
npx tsc --noEmit

# Test build configuration
npm run build

# Check code formatting
npx biome check
```

### Configuration Validation

#### TypeScript Configuration
```bash
npx tsc --showConfig
```

#### Build Configuration
```bash
npm run build -- --dry-run
```

#### Code Quality
```bash
npx biome check --apply
```

## 📁 Configuration Hierarchy

### Primary Configurations
1. **tsconfig.json** - Base TypeScript configuration
2. **package.json** - Project dependencies and scripts (in root)
3. **biome.json** - Code quality standards

### Environment-Specific
- **Development**: Uses tsconfig.json with source maps
- **Production**: Uses tsup.config.ts for optimized builds
- **Deployment**: Uses process.json for PM2 management

### External Configurations
- **Lavalink**: `../Lavalink/application.yml` (main Lavalink config)
- **Environment**: `.env` file in project root
- **Docker**: `../docker/` folder for containerization

## 🔧 Troubleshooting

### Common Configuration Issues

#### TypeScript Compilation Errors
```bash
# Check configuration
npx tsc --showConfig

# Validate syntax
npx tsc --noEmit
```

#### Build Failures
```bash
# Clean build cache
rm -rf dist/
npm run build
```

#### Code Quality Issues
```bash
# Auto-fix formatting
npx biome format --write .

# Check linting rules
npx biome lint .
```

### Configuration Conflicts

1. **TypeScript vs Build Tool**: Ensure tsconfig.json and tsup.config.ts are compatible
2. **Formatting Tools**: Biome configuration should align with editor settings
3. **Environment Variables**: Check that all required variables are documented

## 📚 Related Documentation

- **Build Process**: See `../docs/` for build and deployment guides
- **Development**: Check `../tests/` for configuration testing
- **Deployment**: Review `../docker/` for containerization configs

## 🤝 Contributing

When modifying configurations:

1. **Test Thoroughly**: Ensure changes don't break existing functionality
2. **Document Changes**: Update this README and relevant documentation
3. **Version Control**: Commit configuration changes separately from code changes
4. **Review Impact**: Consider how changes affect development, testing, and production

## 🔍 Configuration Best Practices

1. **Consistency**: Keep configurations consistent across environments
2. **Security**: Never commit sensitive data in configuration files
3. **Validation**: Use schema validation where possible
4. **Documentation**: Document all non-obvious configuration options
5. **Backup**: Maintain backups of working configurations
