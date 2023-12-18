
const fs = require('fs');



// generate_io.js <graph_json>
const args = process.argv.slice(2);
const graph = args[0];
console.log('graph: ', graph);
// parse the graph. graph.nodes is an array of nodes, find all the nodes with the type "Text/Text Input"
const graphObj = JSON.parse(fs.readFileSync(graph, 'utf8'));
console.log('graphObj: ', graphObj);
console.log('graphObj.nodes: ', graphObj.nodes);
const textInputs = graphObj.nodes.filter(node => node.type === "IO/Text Input");
console.log('textInputs: ', textInputs);
let inputs = [];

textInputs.forEach(input => {
    const props = input.properties;
    console.log("input: ", input)
    // title might be undefined, so we'll use the node id
    // for each property unroll the object and add it to the result
    inputs.push({
        name: input.title || input.id,
        id: input.id,
        value: "" 
    });
    
});


// split filename from extension, save results as filename_io.json
const filename = graph.split('.')[0];
const extension = graph.split('.')[1];
const outputFilename = filename + '_input_template.' + extension;
fs.writeFileSync(outputFilename, JSON.stringify(inputs, null, 2));