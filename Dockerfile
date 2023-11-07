FROM python:3.10
WORKDIR /app
COPY . /app

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl

# Update new packages
RUN apt-get update
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y && . $HOME/.cargo/env
RUN . $HOME/.cargo/env && pip3 install -r /app/server/requirements.txt
WORKDIR /
CMD ["python", "-m", "app.server"]