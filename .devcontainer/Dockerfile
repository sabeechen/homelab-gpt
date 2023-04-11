FROM qmcgaw/reactdevcontainer
RUN apk add python3 python3-dev py3-pip curl make automake gcc g++ subversion nodejs npm openssl openssl-dev musl-dev
RUN curl https://sh.rustup.rs -sSf -o rust.sh
RUN chmod 777 rust.sh
RUN ./rust.sh -y
ENV PATH="${PATH}:/root/.cargo/bin"
COPY requirements.txt /requirements.txt
RUN pip install --upgrade pip
RUN pip install -r /requirements.txt
RUN npm install -g typescript eslint
RUN npm i -g @webcomponents/template
RUN npm i -g  rollup  @web/rollup-plugin-html  @web/rollup-plugin-copy @rollup/plugin-node-resolve @rollup/plugin-terser rollup-plugin-minify-html-literals rollup-plugin-summary
RUN npm i -g --save-dev rollup @web/rollup-plugin-html @web/rollup-plugin-copy @rollup/plugin-node-resolve @rollup/plugin-terser @rollup/plugin-typescript @rollup/plugin-commonjs rollup-plugin-postcss postcss-import @mdi/js @lit-labs/context @mdi/react @rollup/plugin-json @types/marked highlight.js marked uuid websocket-ts