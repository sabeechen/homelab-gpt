# homelab-gpt
Web interface to chat with GPT 3.5 and 4, designed for the homelab 

Its a work in progress, not ready for usage yet.

### Run (docker CLI)
``` bash
docker run -p 80:80 -e OPEN_API_KEY=your_open_api_key_here chatgpt
```

### Run (docker-compose)
```yaml
version: '2.4'

services:
  backup-server:
    image: ghcr.io/sabeechen/homelab-gpt
    container_name: gpt
    environment:
      OPENAI_API_KEY: your_openai_api_key

```


### Build the image yourself
```bash
docker build -t chatgpt .
```

### Develop
1. Open the projects' devcontainer in VSCode.  It might take a few minutes to spin up.

2. #### Install node dependencies
   ```bash
   npm i
   ```
3. Store your OpenAI API key in ```.env``` file
   ```bash
   echo "OPENAI_API_KEY=your_api_key_goes_here``` >> .env
   ```
4. #### Build the javascript
   ```bash
   npm run build
   ```
5. Run the "Dev Server" run configuration to start the server.
6. Visit http://localhost to use the website.

Repeat steps 4 through 6 as you change code.