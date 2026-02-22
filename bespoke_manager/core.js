const fs = require('fs');
const path = require('path');

const { LGraph, LGraphCanvas, LiteGraph } = require('../libs/litegraph.js');
const Nodes = require('../libs/nodes.js');

function registerAllNodeTypes() {
    LiteGraph.clearRegisteredTypes();
    LiteGraph.registerNodeType("Text/Text", Nodes.Text_Node);
    LiteGraph.registerNodeType("Text/Random Text", Nodes.Random_Selection_Node);
    LiteGraph.registerNodeType("Text/Prefix Text", Nodes.Prefix_Text_Node);
    LiteGraph.registerNodeType("Text/Suffix Text", Nodes.Suffix_Text_Node);
    LiteGraph.registerNodeType("Text/Concatenate Text", Nodes.Concatenate_Text_Node);
    LiteGraph.registerNodeType("Storage/Weaviate Store", Nodes.Weaviate_Ingest_Node);
    LiteGraph.registerNodeType("Storage/Weaviate Query", Nodes.Weaviate_Query_Node);
    LiteGraph.registerNodeType("IO/Text Input", Nodes.Text_Input_Node);
    LiteGraph.registerNodeType("IO/Text Output", Nodes.Text_Output_Node);
    LiteGraph.registerNodeType("Audio/Audio Generation", Nodes.Audio_Generation_Node);
    LiteGraph.registerNodeType("Control/Start", Nodes.Start_Node);
    LiteGraph.registerNodeType("Control/Counter", Nodes.Counter_Node);
    LiteGraph.registerNodeType("Control/Number Output", Nodes.Triggered_Number_Output_Node);
    LiteGraph.registerNodeType("Control/Text Output", Nodes.Triggered_Text_Output_Node);
    LiteGraph.registerNodeType("Math/Add", Nodes.Add_Node);
    LiteGraph.registerNodeType("Text/Random Number", Nodes.Random_Number_Node);
    LiteGraph.registerNodeType("Control/Gate", Nodes.Gate);
    LiteGraph.registerNodeType("API/JSON API", Nodes.JSON_API_Node);
    LiteGraph.registerNodeType("LLM/GPT", Nodes.GPT_Node);
    LiteGraph.registerNodeType("LLM/Venice API", Nodes.Venice_API_Node);
    LiteGraph.registerNodeType("Text/Password", Nodes.Password_Node);
    LiteGraph.registerNodeType("Control/Prompt Gate (GPT)", Nodes.Prompt_Gate_GPT);
    LiteGraph.registerNodeType("Storage/Simple Vector DB Read", Nodes.Simple_Vector_DB_Read_Node);
    LiteGraph.registerNodeType("Storage/Simple Vector DB Write", Nodes.Simple_Vector_DB_Write_Node);
    LiteGraph.registerNodeType("Brains/Brain", Nodes.Brain_Node);
    LiteGraph.registerNodeType("Text/Variable Forward", Nodes.Variable_Forward_Node);
    LiteGraph.registerNodeType("Text/Dictionary Assembler", Nodes.Dictionary_Assembler_Node);
    LiteGraph.registerNodeType("Control/Global Variable Get", Nodes.Global_Variable_Get_Node);
    LiteGraph.registerNodeType("Control/Global Variable Set", Nodes.Global_Variable_Set_Node);
    LiteGraph.registerNodeType("Text/Array Assembler", Nodes.Array_Assembler_Node);
    LiteGraph.registerNodeType("Text/Array Item Forward", Nodes.Array_Item_Forward_Node);
    LiteGraph.registerNodeType("Control/Array Stepper", Nodes.Array_Stepper_Node);
    LiteGraph.registerNodeType("Control/Random Dictionary Item", Nodes.Random_Dictionary_Item_Node);
    LiteGraph.registerNodeType("Control/Random Array Item", Nodes.Random_Array_Item_Node);
    LiteGraph.registerNodeType("System/Note", Nodes.Note_Node);
    LiteGraph.registerNodeType("System/Time", Nodes.Time_Node);
    LiteGraph.registerNodeType("Image/URL to Base64", Nodes.Img_URL_To_Base64_Node);
    LiteGraph.registerNodeType("LLM/Vision", Nodes.Vision_Node);
    LiteGraph.registerNodeType("Text/Keyword Extraction", Nodes.Keyword_Extraction_Node);
    LiteGraph.registerNodeType("IO/Dictionary Bus Input", Nodes.Dictionary_Bus_Input_Node);
    LiteGraph.registerNodeType("IO/Dictionary Bus Output", Nodes.Dictionary_Bus_Output_Node);
    LiteGraph.registerNodeType("IO/Dictionary Bus Get", Nodes.Dictionary_Bus_Get_Node);
    LiteGraph.registerNodeType("IO/Dictionary Bus Set", Nodes.Dictionary_Bus_Set_Node);
    LiteGraph.registerNodeType("Text/Multiline Text", Nodes.Multiline_Text_Node);
    LiteGraph.registerNodeType("LLM/OCR", Nodes.OCR_Node);
}

async function loadBrain(filepath) {
    console.log("loading brain:", filepath);
    const graphData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const graph = new LGraph();
    registerAllNodeTypes();
    let err = graph.configure(graphData);
    if (err) {
        console.log("Error configuring graph:", err);
        return null;
    }
    return graph;
}

function getBrainSchema(filepath) {
    const graphObj = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const makeUnique = (arr) => Array.from(new Set(arr));

    const textInputs = graphObj.nodes.filter(n => n.type === "IO/Text Input");
    const textOutputs = graphObj.nodes.filter(n => n.type === "IO/Text Output");
    const dictionaryBusGets = graphObj.nodes.filter(n => n.type === "IO/Dictionary Bus Get");
    const dictionaryBusSets = graphObj.nodes.filter(n => n.type === "IO/Dictionary Bus Set");

    let inputs = textInputs.map(input => ({
        name: input.title || String(input.id),
        id: input.id,
        value: ""
    }));

    let outputs = textOutputs.map(output => ({
        name: output.title || String(output.id),
        id: output.id,
        value: ""
    }));

    let input_busses = {};
    dictionaryBusGets.forEach(get => {
        const props = get.properties;
        let bus_id = (props.bus_id && props.bus_id !== "") ? props.bus_id : "unknown";
        let variable_name = (props.variable_name && props.variable_name !== "") ? props.variable_name : "unknown";
        if (!input_busses[bus_id]) input_busses[bus_id] = [];
        input_busses[bus_id].push(variable_name);
    });

    let output_busses = {};
    dictionaryBusSets.forEach(set => {
        const props = set.properties;
        let bus_id = (props.bus_id && props.bus_id !== "") ? props.bus_id : "unknown";
        let variable_name = (props.variable_name && props.variable_name !== "") ? props.variable_name : "unknown";
        if (!output_busses[bus_id]) output_busses[bus_id] = [variable_name];
        else output_busses[bus_id].push(variable_name);
    });

    Object.keys(input_busses).forEach(key => {
        input_busses[key] = makeUnique(input_busses[key]);
    });
    Object.keys(output_busses).forEach(key => {
        output_busses[key] = makeUnique(output_busses[key]);
    });

    return { inputs, outputs, input_busses, output_busses };
}

function setInputs(graph, inputData) {
    const textInputs = graph._nodes.filter(node => node.type === "IO/Text Input");
    textInputs.forEach(input => {
        const node = graph._nodes_by_id[input.id];
        if (inputData[input.title] !== undefined) {
            node.properties.text = inputData[input.title];
        } else {
            console.log("WARNING: missing input:", input.title);
        }
    });

    if (inputData.input_busses) {
        global_bus_dictionaries = inputData.input_busses;
    }
}

function readOutputs(graph) {
    const textOutputs = graph._nodes.filter(node => node.type === "IO/Text Output");
    const results = textOutputs.map(output => {
        const node = graph._nodes_by_id[output.id];
        return {
            name: output.title || String(output.id),
            id: output.id,
            value: node.properties.text
        };
    });

    let output_busses = {};
    const dictionaryBusSets = graph._nodes.filter(node => node.type === "IO/Dictionary Bus Set");
    dictionaryBusSets.forEach(set => {
        const props = set.properties;
        let bus_id = (props.bus_id && props.bus_id !== "") ? props.bus_id : "unknown";
        let variable_name = (props.variable_name && props.variable_name !== "") ? props.variable_name : "unknown";
        if (!output_busses[bus_id]) output_busses[bus_id] = [];
        output_busses[bus_id].push({ name: variable_name, value: props.variable_value });
    });

    return { results, output_busses };
}

async function runGraph(graph) {
    do {
        window.run_again = false;
        await graph.runStepAsync();
    } while (window.run_again !== undefined && window.run_again === true);
}

async function executeBrain(graph, inputData) {
    setInputs(graph, inputData);
    await runGraph(graph);
    return readOutputs(graph);
}

function discoverBrains(graphsDir) {
    if (!fs.existsSync(graphsDir)) return [];
    const files = fs.readdirSync(graphsDir).filter(f => f.endsWith('.brain'));
    return files.map(f => {
        const name = path.basename(f, '.brain');
        const filepath = path.join(graphsDir, f);
        const schema = getBrainSchema(filepath);
        return { name, filename: f, filepath, schema };
    });
}

module.exports = {
    loadBrain,
    getBrainSchema,
    executeBrain,
    setInputs,
    readOutputs,
    runGraph,
    discoverBrains,
    registerAllNodeTypes
};
