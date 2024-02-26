/*****************************************************************************************/
/*****************************************************************************************/
/***************************************NODES********************************************/
/*****************************************************************************************/
	
	if(typeof module !== 'undefined') {
		const Weaviate = require("./weaviate.js");
		LiteGraph = require("./litegraph.js");
		// dummy window object
		window = {};
		
	}	
	// global bus dictionary
	global_bus_dictionaries = {};

	const gpt_endpoint = '/v1/chat/completions';
	const gpt_url = 'https://api.openai.com'
	const default_gpt_model = "gpt-3.5-turbo";
	
	call_gpt = async function(messages, api_key, url=gpt_url, model=default_gpt_model, grammar=undefined) { 
		try {
			const headers = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${api_key}`
			};

			
			const data = {
				model: model,
				messages: messages,
				max_tokens: 9999,
				stream: false, 
				grammar: (grammar === undefined || grammar === "") ? undefined : grammar
			};
			final_url = url + gpt_endpoint;


			console.log("final url: " + final_url)
			const response = await fetch(final_url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(data)
			});

			const responseData = await response.json();
			console.log("llm response: " + JSON.stringify(responseData.chat.choices[0].message.content))
			return responseData.chat.choices[0].message.content;
		} catch (error) {
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log(error);
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")
			console.log("~~~~~~~~~~~~~~~~~~~~~~~")

			return "error";
		}

	}

	query_wikipedia = async function(query, milvus_url, top_k=3) {
		const headers = {
			'Content-Type': 'application/json'
		  };

		  const data = {
			"query": query,
			"top_k": top_k
		  };
		
		  const response = await fetch(milvus_url + "/wiki", {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		  });
		
		  const responseData = await response.json();
		  return responseData;
	}

	query_milvus = async function(class_key, query, milvus_url, top_k=3) {
		const headers = {
			'Content-Type': 'application/json'
		  };

		  const data = {
			"query": query,
			"collection_name": class_key,
			"top_k": top_k
		  };
		
		  const response = await fetch(milvus_url + "/query_collection", {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		  });
		
		  const responseData = await response.json();
		  return responseData;
	}

	create_milvus_collection = async function(class_key, milvus_url) {
		if(class_key === "" || class_key === "wiki") {
			return;
		}
		const headers = {
			'Content-Type': 'application/json'
		  };

		  const data = {
			"collection_name": class_key,
			"dimension": 768
		  };
		
		  const response = await fetch(milvus_url + "/create_collection", {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		  });
		
		  const responseData = await response.json();
		  return responseData;
	}

	insert_milvus = async function(class_key, text, milvus_url) {
		const headers = {
			'Content-Type': 'application/json'
		  };

		  const data = {
			"collection_name": class_key,
			"vectors": [text]
		  };
		
		  const response = await fetch(milvus_url + "/insert", {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		  });
		
		  const responseData = await response.json();
		  return responseData;
	}

	delete_milvus_collection = async function(class_key, milvus_url) {
		if (class_key === "" || class_key === "wiki") {
			return;
		}

		const headers = {
			'Content-Type': 'application/json'

		};

		const data = {
			"collection_name": class_key
		};

		const response = await fetch(milvus_url + "/drop_collection", {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		});

		const responseData = await response.json();
		return responseData;
	}

	class EventEmitter {
		constructor() {
			this.events = {};
		}
		
		// Register a listener for the given event.
		on(event, listener, sender) {
			if (!this.events[event]) {
				this.events[event] = [];
			}
			
			// Check if the listener is already registered for the event and sender
			const isListenerRegistered = this.events[event].some(
				l => l.listener === listener && l.sender === sender
			);
			
			if(isListenerRegistered) {
				// Listener is already registered, return without error
				return;
			}
			
			// If not already registered, add the listener
			this.events[event].push({listener, sender});
		}
		
		// Remove all listeners for the given sender.
		offSender(sender) {
			for (let event in this.events) {
				this.events[event] = this.events[event].filter(l => l.sender !== sender);
			}
		}
		
		// Emit the event, calling all listeners registered for this event.
		emit(event, ...args) {
			if (!this.events[event]) return;
			this.events[event].forEach(({listener}) => listener.apply(this, args));
		}
	}

	let llm_server = "http://192.168.0.7:5001"

	let totalAudioQueue = []; // A queue to hold audio blobs
	let audioQueue = []; // A queue to hold audio blobs
	let isPlaying = false; // A flag to check if an audio is currently playing
	let isPolling = false; // A flag to check if a polling request is in progress
	let eventEmitter = new EventEmitter(); // An event emitter to emit events
	function playAudio() {
		// If there's no audio playing and there are audios in the queue
		if (!isPlaying && audioQueue.length > 0) {
			isPlaying = true; // Set the flag to true indicating an audio is playing
			const audioBlob = audioQueue.shift(); // Get the first audio blob from the queue
			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);
			
			audio.onended = function() {
				isPlaying = false; // Reset the flag when audio ends
				playAudio(); // Try to play the next audio in the queue
			};
			
			audio.play();
		}
	}
	function containsWords(words, text) {
		function escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
		}
		
		const sanitizedWords = words.map(escapeRegExp);
		const regex = new RegExp('\\b(' + sanitizedWords.join('|') + ')\\b', 'i'); // 'i' for case insensitive match
		
		return regex.test(text);
	}
	function startPolling(requestId) {
		if (isPolling) return; // If a polling request is in progress, exit
	
		isPolling = true; // Set the flag to true indicating a polling request is in progress
	
		fetch(`http://192.168.0.7:2702/get-audio/${requestId}`)
		.then(response => {
			if (response.ok && response.headers.get('Content-Type') === 'audio/wav') {
				return response.blob();
			}
			return null;
		})
		.then(audioBlob => {
			if (audioBlob) {
				audioQueue.push(audioBlob); // Add the audio blob to the queue
				totalAudioQueue.push(audioBlob);
				playAudio(); // Try to play the audio
			}
		})
		.finally(() => {
			isPolling = false; // Reset the flag when the polling request completes
			setTimeout(() => startPolling(requestId), 1000); // Schedule the next polling request after 5 seconds
		});
	}
	
	function startAudioGeneration(text) {
		fetch('http://192.168.0.7:2702/text-to-wav', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ text: text })
		})
		.then(response => response.json())
		.then(data => {
			const requestId = data.request_id;
			startPolling(requestId); // Start polling for audio data
		});
	}

	function concatenateAudioChunks(chunks) {
		// Calculate the total length of all chunks
		let totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
		
		// Create a new Float32Array with the total length
		let result = new Float32Array(totalLength);
		
		// Fill the result array with data from each chunk
		let offset = 0;
		for (let chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		
		return result;
	}
	
	async function saveTotalAudio() {
		let combinedAudioData = [];
		let headerLength = 44;  // Standard WAV header length
	
		for (let i = 0; i < totalAudioQueue.length; i++) {
			let arrayBuffer = await totalAudioQueue[i].arrayBuffer();
			let dataView = new DataView(arrayBuffer);
	
			if (i === 0) {
				// For the first blob, keep the whole content
				combinedAudioData.push(new Uint8Array(arrayBuffer));
			} else {
				// For all subsequent blobs, skip the header
				combinedAudioData.push(new Uint8Array(arrayBuffer, headerLength));
			}
		}
	
		let combinedBuffer = concatenateUint8Arrays(combinedAudioData);
	
		// Adjust WAV header to reflect new length
		updateWavHeader(combinedBuffer);
	
		let blob = new Blob([combinedBuffer], {type: 'audio/wav'});
		
		let url = window.URL.createObjectURL(blob);
		let a = document.createElement('a');
		a.href = url;
		a.download = 'audio.wav';
		document.body.appendChild(a);
		a.click();
		a.remove();
		window.URL.revokeObjectURL(url);
	}
	
	function concatenateUint8Arrays(arrayList) {
		let totalLength = arrayList.reduce((acc, array) => acc + array.length, 0);
		let result = new Uint8Array(totalLength);
		let offset = 0;
	
		for (let array of arrayList) {
			result.set(array, offset);
			offset += array.length;
		}
	
		return result;
	}
	
	function updateWavHeader(buffer) {
		let dataView = new DataView(buffer.buffer);
		let fileSize = buffer.length;
		
		// Update RIFF chunk size
		dataView.setUint32(4, fileSize - 8, true);
	
		// Update data chunk size
		let dataLength = fileSize - 44;
		dataView.setUint32(40, dataLength, true);
	}
	
	async function create_simple_vector_db_collection(collection_name, url) {
		console.log("creating collection: " + collection_name)
		let insert_response = await fetch(url + "/create_collection", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name, dimension: 768 })
		});
	}

	async function insert_simple_vector_db(collection_name, title, text, url) {
		console.log("inserting into simple vector db: " + text)
		let insert_response = await fetch(url + "/add_document", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ 
				collection_name: collection_name, 
				title: title,
				text: text 
			})
		});
	}
	// delete a collection from simple vector db
	async function delete_simple_vector_db_collection(collection_name, url) {
		let insert_response = await fetch(url + "/delete_collection", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name })
		});
	}

	// delete a document from simple vector db
	async function delete_simple_vector_db_document(collection_name, document_id, url) {
		let insert_response = await fetch(url + "/delete_document", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name, document_id: document_id })
		});

	}
	//get_document_by_id
	async function get_document_by_id(collection_name, document_id, url) {
		let insert_response = await fetch(url + "/get_document_by_id", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name, document_id: document_id })
		});
		return insert_response.json();
	}
	//get_document_by_title
	async function get_document_by_title(collection_name, title, url) {
		let insert_response = await fetch(url + "/get_document_by_title", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name, title: title })
		});
		return insert_response.json();
	}
	//get_similar_documents_by_cos
	async function get_similar_documents_by_cos(collection_name, document_id, top_k, url) {
		let insert_response = await fetch(url + "/get_similar_documents_by_cos", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name, document_id: document_id, top_k: top_k })
		});
		return insert_response.json();
	}

	//get_similar_documents_by_euclidean
	async function get_similar_documents_by_euclidean(collection_name, query, top_n, url) {
		let query_response = await fetch(url + "/get_similar_documents_by_euclidean", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ 
				collection_name: collection_name, 
				text: query,
				top_n: top_n
			 })
		});
		let response_json = await query_response.json();

		return response_json;
	}

	//collection_exists
	async function collection_exists(collection_name, url) {
		console.log("checking if collection exists " + collection_name)
		let exists_response = await fetch(url + "/collection_exists", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ collection_name: collection_name })
		});
		
		let response_json = await exists_response.json()
		return response_json;
	}



	/////////////////////NODES START HERE/////////////////////////

	// Time Node
	function Time_Node(){
		this.addOutput("out", "number");
	}
	Time_Node.title = "Time";
	Time_Node.prototype.onExecute = function() {
		this.setOutputData(0, Date.now());
	}

	// Random Dictionary Item Node
	function Random_Dictionary_Item_Node(){
		// takes in dictionary and outputs a random item from it
		this.addInput("in dict", "string");
		this.addOutput("out item", "string");
		this.properties = {
			dictionary: {}
		};
		this.dictionary_widget = this.addWidget("text","Dictionary",JSON.stringify(this.properties.dictionary),"dictionary");
	}
	Random_Dictionary_Item_Node.title = "Random Dictionary Item";
	Random_Dictionary_Item_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.dictionary = JSON.parse(this.getInputData(0));
			this.dictionary_widget.value = JSON.stringify(this.properties.dictionary);
		} else if (this.dictionary_widget.value !== JSON.stringify(this.properties.dictionary)) {
			this.properties.dictionary = JSON.parse(this.dictionary_widget.value);
		}

		let keys = Object.keys(this.properties.dictionary);
		let random_key = keys[Math.floor(Math.random() * keys.length)];
		this.setOutputData(0, this.properties.dictionary[random_key]);
	}
		
	// random array item node
	function Random_Array_Item_Node(){
		// takes in array and outputs a random item from it
		this.addInput("in array", "string");
		this.addOutput("out item", "string");
		this.properties = {
			array: []
		};
		this.array_widget = this.addWidget("text","Array",JSON.stringify(this.properties.array),"array");
	}
	Random_Array_Item_Node.title = "Random Array Item";
	Random_Array_Item_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.array = JSON.parse(this.getInputData(0));
			this.array_widget.value = JSON.stringify(this.properties.array);
		} else if (this.array_widget.value !== JSON.stringify(this.properties.array)) {
			this.properties.array = JSON.parse(this.array_widget.value);
		}

		let random_index = Math.floor(Math.random() * this.properties.array.length);
		this.setOutputData(0, this.properties.array[random_index]);
	}

	// Note_Node
	function Note_Node(){
		this.properties = { value: "" };
		this.text_widget = this.addWidget("text", "", this.properties.value, "value", {
			multiline: true, 
			lines: 6
		});
		
	}
	Note_Node.title = "~~~Note~~~";
	// faint yellow like sticky notes
	Note_Node.title_color = "#FF0";
	Note_Node.title_text_color = "#F03";
	Note_Node.bg_color = "#FFF";
	Note_Node.prototype.onExecute = function() {
		this.properties.value = this.text_widget.value;
	}

	
	function Brain_Node(){
		this.addInput("input dict", "string");
		this.addInput("url", "string");
		this.addInput("brain_name", "string");
		this.addOutput("output dict", "string");
		this.properties = {
			local: false,
			url: "",
			brain_name: "",
			input_variables: {},
			output_variables: {}
		};
		// local selection widget
		this.local_widget = this.addWidget("toggle","Local",this.properties.local,"local");
		// brain name widget
		this.brain_name_widget = this.addWidget("text","Brain Name",this.properties.brain_name,"brain_name");
		this.call_brain = async function(brain, input_variables) { 
			let final_url = this.properties.url + "/brains/" + this.properties.brain_name;
			console.log("calling brain: " + this.properties.brain_name)
			console.log("final url: " + final_url)
			const headers = {
				'Content-Type': 'application/json'
			};
			const data =  this.properties.input_variables;
			const response = await fetch(final_url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(data)
			});

			const responseData = await response.json();
			return responseData;
		}
	}
	Brain_Node.title = "Brain";
	Brain_Node.prototype.onExecute = async function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.input_variables = JSON.parse(this.getInputData(0));
		}

		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.url = this.getInputData(1);
		}

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.brain_name = this.getInputData(2);
			this.brain_name_widget.value = this.getInputData(2);
		}

		if(this.properties.local) {
			// TODO
			// load brain from local file
			let brain = await load_brain(this.properties.brain_name);
			// run brain
			let output = await run_brain(brain, this.properties.input_variables);
			
			// set output
			this.setOutputData(0, JSON.stringify(output));
		} else {
			// call brain api
			console.log("calling brain")

			let output = await this.call_brain();
			console.log(output)
			// output is an array of dictionaries with "name" and "value" fields
			// map output to dictionary where name is key and value is value
			let output_dict = {};
			for(let i = 0; i < output.length; i++) {
				output_dict[output[i].name] = output[i].value;
			}

			// set output
			this.setOutputData(0, JSON.stringify(output_dict));
		}

	}

	// variable forward node
	// takes a json dictionary and extracts a variable from it
	// properties:
	// variable_name: name of variable to forward
	// inputs:
	// json dictionary to extract variable from
	// variable name: name of variable to extract
	// outputs:
	// variable value: value of variable extracted
	function Variable_Forward_Node(){
		this.addInput("in dict", "string");
		this.addInput("var name", "string");
		this.addOutput("var value", "string");
		this.properties = { 
			variable_name: ""
		};
		this.text_widget = this.addWidget("text","Variable Name",this.properties.variable_name,"variable_name");
	}
	Variable_Forward_Node.title = "Variable Forward";
	Variable_Forward_Node.prototype.onExecute = function() {
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.variable_name = this.getInputData(1);
			this.text_widget.value = this.getInputData(1);
		} else if (this.text_widget.value !== this.properties.variable_name) {
			this.properties.variable_name = this.text_widget.value;
		}

		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			let input_dict = JSON.parse(this.getInputData(0));
			this.setOutputData(0, input_dict[this.properties.variable_name]);
		}
	}

	// dictionary assembler node
	// takes a json dictionary and adds a variable to it
	// properties:
	// variable_name: name of variable to add
	// variable_value: value of variable to add
	// inputs:
	// json dictionary to add variable to
	// new variable name: name of variable to add
	// new variable value: value of variable to add
	// outputs:
	// json dictionary with new variable added
	function Dictionary_Assembler_Node(){
		this.addInput("in dict", "string");
		this.addInput("var name", "string");
		this.addInput("var value", "string");
		this.addOutput("out dict", "string");
		this.properties = { 
			variable_name: "",
			variable_value: ""
		};
		this.text_widget = this.addWidget("text","Variable Name",this.properties.variable_name,"variable_name");
	}
	Dictionary_Assembler_Node.title = "Dictionary Assembler";
	Dictionary_Assembler_Node.prototype.onExecute = function() {
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.variable_name = this.getInputData(1);
			this.text_widget.value = this.getInputData(1);
		}

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.variable_value = this.getInputData(2);
		}

		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			let input_dict = JSON.parse(this.getInputData(0));
			input_dict[this.properties.variable_name] = this.properties.variable_value;
			this.setOutputData(0, JSON.stringify(input_dict));
		} else {
			let input_dict = {};
			input_dict[this.properties.variable_name] = this.properties.variable_value;
			this.setOutputData(0, JSON.stringify(input_dict));
		}
	}



	function set_global_bus_dictionary(bus_id, input_dict) {
		global_bus_dictionaries[bus_id] = input_dict;
	}

	// Dictionary_Bus_Input_Node
	function Dictionary_Bus_Input_Node(){
		this.addInput("bus id", "string");
		this.addOutput("out dict", "string");
		this.properties = {
			bus_id: ""
		};
		this.text_widget = this.addWidget("text","Bus ID",this.properties.bus_id,"bus_id");
	}
	Dictionary_Bus_Input_Node.title = "Dictionary Bus Input";
	// green theme
	Dictionary_Bus_Input_Node.title_color = "#232"
	Dictionary_Bus_Input_Node.fg_color = "#FFF"
	Dictionary_Bus_Input_Node.bg_color = "#353"
	// end green theme
	Dictionary_Bus_Input_Node.prototype.set_bus_data = function(bus_id, input_dict) {
		set_global_bus_dictionary(bus_id, input_dict);
	}

	Dictionary_Bus_Input_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.bus_id = this.getInputData(0);
			this.text_widget.value = this.getInputData(0);
		} else if (this.text_widget.value !== this.properties.bus_id) {
			this.properties.bus_id = this.text_widget.value;
		}

		this.setOutputData(0, JSON.stringify(global_bus_dictionaries[this.properties.bus_id]));
	}

	// Dictionary_Bus_Output_Node saves incoming dictionary to global bus
	function Dictionary_Bus_Output_Node(){
		this.addInput("in dict", "string");
		this.addInput("bus id", "string");
		this.properties = {
			bus_id: ""
		};
		this.text_widget = this.addWidget("text","Bus ID",this.properties.bus_id,"bus_id");
	}
	Dictionary_Bus_Output_Node.title = "Dictionary Bus Output";
	// red theme
	Dictionary_Bus_Output_Node.title_color = "#322"
	Dictionary_Bus_Output_Node.fg_color = "#FFF"
	Dictionary_Bus_Output_Node.bg_color = "#533"
	// end red theme
	Dictionary_Bus_Output_Node.prototype.onExecute = function() {
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.bus_id = this.getInputData(1);
			this.text_widget.value = this.getInputData(1);
		} else if (this.text_widget.value !== this.properties.bus_id) {
			this.properties.bus_id = this.text_widget.value;
		}

		set_global_bus_dictionary(this.properties.bus_id, JSON.parse(this.getInputData(0)));
	}

	// Dictionary_Bus_Get_Node
	function Dictionary_Bus_Get_Node(){
		this.addInput("bus id", "string");
		this.addInput("var name", "string");
		this.addOutput("text out", "string");
		this.properties = {
			bus_id: "",
			variable_name: ""
		};
		this.text_widget = this.addWidget("text","Bus ID",this.properties.bus_id,"bus_id");
		this.variable_widget = this.addWidget("text","Variable Name",this.properties.variable_name,"variable_name");
	}
	Dictionary_Bus_Get_Node.title = "Dictionary Bus Get";
	// green theme
	Dictionary_Bus_Get_Node.title_color = "#232"
	Dictionary_Bus_Get_Node.fg_color = "#FFF"
	Dictionary_Bus_Get_Node.bg_color = "#353"
	// end green theme
	Dictionary_Bus_Get_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			console.log("setting bus_id to: " + this.getInputData(0))
			this.properties.bus_id = this.getInputData(0);
			this.text_widget.value = this.getInputData(0);
		} else {
			console.log("setting bus_id to: " + this.text_widget.value)
			this.properties.bus_id = this.text_widget.value;
		}

		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.variable_name = this.getInputData(1);
			this.variable_widget.value = this.getInputData(1);
		} else if (this.variable_widget.value !== this.properties.variable_name) {
			this.properties.variable_name = this.variable_widget.value;
		}

		console.log("bus_id: " + this.properties.bus_id)
		let bus_dict = global_bus_dictionaries[this.properties.bus_id];
		console.log("bus_dict: " + bus_dict)
		// add dicts
		console.log("dicts: " + JSON.stringify(global_bus_dictionaries))
		this.setOutputData(0, bus_dict[this.properties.variable_name]);
	}

	// Dictionary_Bus_Set_Node
	function Dictionary_Bus_Set_Node(){
		this.addInput("bus id", "string");
		this.addInput("var name", "string");
		this.addInput("var value", "string");
		this.properties = {
			bus_id: "",
			variable_name: "",
			variable_value: ""
		};
		this.text_widget = this.addWidget("text","Bus ID",this.properties.bus_id,"bus_id");
		this.variable_widget = this.addWidget("text","Variable Name",this.properties.variable_name,"variable_name");
	}
	Dictionary_Bus_Set_Node.title = "Dictionary Bus Set";

	// red theme
	Dictionary_Bus_Set_Node.title_color = "#322"
	Dictionary_Bus_Set_Node.fg_color = "#FFF"
	Dictionary_Bus_Set_Node.bg_color = "#533"
	// end red theme
	Dictionary_Bus_Set_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.bus_id = this.getInputData(0);
			this.text_widget.value = this.getInputData(0);
		} else if (this.text_widget.value !== this.properties.bus_id) {
			this.properties.bus_id = this.text_widget.value;
		}

		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.variable_name = this.getInputData(1);
			this.variable_widget.value = this.getInputData(1);
		} else if (this.variable_widget.value !== this.properties.variable_name) {
			this.properties.variable_name = this.variable_widget.value;
		}

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.variable_value = this.getInputData(2);
		}

		let bus_dict = global_bus_dictionaries[this.properties.bus_id];
		bus_dict[this.properties.variable_name] = this.properties.variable_value;
	}

	// Function_Call_Node
	// script execution node




	function Array_Assembler_Node(){
		this.addInput("in array", "string");
		this.addInput("var value", "string");
		this.addInput("buffer length", "string");
		this.addOutput("out array", "string");
		this.properties = {
			variable_value: "",
			array: [],
			buffer_length: 10
		};
		// buffer length widget
		this.buffer_length_widget = this.addWidget("number","Buffer Length",this.properties.buffer_length,"buffer_length", {precision:0, step:10});
	}
	Array_Assembler_Node.title = "Array Assembler";
	Array_Assembler_Node.prototype.onExecute = function() {
		if(this.getInputData(1) !== undefined 
		&& this.getInputData(1) !== "") {
			this.properties.variable_value = this.getInputData(1);
		} else {
			this.setOutputData(0, JSON.stringify(this.properties.array));
			return;
		}
		
		let input_array_string = (this.getInputData(0) | "").trim();

		if(input_array_string === "") {
			console.log("~~~~~~~~~~~~~~~~~~~~~~")
			console.log("parsing input array: " + input_array_string)
			console.log("~~~~~~~~~~~~~~~~~~~~~~")
			this.properties.array = JSON.parse(input_array_string);
		} else {
			this.properties.array = [];
		}

				
		this.properties.array.push(this.properties.variable_value);

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.buffer_length = parseInt(this.getInputData(2));
			this.buffer_length_widget.value = this.properties.buffer_length;
		} else if (this.buffer_length_widget.value !== this.properties.buffer_length) {
			this.properties.buffer_length = parseInt(this.buffer_length_widget.value);
		}

		if(this.properties.array.length > this.properties.buffer_length) {
			this.properties.array.shift();
		}

		this.setOutputData(0, JSON.stringify(this.properties.array));
		
	}

	function Array_Item_Forward_Node(){
		this.addInput("in array", "string");
		this.addInput("index", "number");
		this.addOutput("out item", "string");
		this.properties = {
			index: 0
		};
		this.index_widget = this.addWidget("number","Index",this.properties.index,"index", {precision:0, step:10});
	}
	Array_Item_Forward_Node.title = "Array Item Forward";
	Array_Item_Forward_Node.prototype.onExecute = function() {
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			let index_int = parseInt(this.getInputData(1));
			this.properties.index =  index_int;
			this.index_widget.value = index_int;
		} else if (this.index_widget.value !== this.properties.index) {
			this.properties.index = parseInt(this.index_widget.value);
		}

		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			let input_array = JSON.parse(this.getInputData(0));
			
			// check that index is in bounds
			if(this.properties.index < 0 || this.properties.index >= input_array.length) {
				console.log("index out of bounds");
				return;
			}
			// if item is a string, output the string, otherwise output the stringified item
			if(typeof input_array[this.properties.index] === "string") {
				this.setOutputData(0, input_array[this.properties.index]);
			} else {
				this.setOutputData(0, JSON.stringify(input_array[this.properties.index]));
			}
		}
	}
	
	function Array_Stepper_Node(){
		this.addInput("in array", "string");
		this.addInput("step text", "string");
		this.addInput("reset text", "string");
		this.addOutput("out item", "string");
		this.properties = {
			step: 0
		};
		this.step_widget = this.addWidget("number","Step",this.properties.step,"step", {precision:0, step:10});
	}
	Array_Stepper_Node.title = "Array Stepper";
	Array_Stepper_Node.prototype.onExecute = function() {
		// check for reset
		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {	
			this.properties.step = 0;
			this.step_widget.value = 0;
			this.setOutputData(0, "");
		}
		
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			let input_array = JSON.parse(this.getInputData(0));

			console.log("current step: " + this.properties.step)
			console.log("input array: " + input_array)
			console.log("current item: " + input_array[this.properties.step])
			if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
				this.properties.step += 1;
				if(this.properties.step >= input_array.length) {
					this.setOutputData(0, "");
					return;
				}
				
				this.step_widget.value = this.properties.step;
				// set output
				this.setOutputData(0, input_array[this.properties.step]);
			} else {
				this.setOutputData(0, input_array[this.properties.step]);
			}
		}
	}

	// simple vector db write node
	function Simple_Vector_DB_Write_Node(){
		this.addInput("in", "string");
		this.addInput("collection", "string");
		this.addInput("svdb_url", "string");
		this.properties = { 
			collection: "",
			last_input: "" ,
			svdb_url: ""
		};
		this.text_widget = this.addWidget("text","Collection",this.properties.collection, "collection");
	}
	Simple_Vector_DB_Write_Node.title = "Vector DB Write";
	Simple_Vector_DB_Write_Node.prototype.onExecute = async function() {
		console.log("writing to simple vector db");
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.collection = this.getInputData(1);
			this.text_widget.value = this.getInputData(1);
		} else if (this.text_widget.value !== this.properties.collection) {
			this.properties.collection = this.text_widget.value;
		}

		if(this.properties.collection === "") {
			console.log("no collection specified");
			return;
		}

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.svdb_url = this.getInputData(2);
		} else {
			console.log("no simple vector db url specified");
			return;
		}

		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "" && this.getInputData(0) !== this.properties.last_input) {
			this.properties.last_input = this.getInputData(0);
			console.log("writing to simple vector db");
			let collection_exists_response = await collection_exists(this.properties.collection, this.properties.svdb_url);
			
			if(!collection_exists_response) {
				//create collection
				console.log("creating collection");
				let create_response = await create_simple_vector_db_collection(this.properties.collection, this.properties.svdb_url);
				
			}

			let insert_response = await insert_simple_vector_db(this.properties.collection, this.properties.last_input, this.properties.last_input, this.properties.svdb_url);
		}
	}

	// simple vector db read node
	function Simple_Vector_DB_Read_Node(){
		this.addInput("query", "string");
		this.addInput("collection", "string");
		this.addInput("svdb_url", "string");
		this.addInput("top_n", "string");
		this.addOutput("array out", "string");
		this.properties = {
			collection: "",
			svdb_url: "",
			top_n: 2		
		};
		this.text_widget = this.addWidget("text","Collection",this.properties.collection, "collection");
		this.top_n_widget = this.addWidget("number","Top N",this.properties.top_n,"top_n", {precision:0, step:10});
	}
	Simple_Vector_DB_Read_Node.title = "Vector DB Read";
	Simple_Vector_DB_Read_Node.prototype.onExecute = async function() {
		console.log("reading from simple vector db");
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			this.properties.collection = this.getInputData(1);
			this.text_widget.value = this.getInputData(1);
		}

		if(this.properties.collection === "") {
			console.log("no collection specified");
			return;
		}

		if(this.getInputData(2) !== undefined && this.getInputData(2) !== "") {
			this.properties.svdb_url = this.getInputData(2);
		} else {
			console.log("no simple vector db url specified");
			return;
		}

		if(this.getInputData(3) !== undefined && this.getInputData(3) !== "") {
			this.properties.top_n = this.getInputData(3);
			this.top_n_widget.value = this.getInputData(3);
		} else if (this.top_n_widget.value !== this.properties.top_n) {
			this.properties.top_n = this.top_n_widget.value;
		}

		// check if collection exists
		if(!(await collection_exists(this.properties.collection, this.properties.svdb_url))) {
			console.log("collection does not exist");
			return;
		}

		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			console.log("reading from simple vector db");
			let response = await get_similar_documents_by_euclidean(this.properties.collection, this.getInputData(0), this.properties.top_n, this.properties.svdb_url);
			// map the second item of each array in the response array
			let output = response.map(x => { return {
				"id": x[1]['id'],
				"text": x[1]['text'],
				"timestamp": x[1]['timestamp'],
				"distance": x[0],
				//"vector": x[1]['vector']
			}});

			this.setOutputData(0, JSON.stringify(output));
		}
	}

	// Text node
	function Text_Node(){
		this.addOutput("out", "string");
		this.addInput("in", "string");
		this.addProperty("value", "");
		this.text_widget = this.addWidget("text","Text",this.properties.value,"value", {rows:10});
	}
	Text_Node.title = "Text";
	Text_Node.prototype.onExecute = function() {
		
		if(this.getInputData(0) !== undefined) {
			this.text_widget.value = this.getInputData(0);
			this.properties.value = this.getInputData(0);
		} else if(this.text_widget.value !== this.properties.value) {
			this.properties.value = this.text_widget.value;
		}
		console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
		console.log("Text node executing")
		console.log("outputting: " + this.properties.value)
		console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
		this.setOutputData(0, this.properties.value );
	}

	function Multiline_Text_Node(){
		this.addOutput("out", "string");
		this.addInput("in", "string");
		this.addProperty("value", "");
		this.text_widget = this.addWidget("text","Text",this.properties.value,"value", {
			lines:10,
			multiline: true
		});
	}
	Multiline_Text_Node.title = "Multiline Text";
	Multiline_Text_Node.prototype.onExecute = function() {
		
		if(this.getInputData(0) !== undefined) {
			this.text_widget.value = this.getInputData(0);
			this.properties.value = this.getInputData(0);
		} else if(this.text_widget.value !== this.properties.value) {
			this.properties.value = this.text_widget.value;
		}
		this.setOutputData(0, this.properties.value );
	}
	// Random Selection Node
	function Random_Selection_Node(){
		this.properties = { value: "First Names", values: "First Names;Last Names;States;Famous People;Industries;Political Parties" };
		this._values = this.properties.values.split(";");

		this.selection_options = {
			"First Names": [ "Joe", "Bob", "Sally", "Jane", "Mary", "John" ],
			"Last Names": [ "Smith", "Jones", "Johnson", "Williams", "Brown", "Davis" ],
			"States": [ "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
						"Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
						"Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
						"Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
						"New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
						"Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
						"Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming" ],
			"Famous People": [ 
				"Albert Einstein",
				"Isaac Newton",
				"Cleopatra",
				"Martin Luther King Jr.",
				"Joan of Arc",
				"Nelson Mandela",
				"Leonardo da Vinci",
				"Mozart",
				"Marie Curie",
				"Mahatma Gandhi",
				"Confucius",
				"Julius Caesar",
				"Florence Nightingale",
				"Galileo Galilei",
				"Winston Churchill",
				"Christopher Columbus",
				"William Shakespeare",
				"Socrates",
				"Amelia Earhart",
				"Rosa Parks",
				"Charles Darwin",
				"Napoleon Bonaparte",
				"Jane Austen",
				"Vincent van Gogh",
				"Marco Polo",
				"Helen Keller",
				"Tutankhamun",
				"Harriet Tubman",
				"Genghis Khan",
				"Frida Kahlo",
				"Meryl Streep",
				"Denzel Washington",
				"Audrey Hepburn",
				"Marlon Brando",
				"Cate Blanchett",
				"Leonardo DiCaprio",
				"Marilyn Monroe",
				"Tom Hanks",
				"Viola Davis",
				"Humphrey Bogart",
				"Katharine Hepburn",
				"Robert De Niro",
				"Julia Roberts",
				"Morgan Freeman",
				"Natalie Portman",
				"Jack Nicholson",
				"Judi Dench",
				"Brad Pitt",
				"Angelina Jolie",
				"Charlie Chaplin",
				"Nicole Kidman",
				"Johnny Depp",
				"Shah Rukh Khan",
				"Amitabh Bachchan",
				"Keanu Reeves",
				"Kate Winslet",
				"Daniel Day-Lewis",
				"Sandra Bullock",
				"Will Smith",
				"Penélope Cruz",
				"Beyoncé",
				"Lionel Messi",
				"Oprah Winfrey",
				"Taylor Swift",
				"Serena Williams",
				"David Beckham",
				"Ellen DeGeneres",
				"Rihanna",
				"Usain Bolt",
				"Kanye West",
				"Kim Kardashian",
				"Roger Federer",
				"Lady Gaga",
				"Michael Jordan",
				"Madonna",
				"Cristiano Ronaldo",
				"Ariana Grande",
				"Elton John",
				"Justin Bieber",
				"JK Rowling",
				"Billie Eilish",
				"LeBron James",
				"Dwayne 'The Rock' Johnson",
				"Selena Gomez",
				"Stephen Curry",
				"Kylie Jenner",
				"Ed Sheeran",
				"Conor McGregor",
				"Jennifer Lopez",
				"Drake"
			],
			"Industries": [
				"Accounting",
				"Airlines/Aviation",
				"Alternative Dispute Resolution",
				"Alternative Medicine",
				"Animation",
				"Apparel/Fashion",
				"Architecture/Planning",
				"Arts/Crafts",
				"Automotive",
				"Aviation/Aerospace",
				"Banking/Mortgage",
				"Biotechnology/Greentech",
				"Broadcast Media",
				"Building Materials",
				"Business Supplies/Equipment",
				"Capital Markets/Hedge Fund/Private Equity",
				"Chemicals",
				"Civic/Social Organization",
				"Civil Engineering",
				"Commercial Real Estate",
				"Computer Games",
				"Computer Hardware",
				"Computer Networking",
				"Computer Software/Engineering",
				"Computer/Network Security",
				"Construction",
				"Consumer Electronics",
				"Consumer Goods",
				"Consumer Services",
				"Cosmetics",
				"Dairy",
				"Defense/Space",
				"Design",
				"E-Learning",
				"Education Management",
				"Electrical/Electronic Manufacturing",
				"Entertainment/Movie Production",
				"Environmental Services",
				"Events Services",
				"Executive Office",
				"Facilities Services",
				"Farming",
				"Financial Services",
				"Fine Art",
				"Fishery",
				"Food Production",
				"Food/Beverages",
				"Fundraising",
				"Furniture",
				"Gambling/Casinos",
				"Glass/Ceramics/Concrete",
				"Government Administration",
				"Government Relations",
				"Graphic Design/Web Design",
				"Health/Fitness",
				"Higher Education/Acadamia",
				"Hospital/Health Care",
				"Hospitality",
				"Human Resources/HR",
				"Import/Export",
				"Individual/Family Services",
				"Industrial Automation",
				"Information Services",
				"Information Technology/IT",
				"Insurance",
				"International Affairs",
				"International Trade/Development",
				"Internet",
				"Investment Banking/Venture",
				"Investment Management/Hedge Fund/Private Equity",
				"Judiciary",
				"Law Enforcement",
				"Law Practice/Law Firms",
				"Legal Services",
				"Legislative Office",
				"Leisure/Travel",
				"Library",
				"Logistics/Procurement",
				"Luxury Goods/Jewelry",
				"Machinery",
				"Management Consulting",
				"Maritime",
				"Market Research",
				"Marketing/Advertising/Sales",
				"Mechanical or Industrial Engineering",
				"Media Production",
				"Medical Equipment",
				"Medical Practice",
				"Mental Health Care",
				"Military Industry",
				"Mining/Metals",
				"Motion Pictures/Film",
				"Museums/Institutions",
				"Music",
				"Nanotechnology",
				"Newspapers/Journalism",
				"Non-Profit/Volunteering",
				"Oil/Energy/Solar/Greentech",
				"Online Publishing",
				"Other Industry",
				"Outsourcing/Offshoring",
				"Package/Freight Delivery",
				"Packaging/Containers",
				"Paper/Forest Products",
				"Performing Arts",
				"Pharmaceuticals",
				"Philanthropy",
				"Photography",
				"Plastics",
				"Political Organization",
				"Primary/Secondary Education",
				"Printing",
				"Professional Training",
				"Program Development",
				"Public Relations/PR",
				"Public Safety",
				"Publishing Industry",
				"Railroad Manufacture",
				"Ranching",
				"Real Estate/Mortgage",
				"Recreational Facilities/Services",
				"Religious Institutions",
				"Renewables/Environment",
				"Research Industry",
				"Restaurants",
				"Retail Industry",
				"Security/Investigations",
				"Semiconductors",
				"Shipbuilding",
				"Sporting Goods",
				"Sports",
				"Staffing/Recruiting",
				"Supermarkets",
				"Telecommunications",
				"Textiles",
				"Think Tanks",
				"Tobacco",
				"Translation/Localization",
				"Transportation",
				"Utilities",
				"Venture Capital/VC",
				"Veterinary",
				"Warehousing",
				"Wholesale",
				"Wine/Spirits",
				"Wireless",
				"Writing/Editing"
			]
		}

		let that = this;
		this.addOutput("out", "string");
		this.widget = this.addWidget("combo","", this.properties.value, function(v){
			that.properties.value = v;
		}, { property: "value", values: this._values } );
	}
	Random_Selection_Node.title = "Random Text";
	Random_Selection_Node.prototype.onExecute = function() {
		
		let result = this.selection_options[this.properties.value][Math.floor(Math.random() * this.selection_options[this.properties.value].length)];
		this.setOutputData(0, result );
	}

	//TODO: compare number node, outputs to "yes" output based on the setting: gt, lt, eq, gte, lte



	

	// long term memory storage node
	function Weaviate_Ingest_Node(){
		this.addInput("in", "string");
		this.addOutput("class name", "string")
		this.properties = { class_key: "" };
		this.text_widget = this.addWidget("text","Class Key",this.properties.class_key, "class_key");
	}
	Weaviate_Ingest_Node.title = "Weaviate Storage";
	Weaviate_Ingest_Node.prototype.onExecute = async function() {
		const weaviateInstance = new Weaviate();
		if(this.getInputData(0) !== undefined) {
			// create class
			await weaviateInstance.createClass(this.properties.class_key, [
				{"name": "text", "dataType": "string"},
				{"name": "chunkNumber", "dataType": "number"},
			]);
			let chunk_size = 100; // words
			// split on whitespace or newline
			let words = this.getInputData(0).split(/\s+/);
			// for each chunk, call await addRecord(className, chunk)
			for(let i = 0; i < words.length; i += chunk_size) {
				let chunk = words.slice(i, i + chunk_size).join(" ");
				await weaviateInstance.addRecord(this.properties.class_key, {"text": chunk, "chunkNumber": i / chunk_size});
			}

			this.setOutputData(0, this.properties.class_key );
		}
	}

	//weaviate query node
	function Weaviate_Query_Node(){
		this.addInput("query", "string");
		this.addInput("class key", "string");
		this.addOutput("out", "string");

		this.properties = { 
			class_key: "",
			record_count: 3
		};
		this.text_widget = this.addWidget("text","Class Key",this.properties.class_key, "class_key");
		// record count widget
		this.record_count_widget = this.addWidget("text","Record Count",this.properties.record_count, "record_count");
	}
	Weaviate_Query_Node.title = "Weaviate Query";
	Weaviate_Query_Node.prototype.onExecute = async function() {
		const weaviateInstance = new Weaviate();
		// set record count property
		this.properties.record_count = this.record_count_widget.value;

		//if class key input is not undefined, set class name property
		if(this.getInputData(1) !== undefined) {
			this.properties.class_key = this.getInputData(1);
		}
		
		// if class does not exist, create it
		if(!await weaviateInstance.classExists(this.properties.class_key)) {
			await weaviateInstance.createClass(this.properties.class_key, [
				{"name": "text", "dataType": ["string"]},
				{"name": "chunkNumber", "dataType": ["number"]},
			]);
		}
		//if query input is not undefined, query weaviate
		if(this.getInputData(0) !== undefined) {
			let query = this.getInputData(0);
			let response = await weaviateInstance.advancedQuery(this.properties.class_key, query, this.properties.record_count);
			let memories = response.data.Get[this.properties.class_key]
			let result = ""
			for(let i = 0; i < memories.length; i++) {
				//console.log(memories[i].text);
				result += memories[i].text + " \n\n";
			}
			this.setOutputData(0, result );
		}
	}
	
	function Weaviate_Clear_Node(){
		this.addInput("action", LiteGraph.EVENT);
		this.addInput("text", "string");
		this.addInput("class key", "string");

		this.addOutput("action", LiteGraph.EVENT);
		this.addOutput("text", "string");
	}
	Weaviate_Clear_Node.title = "Weaviate Clear";
	Weaviate_Clear_Node.prototype.onExecute = async function() {
		const weaviateInstance = new Weaviate();
		//if class key input is not undefined, set class name property
		if(this.getInputData(1) !== undefined) {
			this.properties.class_key = this.getInputData(1);
		}
		//if action input is not undefined, clear weaviate
		if(this.getInputData(0) !== undefined) {
			let action = this.getInputData(0);
			if(action == "clear") {
				await weaviateInstance.deleteClass(this.properties.class_key);
				this.setOutputData(0, "clear" );
				this.setOutputData(1, this.properties.class_key );
			}
		}
	}

	function GPT_Node() {
		this.addInput("system", "string");
		this.addInput("user", "string");
		this.addInput("server url", "string")
		this.addInput("api key", "string");
		this.addInput("model", "string");

		// yes/no switch widget for memory on/off
		this.properties = {
			server_url: "",
			api_key: "",
			buffer_length: 0,
			chat_buffer: [],
			model: ""
		};

		// buffer length widget
		this.buffer_length_widget = this.addWidget("number","Buffer Length",this.properties.buffer_length, "buffer_length", {precision:0, step:10});
		// clear buffer button
		this.addInput("clear", "string");
		// grammars text input
		this.addInput("grammars", "string");

		this.addWidget("button","Clear Buffer","", ()=>{
			this.properties.chat_buffer = [];
		});

		this.addOutput("out", "string");
		this.addOutput("buffer", "string");
	}
	GPT_Node.title = "LLM";
	GPT_Node.prototype.onExecute = async function() {

		this.properties.buffer_length = this.buffer_length_widget.value;
		

		let should_clear = this.getInputData(5);
		if(should_clear !== undefined && should_clear !== "") {
			this.properties.chat_buffer = [];
		}
		let system = this.getInputData(0);
		if(system === undefined) {
			this.setOutputData(0, "");
			return;
		}

		let user = this.getInputData(1);
		if(user === undefined || user === "") {
			this.setOutputData(0, "");
			return;
		}


		console.log("-----GPT node executing-----")
		console.log("user: " + user)

		if(this.getInputData(2) !== undefined) {
			this.properties.server_url = this.getInputData(2);
		} else {
			this.properties.server_url = gpt_endpoint;
		}

		let api_key = this.getInputData(3);
		if(api_key !== undefined && api_key !== "") {
			this.properties.api_key = api_key;
		}

		if(this.getInputData(4) !== undefined && this.getInputData(4) !== "") {
			this.properties.model = this.getInputData(4);
		}
		let system_role = {"role": "system", "content": system};

		this.properties.api_key = api_key;

		if(this.properties.buffer_length <= 0) {
			this.properties.buffer_length = 0;
			this.properties.chat_buffer = [];
		}

		this.properties.chat_buffer.push({"role": "user", "content": user});

		// check for buffer overflow

		if(this.properties.chat_buffer.length > this.properties.buffer_length && this.properties.buffer_length > 0) {
			this.properties.chat_buffer.shift();
		}

		let messages = this.properties.chat_buffer.map((item) => item);
		console.log("messages: " + JSON.stringify(messages));

		// prepend system message
		messages.unshift(system_role);

		let grammar = this.getInputData(6);
		console.log("grammar: " + grammar)

		let gpt_response = await call_gpt(messages, this.properties.api_key, this.properties.server_url, this.properties.model, grammar);

		console.log("setting GPT output: " + gpt_response)
		this.properties.chat_buffer.push({"role": "assistant", "content": gpt_response});
		this.setOutputData(0, gpt_response);
		this.setOutputData(1, JSON.stringify(this.properties.chat_buffer));
	}


	function Password_Node() {
		// just a text input node that hides the text and an output
		this.addOutput("out", "string");

		this.properties = {
			password: ""
		};
		this.text_widget = this.addWidget("text","Password",this.properties.password, "password");
	}
	Password_Node.title = "Password";
	Password_Node.prototype.onExecute = function() {
		this.setOutputData(0, this.text_widget.value);
	}

	

	//audio generation node, text in, play audio out
	function Audio_Generation_Node(){
		this.addInput("text", "string");
	
	}
	Audio_Generation_Node.title = "Audio Generation";
	Audio_Generation_Node.prototype.onExecute = async function() {
		// POST to 192.168.0.7:2702/text-to-wav
		let text = this.getInputData(0);
		if( text !== undefined) {

			console.log("Generating audio for: " + text)
			await startAudioGeneration(text)
		}

		
		
		// get back wav file
		// play wav file


	}



	function Prompt_Gate_GPT(){
		this.addInput("in", "string");
		this.addInput("context", "string");
		this.addInput("system", "string");
		this.addInput("prompt", "string");
		this.addInput("server url", "string");
		this.addInput("api key", "string");
		this.addInput("model", "string");
		this.addInput("grammar", "string");


		this.addOutput("yes", LiteGraph.ACTION);
		this.addOutput("no", LiteGraph.ACTION);
		this.addOutput("yes", "string");
		this.addOutput("no", "string");
		this.addOutput("reasoning", "string");
		this.properties = {
			prompt: "",
			url: gpt_endpoint,
			api_key: "",
			reasoning: "",
			last_input: "",
			model: "gpt-3.5-turbo"
		 };
		this.prompt_widget = this.addWidget("text","Prompt",this.properties.prompt, "prompt");

	}
	Prompt_Gate_GPT.title = "Prompt Gate";
	Prompt_Gate_GPT.default_grammar = 
	`root   ::= object
	value  ::= object | array | string | number | ("true" | "false" | "null") ws
	
	object ::=
	  "{" ws (
				string ":" ws value
		("," ws string ":" ws value)*
	  )? "}" 
	
	array  ::=
	  "[" ws (
				value
		("," ws value)*
	  )? "]" ws
	
	string ::=
	  "\"" (
		[^"\\] |
		"\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]) # escapes
	  )* "\"" ws
	
	number ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)? ws
	
	# Optional space: by convention, applied in this grammar after literal chars when allowed
	ws ::= ([ \t\n] ws)?
	
	`


	Prompt_Gate_GPT.prototype.onExecute = async function() {
		let in_prompt = this.getInputData(3)||"";
		// trim the in_prompt
		in_prompt = in_prompt.trim();
		// needs to check for if input(3) isn't undefined, isn't blank, and is different from last prompt, etc
		if(in_prompt !== undefined && in_prompt !== "" && in_prompt !== this.properties.prompt) {
			this.properties.prompt = in_prompt;
			this.prompt_widget.value = this.properties.prompt;
		} else if (this.prompt_widget.value !== this.properties.prompt) {
			this.properties.prompt = this.prompt_widget.value;
		}

		// model
		if(this.getInputData(6) !== undefined && this.getInputData(6) !== "") {
			this.properties.model = this.getInputData(6);
		} else {
			console.log("prompt gate model not set")
		}

		// grammar
		let grammar = this.getInputData(7);
		console.log("grammar: " + grammar);
		if(grammar === undefined || grammar === "") {
			grammar = Prompt_Gate_GPT.default_grammar;
		}

		let input = this.getInputData(0);
		if(input === undefined || input === "") {
			this.setOutputData(2, "");
			this.setOutputData(3, "");
			this.properties.last_input = "";
			return;
		} else if(input === this.properties.last_input) {
			return;
		} else {
			this.properties.last_input = input.trim();
			
		}

		let context = this.getInputData(1) || "";
		let system = this.getInputData(2) || "";

		if (context !== "") {
			system += ". Given the following context: " + context + ","; 
		}
		system += " Please answer the question below about this text with a JSON dict containing the keys 'decision' which is a yes or no, and 'reason' which is a sentence about your reasoning: " + input;

		console.log("-----Prompt Gate node executing-----")
		console.log("input: " + input)

		let server_url = this.getInputData(4) || gpt_endpoint;
		let api_key = this.getInputData(5);

		let messages = [];
		messages.push({"role": "system", "content": system});
		messages.push({"role": "user", "content": this.properties.prompt});

		let gpt_response = await call_gpt(messages, api_key, server_url, this.properties.model, grammar);

		
		this.properties.reasoning = gpt_response;
		this.setOutputData(4, gpt_response);

		const positive_words = ["yes", "yeah"]

		if(containsWords(positive_words,gpt_response.toLowerCase())) {
			this.trigger("yes", this.properties.last_input);
			this.setOutputData(2, this.properties.last_input);
			this.setOutputData(3, "");
		}
		else {
			this.trigger("no", this.properties.last_input);
			this.setOutputData(2, "");
			this.setOutputData(3, this.properties.last_input);
		}
	}


	// prefix text node
	function Prefix_Text_Node(){
		this.addInput("in", "string");
		this.addOutput("out", "string");
		this.properties = { 
			prefix: ""
		 };
		this.text_widget = this.addWidget("text","Prefix",this.properties.prefix, "prefix");
	}
	Prefix_Text_Node.title = "Prefix Text";
	Prefix_Text_Node.prototype.onExecute = function() {
		this.setOutputData(0, this.properties.prefix + " " + this.getInputData(0) );
	}

	// suffix text node
	function Suffix_Text_Node(){
		this.addInput("in", "string");
		this.addOutput("out", "string");
		this.properties = {
			suffix: ""
		};
		this.text_widget = this.addWidget("text","Suffix",this.properties.suffix, "suffix");
	}
	Suffix_Text_Node.title = "Suffix Text";
	Suffix_Text_Node.prototype.onExecute = function() {
		this.setOutputData(0, this.getInputData(0) + " " + this.properties.suffix );
	}

	// concatenate text node
	function Concatenate_Text_Node(){
		this.addInput("first", "string");
		this.addInput("last", "string");
		this.addOutput("out", "string");

		this.properties = {
			first: "",
			last: ""
		};
		this.text_widget_first = this.addWidget("text","First",this.properties.first, "first");
		this.text_widget_last = this.addWidget("text","Last",this.properties.last, "last");

	}
	Concatenate_Text_Node.title = "Concatenate Text";
	Concatenate_Text_Node.prototype.onExecute = function() {


		// update properties
		if(this.getInputData(0) !== undefined) {
			this.properties.first = this.getInputData(0);
			// set widget value
			this.text_widget_first.value = this.getInputData(0);
		} else  {
			this.properties.first = this.text_widget_first.value;
		}

		if(this.getInputData(1) !== undefined) {
			this.properties.last = this.getInputData(1);

			this.text_widget_last.value = this.getInputData(1);
		} else  {
			this.properties.last = this.text_widget_last.value;
		}
		
		this.setOutputData(0, this.properties.first + " " + this.properties.last );

	}

	//start node
	function Start_Node(){
		this.addInput("trigger", "string");

	}
	Start_Node.title = "Run Again";
	Start_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== ""){
			// set gloabl variable to true
			console.log("setting run again to true")
			console.log(this.getInputData(0))
			window.run_again = true;
		} 
	}


	// trigger on text node
	function Emit_Node(){
		this.addInput("in", "string");
		this.addInput("event name", "string");
		this.addInput("reset event", "string");

		this.eventEmmiter = eventEmitter;
		this.properties = {
			last_input: "",
			last_reset: "",
			event_name: "event",
			reset_event_name: "reset"
		};
		// event name widget
		this.text_widget = this.addWidget("text","Event To Emit",this.properties.event_name, "event_name");
		// reset event name widget
		this.reset_widget = this.addWidget(
			"text",
			"Reset Event Name",
			this.properties.reset_event_name, 
			function(value, widget, node){
				node.properties.reset_event_name = value;
				node.eventEmmiter.on(node.properties.reset_event_name, ()=>{
					node.properties.last_input = "";
				}, node);
			});

	}
	Emit_Node.title = "Event Emitter";
	Emit_Node.prototype.onExecute = function() {
		// if input(1) is not undefined and is different from last_reset set it
		if(this.getInputData(2) !== undefined 
		&& this.getInputData(2) !== this.properties.last_reset
		&& this.getInputData(2) !== "") {
			this.properties.reset_event_name = this.getInputData(2);
		}

		if(this.last_reset !== this.properties.reset_event_name) {
			// remove previous listener
			this.last_reset = this.properties.reset_event_name;			
		}

		this.eventEmmiter.on(this.properties.reset_event_name, ()=>{
				this.properties.last_input = "";
			}, this);

		if(this.getInputData(1) !== undefined 
		&& this.getInputData(1) !== this.properties.event_name
		&& this.getInputData(1) !== "") {
			this.properties.event_name = this.getInputData(1);
		} 

		if(this.getInputData(0) !== undefined 
		&& this.getInputData(0) !== this.properties.last_input
		&& this.getInputData(0) !== "") {
			this.properties.last_input = this.getInputData(0);

			console.log("emitting event: " + this.properties.event_name)
			this.eventEmmiter.emit(this.properties.event_name, this.properties.last_input);
		}
	}

	// simple counter node
	function Counter_Node(){
		this.addInput("up", "string");
		this.addInput("down", "string");
		this.addOutput("out", "string");
		this.properties = {
			"count": 0
		};
		this.addWidget("button","Reset","", ()=>{
			this.properties.count = 0;
			this.setOutputData(0, this.properties.count);
			this.count_widget.value = this.properties.count;
		})

		this.count_widget = this.addWidget("text","Count",this.properties.count, "count");
	}
	Counter_Node.title = "Counter";
	Counter_Node.prototype.onAction = function(action, param) {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.count += this.getInputData(0);
		}
	}

	function Triggered_Number_Output_Node(){
		this.addInput("number", "string");
		this.addInput("trigger", "string");
		this.addOutput("out", "string");
		this.properties = {
			"number": 0
		};
		this.number_widget = this.addWidget("number","Number",this.properties.number, "number", {precision:0, step:10});
	}
	Triggered_Number_Output_Node.title = "Triggered Number Output";
	Triggered_Number_Output_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.number = this.getInputData(0);
		} else if(this.number_widget.value !== "") {
			this.properties.number = this.number_widget.value;
		}
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {			
			this.setOutputData(0, this.properties.number);
		} else {
			this.setOutputData(0, "");
		}
	}

	// triggered text output node
	function Triggered_Text_Output_Node(){
		this.addInput("text", "string");
		this.addInput("trigger", "string");
		this.addOutput("out", "string");
		this.properties = {
			"text": ""
		};
		this.text_widget = this.addWidget("text","Text",this.properties.text, "text");
	}
	Triggered_Text_Output_Node.title = "Triggered Text Output";
	Triggered_Text_Output_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.text = this.getInputData(0);
		} else if(this.text_widget.value !== "") {
			this.properties.text = this.text_widget.value;
		}
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {			
			this.setOutputData(0, this.properties.text);
		} else {
			this.setOutputData(0, "");
		}
	}

	// Add_Node, 2 inputs, 1 output, 1 widget for number
	function Add_Node(){
		this.addInput("in_0", "string");
		this.addInput("in_1", "string");
		this.addOutput("out", "string");
		this.properties = {
			"number": 0
		};
		this.number_widget = this.addWidget("number","Number",this.properties.number, "number", {precision:0, step:10});
	}
	Add_Node.title = "Add";
	Add_Node.prototype.onExecute = function() {
		console.log("Add node executing")
		let a = 0;
		let b = 0;
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			a = Number.parseFloat(this.getInputData(0));
		}
		if(this.getInputData(1) !== undefined && this.getInputData(1) !== "") {
			b = Number.parseFloat(this.getInputData(1));
		}
		this.properties.number = a + b;
		this.number_widget.value = this.properties.number;
		this.setOutputData(0, this.properties.number);
	}

	// Compare number node
	function Compare_Number_Node(){
		this.addInput("in_0", "string");
		this.addInput("in_1", "string");
		this.addOutput("out", "string");
		this.properties = {
			"compare_type": "greater than",
			"compare_types": ["greater than", 
							  "less than", 
							  "equal to", 
							  "not equal to", 
							  "greater than or equal to", 
							  "less than or equal to"],	
		};

	}

	// random number node, 0 inputs, 1 number output, 2 widgets for min and max
	function Random_Number_Node(){
		this.addOutput("out", "string");
		this.properties = {
			"min": 0,
			"max": 100
		};
		this.min_widget = this.addWidget("number","Min",this.properties.min, "min", {precision:0, step:10});
		this.max_widget = this.addWidget("number","Max",this.properties.max, "max", {precision:0, step:10});
	}
	Random_Number_Node.title = "Random Number";
	Random_Number_Node.prototype.onExecute = function() {
		// update properties
		if(this.min_widget.value !== "") {
			this.properties.min = this.min_widget.value;
		}
		if(this.max_widget.value !== "") {
			this.properties.max = this.max_widget.value;
		}
		// set output to random number between min and max
		this.setOutputData(0, Math.floor(Math.random() * (this.properties.max - this.properties.min + 1)) + this.properties.min);
	}

	//Text Input node, 0 inputs, 1 text output, 1 widget for text input, when ran in backend, this value will be filled in by the runner
	function Text_Input_Node() {
		this.addOutput("out", "string");
		this.properties = {
			"text": ""
		};
		this.text_widget = this.addWidget("text","Text",this.properties.text, "text");
	}
	Text_Input_Node.title = "Text Input";
	// green theme
	Text_Input_Node.title_color = "#232"
	Text_Input_Node.fg_color = "#FFF"
	Text_Input_Node.bg_color = "#353"
	// end green theme
	Text_Input_Node.prototype.onExecute = function() {
		// update properties
		this.text_widget.value = this.properties.text;
		
		// set output to text
		this.setOutputData(0, this.properties.text);
	}



	// Text output node, 1 input, 0 outputs, 1 widget for text output
	function Text_Output_Node() {
		this.eventEmmiter = eventEmitter;
		this.addInput("in", "string");
		this.addInput("clear event", "string");
		this.properties = {
			"text": "",
			"clear_event": "",
			"last_clear_event": ""
		};
		this.text_widget = this.addWidget("text","Text",this.properties.text, "text");	
		this.clear_widget = this.addWidget(
			"text",
			"Clear Event",
			this.properties.clear_event, 
			function(value, widget, node){
				node.properties.clear_event = value;
				node.eventEmmiter.on(node.properties.clear_event, ()=>{
					console.log("Clearing text output")
					node.properties.text = "";
					node.text_widget.value = node.properties.text;
				}, node);
			});
	}
	Text_Output_Node.title = "Text Output";
	// red theme
	Text_Output_Node.title_color = "#322"
	Text_Output_Node.fg_color = "#FFF"
	Text_Output_Node.bg_color = "#533"
	// end red theme
	Text_Output_Node.prototype.onLoad = function(node) {
		//console.log(node)
		node.eventEmmiter.on(node.properties.clear_event, ()=>{
			console.log("Clearing text output")
			node.properties.text = "";
			node.text_widget.value = node.properties.text;
		}, node);
	}
	Text_Output_Node.prototype.onExecute = function() {
		// update properties
		if(this.getInputData(0) !== undefined) {
			this.properties.text = this.getInputData(0);
		}

		if(this.getInputData(1) !== undefined
		&& this.getInputData(1) !== this.properties.clear_event
		&& this.getInputData(1) !== "") {
			this.properties.clear_event = this.getInputData(0);
		} else if(this.clear_widget.value !== "") {
			this.properties.clear_event = this.clear_widget.value;
		}

		if(this.properties.clear_event !== this.properties.last_clear_event) {
			this.properties.last_clear_event = this.properties.clear_event;			
		}

		this.eventEmmiter.on(this.properties.clear_event, ()=>{
			console.log("Clearing text output")
			this.properties.text = "";
			this.text_widget.value = this.properties.text;
		}, this);

		// set widget value to text
		this.text_widget.value = this.properties.text;
	}
	Text_Output_Node.prototype.onAction = function(action, param) {
		console.log("Text output node action: " + action)
		if(action == "event") {
			this.properties.text = "";
			this.text_widget.value = this.properties.text;
		}
	}

	// Gate node, 2 inputs, 1 output, 1 widget for gate type
	function Gate() {
		this.addInput("in_0", "string");
		this.addInput("in_1", "string");
		// out string
		this.addOutput("out", "string");		
		this.properties = {
			"gate_type": "and",
			"and_output": "0 =>"
		};
		let that = this;
		//widget for gate type
		this.gate_type_widget = this.addWidget("combo","", this.properties.gate_type, function(v){
			that.properties.gate_type = v;
		}, { property: "gate_type", values: ["and", "or", "not", "xor"] } );

		// widget for output selector for and gate, 0, 1, 0 then 1, 1 then 0
		this.and_output_widget = this.addWidget("combo","", "0 =>", function(v){
			that.properties.and_output = v;
		}, { property: "and_output", values: ["0 =>", "1 =>", "0 + 1 =>", "1 + 0 =>"] } );

	}

	Gate.title = "Gate";

	Gate.prototype.onExecute = function() {
		// update properties
		this.properties.gate_type = this.gate_type_widget.value;
		//remove leading and trailing spaces

		let in_0 = (this.getInputData(0) || "").trim();
		let in_1 = (this.getInputData(1) || "").trim();

		console.log("GATE NODE: ")
		console.log("in_0: " + in_0)
		console.log("in_1: " + in_1)

		// AND: if both inputs are not empty, set output to input 0 or input 1, else set output to empty
		// OR: if either input is not empty, set output to input 0 or input 1, else set output to empty
		// NOT: if input 0 is empty, set output to input 1, else set output to empty
		// XOR: if both inputs are not empty, set output to input 0 or input 1, else set output to empty

		// set output to gate type
		switch(this.properties.gate_type) {
			case "and":
				if(in_0 !== "" && in_1 !== "") {
					switch(this.properties.and_output) {
						case "0 =>":
							this.setOutputData(0, in_0);
							break;
						case "1 =>":
							this.setOutputData(0, in_1);
							break;
						case "0 + 1 =>":
							this.setOutputData(0, in_0 + " " + in_1);
							break;
						case "1 + 0 =>":
							this.setOutputData(0, in_1 + " " + in_0);
							break;
					}
				} else {
					this.setOutputData(0, "");
				}
				break;
			case "or":
				if(in_0 !== "" || in_1 !== "") {
					switch(this.properties.and_output) {
						case "0 =>":
							this.setOutputData(0, in_0);
							break;
						case "1 =>":
							this.setOutputData(0, in_1);
							break;
						case "0 + 1 =>":
							this.setOutputData(0, in_0 + " " + in_1);
							break;
						case "1 + 0 =>":
							this.setOutputData(0, in_1 + " " + in_0);
							break;
					}
				} else {
					this.setOutputData(0, "");
				}
				break;
			case "not":
				if(in_0 === "" || in_0 === undefined) {
					this.setOutputData(0, in_1);
				} else {
					this.setOutputData(0, "");
				}
				break;
			case "xor":
				if(in_0 !== "" && in_1 !== "") {
					this.setOutputData(0, "");
				} else if(in_0 !== "") {
					this.setOutputData(0, in_0);
				} else if(in_1 !== "") {
					this.setOutputData(0, in_1);
				} else {
					this.setOutputData(0, "");
				}
				break;
		}
	}

	// img url to base64 node, 1 input, 1 output, 1 widget for url
	function Img_URL_To_Base64_Node() {
		this.addInput("url", "string");
		this.addOutput("out", "string");
		this.properties = {
			"url": ""
		};
		this.url_widget = this.addWidget("text","Url",this.properties.url, "url");
	}
	Img_URL_To_Base64_Node.title = "Img URL To Base64";
	Img_URL_To_Base64_Node.prototype.onExecute = async function() {
		// update properties
		if (this.getInputData(0) !== undefined && this.getInputData(0) !== this.properties.url && this.getInputData(0) !== "") {
			this.properties.url = this.getInputData(0);
			// set widget value
			this.url_widget.value = this.getInputData(0);
		} else {
			this.properties.url = this.url_widget.value;
		}
	
		let url = this.properties.url;
		console.log("url: " + url);
	
		try {
			let response = await fetch(url);
			let blob = await response.blob();
	
			let base64data = await new Promise((resolve, reject) => {
				let reader = new FileReader();
				reader.onloadend = function() {
					resolve(reader.result);
				};
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});
	
			console.log(base64data);
			this.setOutputData(0, base64data);
		} catch (error) {
			console.error('Error:', error);
		}
	}
	
	// Keyword_Extraction_Node
	function Keyword_Extraction_Node() {
		this.addInput("text", "string");
		this.addInput("server url", "string");
		this.addOutput("array out", "string");
		this.properties = {
			"server_url": ""
		};
		this.server_url_widget = this.addWidget("text","Server Url",this.properties.server_url, "server_url");
	}
	Keyword_Extraction_Node.title = "Keyword Extraction";
	Keyword_Extraction_Node.prototype.onExecute = async function() {
		let text = this.getInputData(0);
		if(text === undefined || text === "") {
			this.setOutputData(0, "");
			return;
		}

		if(this.getInputData(1) !== undefined && this.getInputData(1) !== this.properties.server_url && this.getInputData(1) !== "") {
			this.properties.server_url = this.getInputData(1);
			// set widget value
			this.server_url_widget.value = this.getInputData(1);
		} else {
			this.properties.server_url = this.server_url_widget.value;
		}

		console.log("-----Keyword Extraction node executing-----")
		console.log("text: " + text)

		let server_url = this.properties.server_url;

		let response = await fetch(server_url + "/keyword_extraction", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"text": text
			})
		});
		let json = await response.json();
		
		console.log(json);
		let output = JSON.stringify(json["keywords"]);
		console.log("output: " + output);
		this.setOutputData(0, output);

	}

	// Vision_Node
	function Vision_Node() {
		// NOTE: USE BASE64 ENCODING FOR IMAGES
		this.addInput("img base64", "string");
		this.addInput("system prompt", "string");
		this.addInput("user prompt", "string");
		this.addInput("server url", "string");
		this.addInput("clip path", "string");
		this.addInput("model path", "string");

		this.addOutput("out", "string");
		this.properties = {
			"server_url": ""
		};
	}
	Vision_Node.title = "Vision";
	Vision_Node.prototype.onExecute = async function() {
		// update properties

		this.properties.server_url = this.getInputData(3);


		let server_url = this.properties.server_url;
		console.log("server_url: " + server_url)

		let img_base64 = this.getInputData(0);
		console.log("img_base64: " + img_base64)

		let system_prompt = this.getInputData(1);
		console.log("system_prompt: " + system_prompt)

		let user_prompt = this.getInputData(2);
		console.log("user_prompt: " + user_prompt)

		let clip_path = this.getInputData(4);
		console.log("clip_path: " + clip_path)

		let model_path = this.getInputData(5);
		console.log("model_path: " + model_path)

		let response = await fetch(server_url + "/vision", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"img_base64": img_base64,
				"system_prompt": system_prompt,
				"user_prompt": user_prompt,
				"clip_path": clip_path,
				"model_path": model_path
			})
		});
		let json = await response.json();
		console.log(json);
		msg = json["choices"][0]["message"]["content"]
		this.setOutputData(0, msg);
	}


	// JSON_API_Node url input, url widget, 1 output which is a json string
	function JSON_API_Node() {
		this.addInput("url", "string");
		this.addInput("in dict", "string")
		this.addOutput("out dict", "string");
		this.properties = {
			"url": ""
		};
		this.url_widget = this.addWidget("text","Url",this.properties.url, "url");
	}
	JSON_API_Node.title = "JSON API";
	JSON_API_Node.prototype.onExecute = async function() {
		// update properties
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== this.properties.url && this.getInputData(0) !== "") {
			this.properties.url = this.getInputData(0);
			// set widget value
			this.url_widget.value = this.getInputData(0);
		} else {
			this.properties.url = this.url_widget.value;
		}

		let url = this.properties.url;
		console.log("url: " + url)
		let response = await fetch(url);
		let json = await response.json();
		console.log(json);
		this.setOutputData(0, json);
	}


	
	function Global_Variable_Set_Node(){
		this.addInput("var name", "string");
		this.addInput("var value", "string");

		this.properties = {
			"var_name": "",
			"var_value": ""
		};
		this.var_name_widget = this.addWidget("text","Variable Name",this.properties.var_name, "var_name");
	}
	Global_Variable_Set_Node.title = "Set Global Var";
	Global_Variable_Set_Node.prototype.onExecute = function() {
		// update properties
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== this.properties.var_name && this.getInputData(0) !== "") {
			this.properties.var_name = this.getInputData(0);
			// set widget value
			this.var_name_widget.value = this.getInputData(0);
		} else {
			this.properties.var_name = this.var_name_widget.value;
		}

		if(this.getInputData(1) !== undefined && this.getInputData(1) !== this.properties.var_value && this.getInputData(1) !== "") {
			this.properties.var_value = this.getInputData(1);
		}

		console.log("setting global var: " + this.properties.var_name + " to " + this.properties.var_value)
		
		// set global var
		window[this.properties.var_name] = this.properties.var_value;
		console.log("window[" + this.properties.var_name + "] = " + window[this.properties.var_name])
	}

	function Global_Variable_Get_Node(){
		this.addInput("var name", "string");
		this.addOutput("var value", "string");

		this.properties = {
			"var_name": "",
			"var_value": ""
		};
		this.var_name_widget = this.addWidget("text","Variable Name",this.properties.var_name, "var_name");
	}
	Global_Variable_Get_Node.title = "Get Global Var";
	Global_Variable_Get_Node.prototype.onExecute = function() {
		console.log("getting global var: " + this.properties.var_name + " = " + window[this.properties.var_name])
		// update properties
		if(this.getInputData(0) !== undefined && this.getInputData(0) !== "") {
			this.properties.var_name = this.getInputData(0);
			// set widget value
			this.var_name_widget.value = this.getInputData(0);
		} else {
			this.properties.var_name = this.var_name_widget.value;
		}

		this.properties.var_value = window[this.properties.var_name];
		// get global var
		this.setOutputData(0, this.properties.var_value);
	}


	/*****************************************************************************************/
	/*****************************************************************************************/

	if (typeof module !== 'undefined' && module.exports) {
		console.log("~~~~~~~~~~~~~~~~~~~")
		console.log("exporting nodes")
		console.log("~~~~~~~~~~~~~~~~~~~")
		module.exports = {
			/* Weaviate_Ingest_Node */
			/* takes in text and a class name and it dumps text into the target weaviate class */
			Weaviate_Ingest_Node: Weaviate_Ingest_Node,
			/* Weaviate_Query_Node */
			/* takes in a query and a class name and it queries the target weaviate class */
			Weaviate_Query_Node: Weaviate_Query_Node,
			
			Random_Selection_Node: Random_Selection_Node,
			Text_Node: Text_Node,
			Audio_Generation_Node: Audio_Generation_Node,
			Prefix_Text_Node: Prefix_Text_Node,
			Suffix_Text_Node: Suffix_Text_Node,
			Concatenate_Text_Node: Concatenate_Text_Node,
			Start_Node: Start_Node,
			Counter_Node: Counter_Node,
			Random_Number_Node: Random_Number_Node,
			Text_Input_Node: Text_Input_Node,
			Text_Output_Node: Text_Output_Node,
			Gate:Gate,
			JSON_API_Node: JSON_API_Node,
			GPT_Node: GPT_Node,
			Password_Node: Password_Node,
			Prompt_Gate_GPT: Prompt_Gate_GPT,
			Simple_Vector_DB_Read_Node: Simple_Vector_DB_Read_Node,
			Simple_Vector_DB_Write_Node: Simple_Vector_DB_Write_Node,
			Brain_Node: Brain_Node,
			Variable_Forward_Node: Variable_Forward_Node,
			Dictionary_Assembler_Node:Dictionary_Assembler_Node,
			Global_Variable_Get_Node:Global_Variable_Get_Node,
			Global_Variable_Set_Node:Global_Variable_Set_Node,
			Array_Assembler_Node:Array_Assembler_Node,
			Array_Item_Forward_Node:Array_Item_Forward_Node,
			Array_Stepper_Node,Array_Stepper_Node,
			Triggered_Number_Output_Node:Triggered_Number_Output_Node,
			Triggered_Text_Output_Node:Triggered_Text_Output_Node,
			Add_Node:Add_Node,
			Random_Array_Item_Node:Random_Array_Item_Node,
			Random_Dictionary_Item_Node:Random_Dictionary_Item_Node,
			Note_Node:Note_Node,
			Time_Node:Time_Node,
			Img_URL_To_Base64_Node:Img_URL_To_Base64_Node,
			Vision_Node:Vision_Node,
			Keyword_Extraction_Node:Keyword_Extraction_Node,
			Dictionary_Assembler_Node:Dictionary_Assembler_Node,
			Dictionary_Bus_Input_Node:Dictionary_Bus_Input_Node,
			Dictionary_Bus_Output_Node:Dictionary_Bus_Output_Node,
			Dictionary_Bus_Get_Node:Dictionary_Bus_Get_Node,
			Dictionary_Bus_Set_Node:Dictionary_Bus_Set_Node,
			Multiline_Text_Node:Multiline_Text_Node,
		};
	}
