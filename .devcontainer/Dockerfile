FROM qmcgaw/reactdevcontainer
RUN apk update && apk upgrade
RUN apk add python3 python3-dev py3-pip curl make automake gcc g++ subversion nodejs npm openssl openssl-dev musl-dev
RUN curl https://sh.rustup.rs -sSf -o rust.sh
RUN chmod 777 rust.sh
RUN ./rust.sh -y
ENV PATH="${PATH}:/root/.cargo/bin"
COPY requirements.txt /requirements.txt
RUN pip install --upgrade pip
RUN pip install -r /requirements.txt
