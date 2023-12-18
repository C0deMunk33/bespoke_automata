const fs = require('fs');
const { LGraph, LGraphCanvas, LiteGraph } = require('../public/libs/litegraph.js');
const nodes = require('../public/libs/nodes.js');

const PORT = 9999;

// run.js <graph_json>
const args = process.argv.slice(2);
const graph_file = args[0];

async function run() {
    
    const filename = graph_file.split('.')[0];
    const extension = graph_file.split('.')[1];
    const file_input = filename + '_input.' + extension;
    const graphData = JSON.parse(fs.readFileSync(graph_file, 'utf8'));
    const input_data = JSON.parse(fs.readFileSync(file_input, 'utf8'));
    
    // for each input, find the node with the same id and set the value
    input_data.forEach(input => {
        const node = graphData.nodes.find(node => node.id === input.id);
        if (node) {
            node.properties.text = input.value;
        }
    });

    // Create a new graph instance and configure it.
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

    //console.log(graph)
    await graph.runStepAsync();

    // get the output from all the text output nodes and return it
    const textOutputs = graphData.nodes.filter(node => node.type === "IO/Text Output");
    return textOutputs.map(output => {
        const node = graph._nodes_by_id[output.id];
        return {
            name: output.title || output.id,
            id: output.id,
            value: node.properties.text
        }
    });
}


// wait for run to finish
run().then(() => {
    console.log("done");
    process.exit(0);
})