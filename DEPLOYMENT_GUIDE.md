# Deployment Script Best Practices for Trae/Cursor Agents

When generating `deploy.sh` or similar deployment scripts for Linux environments (especially Ubuntu/Debian on ECS), please adhere to the following checklist to prevent common failure modes.

## 1. System Dependency Checks
- **npm Availability**: Do not assume `npm` is installed with `nodejs`. Some distros package them separately.
  ```bash
  if ! command -v npm >/dev/null; then
      sudo apt-get install -y npm
  fi
  ```

## 2. Node.js Version Management
- **Version Check**: Modern frontend stacks (Vite 5+, Tailwind 4) require Node.js >= 18.
- **Safe Upgrade Path**:
  - Check the current version before upgrading.
  - **CRITICAL**: If upgrading from an old version (e.g., v12), explicitly remove old packages first to avoid `dpkg` file conflicts (e.g., `/usr/include/node/common.gypi`).
  ```bash
  if [ "$NODE_VERSION" -lt 18 ]; then
      # Remove potential conflicting packages from old repos
      sudo apt-get remove -y nodejs libnode-dev || true
      sudo apt-get autoremove -y || true
      
      # Install new version (e.g., via NodeSource)
      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
      sudo apt-get install -y nodejs
  fi
  ```

## 3. Build Artifact Consistency
- **Clean Install on Environment Change**: If the Node.js version changes (or for first-time runs on a dirty state), binary bindings in `node_modules` (esbuild, rollup) will break.
- **Action**: Force clean `node_modules` before installing dependencies.
  ```bash
  if [ -d "node_modules" ]; then
      rm -rf node_modules package-lock.json
  fi
  npm install
  ```

## 4. Service Configuration
- **User Permissions**: Ensure Systemd services run as a specific user (e.g., `User=$(whoami)`), not root, unless necessary.
- **Environment Variables**: Explicitly pass `.env` files to the service configuration.

## 5. Error Handling
- Use `set -e` at the top of the script to fail fast on errors.
