FROM node:20-bullseye

# Install Python and native build tools required by node-gyp and some Python deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-dev build-essential make g++ git curl ca-certificates pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Configure npm global package location to avoid permission issues
ENV NPM_PACKAGES="/home/node/.npm-packages"
RUN mkdir -p "$NPM_PACKAGES" && npm config set prefix "$NPM_PACKAGES"
ENV PATH="$NPM_PACKAGES/bin:$PATH"

# Ensure node-gyp uses system Python
ENV PYTHON=/usr/bin/python3

# Provide a writable node_modules volume for the workspace
VOLUME [ "/workspace/node_modules" ]
RUN mkdir -p /workspace/node_modules && chown -R node:node /workspace/node_modules || true

# Install Rust toolchain (some deps may use it during build)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="$PATH:/root/.cargo/bin"

# Install Python requirements if present (non-fatal if file missing)
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --upgrade pip && pip3 install -r /tmp/requirements.txt || true

WORKDIR /workspaces/homelab-gpt
