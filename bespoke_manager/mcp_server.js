const express = require('express');
const cors = require('cors');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const { loadBrain, getBrainSchema, executeBrain, discoverBrains } = require('./core.js');

const PORT = process.env.MCP_PORT || 9999;
const GRAPHS_DIR = path.join(__dirname, '..', 'graphs');

let loadedGraphs = {};
let brainMetadata = [];

async function loadAllBrains() {
    brainMetadata = discoverBrains(GRAPHS_DIR);
    for (const brain of brainMetadata) {
        console.log(`Loading brain: ${brain.name}`);
        loadedGraphs[brain.name] = await loadBrain(brain.filepath);
    }
    console.log(`Loaded ${brainMetadata.length} brains`);
}

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

                const outputText = result.results.map(r =>
                    `${r.name}: ${r.value}`
                ).join('\n\n');

                let fullOutput = outputText;
                if (Object.keys(result.output_busses).length > 0) {
                    fullOutput += '\n\n--- Bus Outputs ---\n';
                    for (const [busId, vars] of Object.entries(result.output_busses)) {
                        for (const v of vars) {
                            fullOutput += `[${busId}] ${v.name}: ${v.value}\n`;
                        }
                    }
                }

                return {
                    content: [{ type: 'text', text: fullOutput }]
                };
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

async function startServer() {
    await loadAllBrains();

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

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

    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            brains: brainMetadata.map(b => b.name),
            sessions: Object.keys(transports).length
        });
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Bespoke Automata MCP Server running on http://localhost:${PORT}`);
        console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
        console.log(`Available brains: ${brainMetadata.map(b => b.name).join(', ')}`);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = { startServer, createMcpServer, loadAllBrains, brainMetadata, loadedGraphs };
