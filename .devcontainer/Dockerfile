FROM qmcgaw/reactdevcontainer
RUN apk add python3 python3-dev py3-pip curl make automake gcc g++ subversion nodejs npm openssl openssl-dev musl-dev
COPY requirements.txt /requirements.txt
RUN pip install --upgrade pip
RUN pip install -r /requirements.txt
RUN npm i -g rollup typescript
