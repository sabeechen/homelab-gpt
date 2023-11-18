FROM python:3.10

RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs npm yarn build-essential curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Sets directories for NPM global packages
ENV NODE_PATH="/root/.npm-packages/lib/node_modules" \
    MANPATH="/root/.npm-packages/share/man"
RUN echo "prefix = /root/.npm-packages" >> /root/.npmrc && \
    chmod 600 /root/.npmrc
ENV PATH=/root/.npm-packages/bin:$PATH
# Fix ownership and permissions of anonymous volume 'node_modules'
VOLUME [ "/workspace/node_modules" ]
RUN mkdir -p /workspace/node_modules && \
    chmod 700 /workspace/node_modules

# Update new packages
RUN apt-get update
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y && . $HOME/.cargo/env

COPY requirements.txt /requirements.txt
RUN pip install --upgrade pip
RUN . $HOME/.cargo/env && pip install -r /requirements.txt
