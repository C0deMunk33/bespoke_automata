const express = require('express');
const fs = require('fs');

const { LGraph, LGraphCanvas, LiteGraph } = require('../public/libs/litegraph.js');
const nodes = require('../public/libs/nodes.js');



async function load_graph(graph_file){
    const graphData = JSON.parse(fs.readFileSync(graph_file, 'utf8'));
    const graph = new LGraph();
    LiteGraph.clearRegisteredTypes()
    LiteGraph.registerNodeType("LLM/Llama", nodes.Llama_Node );
    LiteGraph.registerNodeType("Text/Text", nodes.Text_Node );
    LiteGraph.registerNodeType("Text/Random Text", nodes.Random_Selection_Node );
    LiteGraph.registerNodeType("Templates/Persona Template", nodes.Persona_Template_Node );
    LiteGraph.registerNodeType("Templates/Prompt Template", nodes.Prompt_Template_Node );
    LiteGraph.registerNodeType("Storage/Chat Buffer", nodes.Chat_Log_Buffer_Node );
    
    LiteGraph.registerNodeType("Control/Interrupt", nodes.Interrupt_Node );
    LiteGraph.registerNodeType("Control/Prompt Gate (Llama)", nodes.Prompt_Gate_Llama );
    LiteGraph.registerNodeType("LLM/Llama Query Text", nodes.Query_Text_Node );

    LiteGraph.registerNodeType("Text/Prefix Text", nodes.Prefix_Text_Node );
    LiteGraph.registerNodeType("Text/Suffix Text", nodes.Suffix_Text_Node );
    LiteGraph.registerNodeType("Text/Concatenate Text", nodes.Concatenate_Text_Node );

    LiteGraph.registerNodeType("Storage/Weaviate Store", nodes.Weaviate_Ingest_Node );
    LiteGraph.registerNodeType("Storage/Weaviate Query", nodes.Weaviate_Query_Node );

    LiteGraph.registerNodeType("IO/Text Input", nodes.Text_Input_Node );

    LiteGraph.registerNodeType("IO/Text Output", nodes.Text_Output_Node );

    //Audio_Generation_Node
    LiteGraph.registerNodeType("Audio/Audio Generation", nodes.Audio_Generation_Node );
    //Start_Node 
    LiteGraph.registerNodeType("Control/Start", nodes.Start_Node );
    //Trigger_On_Text_Node
    LiteGraph.registerNodeType("Control/Event Emitter", nodes.Emit_Node );
    //Counter_Node
    LiteGraph.registerNodeType("Control/Counter", nodes.Counter_Node );
    //Checklist_Node
    LiteGraph.registerNodeType("Control/Checklist", nodes.Checklist_Node );
    //Random_Number_Node
    LiteGraph.registerNodeType("Text/Random Number", nodes.Random_Number_Node );
    //Llama_Node_With_Memory
    LiteGraph.registerNodeType("LLM/Llama With Memory", nodes.Llama_Node_With_Memory );
    // Gate
    LiteGraph.registerNodeType("Control/Gate", nodes.Gate );
    // JSON_API_Node
    LiteGraph.registerNodeType("API/JSON API", nodes.JSON_API_Node );
    // Shared_Chat_Buffer_Node
    LiteGraph.registerNodeType("Storage/Shared Chat Buffer", nodes.Shared_Chat_Buffer_Node );
    // Event_Text_Receiver_Node
    LiteGraph.registerNodeType("Control/Event Receiver", nodes.Event_Text_Receiver_Node );
    let e = graph.configure(graphData);
    if(e) {
        console.log("Error configuring graph: " + e);
        return;
    }
    return graph;
}

function set_inputs(graph, input_data){
    // for each input, find the node with the same name and set the value
    // input is an object where the node name is the key and the value is the value
    
    const textInputs = graph._nodes.filter(node => node.type === "IO/Text Input");
    
    textInputs.forEach(input => {
        const node = graph._nodes_by_id[input.id];
        
        console.log("node: " + node.title)
        console.log("input_data: ", input_data)

        if(node.title === input_data.name){
            node.properties.text = input_data.value;
        }
        
    });
}

function read_outputs(graph){
    // get the output from all the text output nodes and return it
    const textOutputs = graph._nodes.filter(node => node.type === "IO/Text Output");
    return textOutputs.map(output => {
        const node = graph._nodes_by_id[output.id];
        return {
            name: output.title || output.id,
            id: output.id,
            value: node.properties.text
        }
    });
}

async function run_step(graph){
    await graph.runStepAsync();
}

// TODO: save graph state to files

/*
app.get('/load_brain', async (req, res) => {
    const filename = req.query.graph;
    const input_data = JSON.parse(req.query.input);
    const result = await run(filename, input_data);
    console.log("result: ", result)
    res.send(result);
});
*/
let loaded_graphs = {};



async function load_graphs(app){
    // Load all the graphs in the graphs directory. parse the graph. graph.nodes is an array of nodes, find all the nodes with the type "IO/Text Input" and "IO/Text Output". Make an endpoint for each graph that takes the input data and returns the output data for each of the text output nodes.
    const graphs = fs.readdirSync('graphs');
    await graphs.forEach(async graph => {
        const filename = graph.split('.')[0];
        const extension = graph.split('.')[1];
        
        const graphObj = JSON.parse(fs.readFileSync('graphs/' + graph, 'utf8'));
        const textInputs = graphObj.nodes.filter(node => node.type === "IO/Text Input");
        const textOutputs = graphObj.nodes.filter(node => node.type === "IO/Text Output");
        let inputs = [];
        let outputs = [];
        textInputs.forEach(input => {
            const props = input.properties;
            inputs.push({
                name: input.title || input.id,
                id: input.id,
                value: "" 
            });
        });
        textOutputs.forEach(output => {
            const props = output.properties;
            outputs.push({
                name: output.title || output.id,
                id: output.id,
                value: "" 
            });
        });

        //console.log("loading graph: ", filename)
        
        loaded_graphs[filename] = await load_graph('graphs/' + graph);

        app.post('/brains/' + filename, async (req, res) => {
            // get json data from request
            const input_data = req.body;

            //console.log("loaded_graphs: ", loaded_graphs)
            //console.log("filename: ", filename)
            set_inputs(loaded_graphs[filename], input_data);
            await run_step(loaded_graphs[filename], input_data);
            let outputs = read_outputs(loaded_graphs[filename]);
           // console.log("outputs: ", outputs)
            res.send(outputs);
        });
        // add a schema endpoint for each graph
        app.get('/brains/' + filename + '/schema', async (req, res) => {
            res.send({
                "inputs": inputs,
                "outputs": outputs
            });
        });
        // print all the endpoints
        //console.log("endpoints: ", app._router.stack.filter(r => r.route).map(r => r.route.path));
        
        
    });
}
const app = express();
const PORT = 9999;

async function start_server(){
    app.use(express.json());
    app.use(express.static('public'));
    await load_graphs(app);
    // add list of graphs endpoint
    app.get('/brains', async (req, res) => {
        const graphs = fs.readdirSync('graphs');
        res.send(graphs);
    });

    // print all the endpoints
    console.log("endpoints: ", app._router.stack.filter(r => r.route).map(r => r.route.path));
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
    

}

start_server();
