# Bespoke Automata

![image](https://github.com/C0deMunk33/bespoke_automata/assets/13264637/d0ec34ae-b52d-4da5-b56e-049d0388a7a1)

<details>

<summary>Bespoke Automata, An Introduction</summary>

## About Bespoke Automata
Create and deploy sophisticated Agent AI's to a single API with Bespoke Automata. With Bespoke Automata, you can combine large language models running locally or remotely with instruments for database IO, dictionaries, arrays, logic, APIs and more into powerful Brains capable of pursuing goals set by their designers.

With Bespoke Automata, you can design and test brains via a Directed Graph GUI (powered by litegraph), and deploy them behind a single user friendly API, each brain a different endpoint. Brains are exposed as [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) tools, making them accessible to any MCP-compatible AI assistant.
</details>

#### Demo Video
[![Demo Video](https://img.youtube.com/vi/w_saaTFEuSM/0.jpg)](https://www.youtube.com/watch?v=w_saaTFEuSM)

## Installation

### Requirements
* Node.js (v18+)
* NPM
* Python (for the optional LLM API)
  * flask
  * sentence_transformers

### Quick Start

Clone the repository and install dependencies:
```
$ git clone https://github.com/C0deMunk33/bespoke_automata
$ cd bespoke_automata
$ npm install
$ npm start
```

Open your browser to `http://localhost:9999`. The app has three tabs:

* **Editor** — visual node graph editor (powered by LiteGraph) for designing brains
* **Manager** — view deployed brains, their schemas, and MCP connection info
* **Runner** — execute brains with custom inputs and see outputs

Brains are saved to the `graphs/` directory. Saving in the editor makes them immediately available to the MCP server and runner.

### MCP Integration

The server exposes an MCP SSE endpoint at `http://localhost:9999/sse`. Each brain in `graphs/` is registered as an MCP tool. Connect any MCP-compatible client (Cursor, Claude Desktop, etc.) to this endpoint to use your brains as AI tools.

### Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `9999` | Server port |

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Web UI |
| `/sse` | GET | MCP SSE connection |
| `/messages` | POST | MCP message handler |
| `/api/graphs` | GET | List saved graph names |
| `/api/graphs/:name` | GET | Load a graph |
| `/api/graphs/:name` | PUT | Save a graph |
| `/api/graphs/:name` | DELETE | Delete a graph |
| `/api/brains` | GET | List deployed brains with schemas |
| `/api/brains/reload` | POST | Reload brains from disk |
| `/api/brains/:name/run` | POST | Execute a brain |
| `/api/status` | GET | Server status |
| `/health` | GET | Health check |

### Standalone MCP Server

To run only the MCP server without the web UI:
```
$ npm run mcp
```

### BA API (Optional LLM Backend)

The BA API uses [llama-cpp-python](https://github.com/abetlen/llama-cpp-python) for local text inference and vision.

* Place text models in `../models/text`
* Place vision models in `../models/vision`
* **NOTE:** Model directories are at the same level as this repo. GGUF format works best — get them from Hugging Face.

Installation by platform:
* **Metal (macOS)**: `CMAKE_ARGS="-DLLAMA_METAL=on" pip install llama-cpp-python`
* **CUDA (Linux)**: `CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python`
* **CUDA (Windows)**: `$env:CMAKE_ARGS = "-DLLAMA_CUBLAS=on"` then `pip install llama-cpp-python`
* **CPU**: `pip install llama-cpp-python`

Then run:
```
$ cd APIs/
$ python omni_api.py
```
The API server will be at `your_ip:5000`.

**NOTE:** On macOS, port 5000 collides with Airplay Receiver. Turn it off in Settings > General > Airdrop & Handoff, or change the port in the config.

### Project Structure

```
bespoke_automata/
├── server.js                 # Unified Express server
├── package.json              # Dependencies
├── graphs/                   # Brain files (.brain)
├── libs/                     # LiteGraph, nodes, and supporting libraries
├── public/                   # Web UI (SPA)
│   └── index.html
├── bespoke_manager/
│   ├── core.js               # Brain execution engine
│   ├── mcp_server.js         # Standalone MCP server
│   ├── run.js                # CLI brain runner
│   └── front_ends/           # Discord bot integrations
├── APIs/                     # Python LLM API servers
└── README.md
```

### More Info
* Demo Brains: `./graphs/`
* Example: https://youtu.be/w_saaTFEuSM
* Issues: Create an issue here or ping me at: https://twitter.com/icodeagents
* Contact: https://twitter.com/icodeagents
* Discord: [https://discord.gg/Rr5Ac5GFeY](https://discord.gg/Rr5Ac5GFeY)

## THANKS AND GOOD LUCK!!
