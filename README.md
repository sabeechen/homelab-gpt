# homelab-gpt
Web interface to chat with GPT 3.5 and 4, designed for the homelab 

Its a work in progress, not ready for usage yet.

### Build
```bash
docker build -t chatgpt .
```

### Run
``` bash
docker run -p 80:80 -e OPEN_API_KEY=your_open_api_key_here chatgpt
```

### Develop
- Open the projects' devcontainer in VSCode.  It might take a few minutes to spin up.
- #### Build the javascript
  ```bash
  npm run build
  ```
- Enter your OpenAI API key in ```.vscode/launch.json```
- Run the "Dev Server" run configuration to start the server.
- Visit http://localhsot to use the website.
