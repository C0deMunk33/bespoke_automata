const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const { loadBrain, getBrainSchema, executeBrain, discoverBrains } = require('./bespoke_manager/core.js');

const PORT = process.env.PORT || 9999;
const GRAPHS_DIR = path.join(__dirname, 'graphs');

if (!fs.existsSync(GRAPHS_DIR)) {
    fs.mkdirSync(GRAPHS_DIR, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, GRAPHS_DIR),
        filename: (_req, file, cb) => cb(null, file.originalname)
    }),
    fileFilter: (_req, file, cb) => {
        cb(null, file.originalname.endsWith('.brain'));
    }
});

// --- Brain state ---

let loadedGraphs = {};
let brainMetadata = [];

async function loadAllBrains() {
    brainMetadata = discoverBrains(GRAPHS_DIR);
    loadedGraphs = {};
    for (const brain of brainMetadata) {
        console.log(`Loading brain: ${brain.name}`);
        loadedGraphs[brain.name] = await loadBrain(brain.filepath);
    }
    console.log(`Loaded ${brainMetadata.length} brains`);
}

// --- MCP tool helpers ---

function buildToolInputSchema(schema) {
    const shape = {};
    for (const input of schema.inputs) {
        shape[input.name] = z.string().describe(`Text input: ${input.name}`);
    }
    for (const [busId, varNames] of Object.entries(schema.input_busses)) {
        for (const varName of varNames) {
            const key = `bus__${busId}__${varName}`;
            shape[key] = z.string().optional().describe(`Bus "${busId}" variable: ${varName}`);
        }
    }
    return shape;
}

function buildToolDescription(brain) {
    const inputNames = brain.schema.inputs.map(i => i.name).join(', ');
    const outputNames = brain.schema.outputs.map(o => o.name).join(', ');
    let desc = `Brain: ${brain.name}`;
    if (inputNames) desc += ` | Inputs: ${inputNames}`;
    if (outputNames) desc += ` | Outputs: ${outputNames}`;
    const busInputKeys = Object.keys(brain.schema.input_busses);
    if (busInputKeys.length > 0) {
        const busDesc = busInputKeys.map(bid =>
            `${bid}(${brain.schema.input_busses[bid].join(', ')})`
        ).join('; ');
        desc += ` | Bus inputs: ${busDesc}`;
    }
    return desc;
}

function parseToolArgs(args, schema) {
    const inputData = {};
    for (const input of schema.inputs) {
        if (args[input.name] !== undefined) {
            inputData[input.name] = args[input.name];
        }
    }
    const input_busses = {};
    for (const [busId, varNames] of Object.entries(schema.input_busses)) {
        input_busses[busId] = {};
        for (const varName of varNames) {
            const key = `bus__${busId}__${varName}`;
            if (args[key] !== undefined) {
                input_busses[busId][varName] = args[key];
            }
        }
    }
    if (Object.keys(input_busses).length > 0) {
        inputData.input_busses = input_busses;
    }
    return inputData;
}

function createMcpServer() {
    const server = new McpServer({
        name: 'bespoke-automata',
        version: '2.0.0'
    }, {
        capabilities: { tools: {} }
    });

    for (const brain of brainMetadata) {
        const inputSchema = buildToolInputSchema(brain.schema);
        const description = buildToolDescription(brain);
        const brainName = brain.name;

        server.tool(brainName, description, inputSchema, async (args) => {
            const graph = loadedGraphs[brainName];
            if (!graph) {
                return {
                    content: [{ type: 'text', text: `Error: Brain "${brainName}" not loaded` }],
                    isError: true
                };
            }
            try {
                const inputData = parseToolArgs(args, brain.schema);
                const result = await executeBrain(graph, inputData);
                const outputText = result.results.map(r => `${r.name}: ${r.value}`).join('\n\n');
                let fullOutput = outputText;
                if (Object.keys(result.output_busses).length > 0) {
                    fullOutput += '\n\n--- Bus Outputs ---\n';
                    for (const [busId, vars] of Object.entries(result.output_busses)) {
                        for (const v of vars) {
                            fullOutput += `[${busId}] ${v.name}: ${v.value}\n`;
                        }
                    }
                }
                return { content: [{ type: 'text', text: fullOutput }] };
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error executing brain: ${err.message}` }],
                    isError: true
                };
            }
        });
    }
    return server;
}

// --- Start server ---

async function startServer() {
    await loadAllBrains();

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Static serving
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/libs', express.static(path.join(__dirname, 'libs')));

    // --- MCP SSE endpoints ---

    const transports = {};

    app.get('/sse', async (req, res) => {
        console.log('New SSE connection');
        const server = createMcpServer();
        const transport = new SSEServerTransport('/messages', res);
        transports[transport.sessionId] = { transport, server };
        transport.onclose = () => {
            console.log(`SSE session closed: ${transport.sessionId}`);
            delete transports[transport.sessionId];
        };
        await server.connect(transport);
        console.log(`SSE session started: ${transport.sessionId}`);
    });

    app.post('/messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const session = transports[sessionId];
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await session.transport.handlePostMessage(req, res, req.body);
    });

    // --- Graph CRUD API (editor) ---

    app.get('/api/graphs', (_req, res) => {
        const files = fs.readdirSync(GRAPHS_DIR).filter(f => f.endsWith('.brain'));
        const names = files.map(f => path.basename(f, '.brain'));
        res.json(names);
    });

    app.get('/api/graphs/:name', (req, res) => {
        const filepath = path.join(GRAPHS_DIR, req.params.name + '.brain');
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Graph not found' });
        }
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        res.json(data);
    });

    app.put('/api/graphs/:name', (req, res) => {
        const filepath = path.join(GRAPHS_DIR, req.params.name + '.brain');
        fs.writeFileSync(filepath, JSON.stringify(req.body, null, 2));
        res.json({ saved: true, name: req.params.name });
    });

    app.delete('/api/graphs/:name', (req, res) => {
        const filepath = path.join(GRAPHS_DIR, req.params.name + '.brain');
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            res.json({ removed: true });
        } else {
            res.status(404).json({ removed: false, error: 'Graph not found' });
        }
    });

    app.post('/api/graphs/upload', upload.array('files'), (req, res) => {
        const added = (req.files || []).map(f => f.originalname);
        res.json({ added });
    });

    // --- Brain management API ---

    app.get('/api/brains', (_req, res) => {
        res.json(brainMetadata.map(b => ({
            name: b.name,
            filename: b.filename,
            schema: b.schema
        })));
    });

    app.post('/api/brains/reload', async (_req, res) => {
        await loadAllBrains();
        res.json({ reloaded: true, count: brainMetadata.length });
    });

    app.delete('/api/brains/:name', async (req, res) => {
        const filepath = path.join(GRAPHS_DIR, req.params.name + '.brain');
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            await loadAllBrains();
            res.json({ removed: true });
        } else {
            res.status(404).json({ removed: false, error: 'Brain not found' });
        }
    });

    // --- Brain execution API ---

    app.post('/api/brains/:name/run', async (req, res) => {
        const brain = brainMetadata.find(b => b.name === req.params.name);
        if (!brain) {
            return res.status(404).json({ error: `Brain "${req.params.name}" not found` });
        }
        const graph = loadedGraphs[brain.name];
        if (!graph) {
            return res.status(500).json({ error: `Brain "${brain.name}" not loaded` });
        }
        try {
            const result = await executeBrain(graph, req.body);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: 'Execution failed', details: err.message });
        }
    });

    // --- Status / health ---

    app.get('/api/status', (_req, res) => {
        res.json({
            running: true,
            port: PORT,
            sseEndpoint: `http://localhost:${PORT}/sse`,
            brains: brainMetadata.length,
            sessions: Object.keys(transports).length
        });
    });

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            brains: brainMetadata.map(b => b.name),
            sessions: Object.keys(transports).length
        });
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Bespoke Automata running on http://localhost:${PORT}`);
        console.log(`MCP SSE endpoint: http://localhost:${PORT}/sse`);
        console.log(`Available brains: ${brainMetadata.map(b => b.name).join(', ') || '(none)'}`);
    });
}

startServer();
