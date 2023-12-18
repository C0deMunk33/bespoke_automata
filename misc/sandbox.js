// load sandbox_brain.brain (json file)
let sandbox_brain = require('./sandbox_brain.json');


function orderGraphNodes(edges) {
    // Converts a node to a string for consistent handling
    const convertNode = node => String(node);

    // Adds a node to the graph
    const addNode = (graph, node) => {
        node = convertNode(node);
        if (!graph[node]) {
            graph[node] = { edges: [], indegree: 0 };
        }
    };

    // Adds an edge to the graph
    const addEdge = (graph, source, destination) => {
        source = convertNode(source);
        destination = convertNode(destination);
        addNode(graph, source);
        addNode(graph, destination);
        graph[source].edges.push(destination);
        graph[destination].indegree++;
    };

    // Create the graph from the edges
    const graph = {};
    edges.forEach(([source, destination]) => {
        addEdge(graph, source, destination);
    });

    // Identify source nodes (nodes with no incoming edges)
    const sourceNodes = Object.keys(graph).filter(node => graph[node].indegree === 0);

    // Perform a modified topological sort
    const order = [];
    const queue = [...sourceNodes]; // Start with source nodes

    while (queue.length > 0) {
        const node = queue.shift();
        order.push(node);

        graph[node].edges.forEach(neighbour => {
            graph[neighbour].indegree--;
            if (graph[neighbour].indegree === 0) {
                queue.push(neighbour);
            }
        });
    }

    // Check for remaining nodes with non-zero indegree (indicating a cycle)
    const remainingNodes = Object.keys(graph).filter(node => graph[node].indegree > 0);
    if (remainingNodes.length > 0) {
        // Append remaining nodes at the end of the order
        remainingNodes.forEach(node => order.push(node));
    }

    return order;
}

// Example usage
let edges = sandbox_brain["links"].map(link => [link[1], link[3]]);
console.log(edges)
console.log(orderGraphNodes(edges));

/** Links:
{
    id:
    origin_id:
    target_id:
}*/

/** Nodes:
{
    id:
    inputs: undefined || null || [
        {
            link: null || link_id
        }
    ]
    outputs: undefined || null || [
        {
            links: null || [link_id, link_id]
        }
    ]
}*/

// sandbox_brain["nodes"]
// sandbox_brain["links"]