/*****************************************************************************************/
/*****************************************************************************************/
/***************************************NODES********************************************/
/*****************************************************************************************/
	if(typeof module !== 'undefined') {
		const Weaviate = require("weaviate.js");
		const { LiteGraph } = require("litegraph.js");
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
			console.log("emitting event: " + event)
			console.log(this.events)
			console.log(args)
			console.log(this.events[event])
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
	
	async function call_llm(prompt, url) {
		request = {
			'prompt': prompt,
			'max_new_tokens': 1000,

			// Generation params. If 'preset' is set to different than 'None', the values
			// in presets/preset-name.yaml are used instead of the individual numbers.
			'preset': 'None',
			'do_sample': true,
			'temperature': 0.9,
			'top_p': 0.14,
			'typical_p': 1,
			'epsilon_cutoff': 0,  // In units of 1e-4
			'eta_cutoff': 0,  // In units of 1e-4
			'tfs': 1,
			'top_a': 0,
			'repetition_penalty': 1.17,
			'repetition_penalty_range': 0,
			'top_k': 49,
			'min_length': 0,
			'no_repeat_ngram_size': 0,
			'num_beams': 1,
			'penalty_alpha': 0,
			'length_penalty': 1,
			'early_stopping': false,
			'mirostat_mode': 0,
			'mirostat_tau': 5,
			'mirostat_eta': 0.1,

			'seed': -1,
			'add_bos_token': true,
			'truncation_length': 2048,
			'ban_eos_token': false,
			'skip_special_tokens': true,
			'stopping_strings': []
		}
		
		let ip = "192.168.0.7";
		let llm_response = await fetch(url + '/api/v1/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
		})

		llm_response = await llm_response.json();

		return llm_response.results[0].text;
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
			//console.log("-----text node on execute")
			//console.log(this.getInputData(0))
			//console.log("-------------")
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
			],
			"Political Parties": [
				"Democratic",
				"Republican",
				"Democratic",
				"Republican",
				"Democratic",
				"Republican",
				"Democratic",
				"Republican",
				"Democratic",
				"Republican",
				"Democratic",
				"Republican",
				"Independent",
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

	// Persona Template Node
	function Persona_Template_Node(){
		/*
		// each one has an input, output, property, and widget
		first_name
		last_name
		version
		description
		backstory
		constitution
		goal		
		*/
		this.addInput("first_name", "string");
		this.addInput("last_name", "string");
		this.addInput("version", "string");
		this.addInput("description", "string");
		this.addInput("backstory", "string");
		this.addInput("constitution", "string");
		this.addInput("goal", "string");

		this.addOutput("first_name", "string");
		this.addOutput("last_name", "string");
		this.addOutput("version", "string");
		this.addOutput("description", "string");
		this.addOutput("backstory", "string");
		this.addOutput("constitution", "string");
		this.addOutput("goal", "string");
		
		this.properties = { 
			first_name: "",
			last_name: "",
			version: "",
			description: "",
			backstory: "",
			constitution: "",
			goal: ""
		};

		this.first_name_widget = this.addWidget("text","First Name",this.properties.first_name,"first_name");
		this.last_name_widget = this.addWidget("text","Last Name",this.properties.last_name,"last_name");
		this.version_widget = this.addWidget("text","Version",this.properties.version,"version");
		this.description_widget = this.addWidget("text","Description",this.properties.description,"description");
		this.backstory_widget = this.addWidget("text","Backstory",this.properties.backstory,"backstory");
		this.constitution_widget = this.addWidget("text","Constitution",this.properties.constitution,"constitution");
		this.goal_widget = this.addWidget("text","Goal",this.properties.goal,"goal");
	}
	Persona_Template_Node.title = "Persona Template";
	Persona_Template_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined) {
			this.first_name_widget.value = this.getInputData(0);
			this.properties.first_name = this.getInputData(0);
		}
		if(this.getInputData(1) !== undefined) {
			this.last_name_widget.value = this.getInputData(1);
			this.properties.last_name = this.getInputData(1);
		}
		if(this.getInputData(2) !== undefined) {
			this.version_widget.value = this.getInputData(2);
			this.properties.version = this.getInputData(2);
		}
		if(this.getInputData(3) !== undefined) {
			this.description_widget.value = this.getInputData(3);
			this.properties.description = this.getInputData(3);
		}
		if(this.getInputData(4) !== undefined) {
			this.backstory_widget.value = this.getInputData(4);
			this.properties.backstory = this.getInputData(4);
		}
		if(this.getInputData(5) !== undefined) {
			this.constitution_widget.value = this.getInputData(5);
			this.properties.constitution = this.getInputData(5);
		}
		if(this.getInputData(6) !== undefined) {
			this.goal_widget.value = this.getInputData(6);
			this.properties.goal = this.getInputData(6);
		}

		this.setOutputData(0, this.properties.first_name );
		this.setOutputData(1, this.properties.last_name );
		this.setOutputData(2, this.properties.version );
		this.setOutputData(3, this.properties.description );
		this.setOutputData(4, this.properties.backstory );
		this.setOutputData(5, this.properties.constitution );
		this.setOutputData(6, this.properties.goal );
	}

	// prompt template node
	function Prompt_Template_Node(){
		/*
		// each one has an input, property, and widget
		pre_constitution_prompt
		post_constitution_prompt
		pre_goal_prompt
		post_goal_prompt
		pre_context_prompt
		post_context_prompt
		pre_instruction_prompt
		post_instruction_prompt
		response_prompt

		constitution
		goal
		instruction
		context
		
		*/
		
		this.addInput("pre_constitution_prompt", "string");
		this.addInput("post_constitution_prompt", "string");
		this.addInput("pre_goal_prompt", "string");
		this.addInput("post_goal_prompt", "string");
		this.addInput("pre_context_prompt", "string");
		this.addInput("post_context_prompt", "string");
		this.addInput("pre_instruction_prompt", "string");
		this.addInput("post_instruction_prompt", "string");
		this.addInput("response_prompt", "string");

		this.addInput("constitution", "string");
		this.addInput("goal", "string");
		this.addInput("instruction", "string");
		this.addInput("context", "string");

		this.addOutput("final_prompt", "string");


		this.properties = { 
			pre_constitution_prompt: "",
			post_constitution_prompt: "",
			pre_goal_prompt: "",
			post_goal_prompt: "",
			pre_context_prompt: "",
			post_context_prompt: "",
			pre_instruction_prompt: "",
			post_instruction_prompt: "",
			response_prompt: "",
			constitution: "",
			goal: "",
			instruction: "",
			context: "",
			final_prompt: ""
		};

		this.pre_constitution_prompt_widget = this.addWidget("text","Pre Constitution Prompt",this.properties.pre_constitution_prompt,"pre_constitution_prompt");
		this.post_constitution_prompt_widget = this.addWidget("text","Post Constitution Prompt",this.properties.post_constitution_prompt,"post_constitution_prompt");
		this.pre_goal_prompt_widget = this.addWidget("text","Pre Goal Prompt",this.properties.pre_goal_prompt,"pre_goal_prompt");
		this.post_goal_prompt_widget = this.addWidget("text","Post Goal Prompt",this.properties.post_goal_prompt,"post_goal_prompt");
		this.pre_context_prompt_widget = this.addWidget("text","Pre Context Prompt",this.properties.pre_context_prompt,"pre_context_prompt");
		this.post_context_prompt_widget = this.addWidget("text","Post Context Prompt",this.properties.post_context_prompt,"post_context_prompt");
		this.pre_instruction_prompt_widget = this.addWidget("text","Pre Instruction Prompt",this.properties.pre_instruction_prompt,"pre_instruction_prompt");
		this.post_instruction_prompt_widget = this.addWidget("text","Post Instruction Prompt",this.properties.post_instruction_prompt,"post_instruction_prompt");
		this.response_prompt_widget = this.addWidget("text","Response Prompt",this.properties.response_prompt,"response_prompt");


	}
	Prompt_Template_Node.title = "Prompt Template";
	Prompt_Template_Node.prototype.onExecute = function() {
		if(this.getInputData(0) !== undefined) {
			this.pre_constitution_prompt_widget.value = this.getInputData(0);
			this.properties.pre_constitution_prompt = this.getInputData(0);
		}
		if(this.getInputData(1) !== undefined) {
			this.post_constitution_prompt_widget.value = this.getInputData(1);
			this.properties.post_constitution_prompt = this.getInputData(1);
		}
		if(this.getInputData(2) !== undefined) {
			this.pre_goal_prompt_widget.value = this.getInputData(2);
			this.properties.pre_goal_prompt = this.getInputData(2);
		}
		if(this.getInputData(3) !== undefined) {
			this.post_goal_prompt_widget.value = this.getInputData(3);
			this.properties.post_goal_prompt = this.getInputData(3);
		}
		if(this.getInputData(4) !== undefined) {
			this.pre_context_prompt_widget.value = this.getInputData(4);
			this.properties.pre_context_prompt = this.getInputData(4);
		}
		if(this.getInputData(5) !== undefined) {
			this.post_context_prompt_widget.value = this.getInputData(5);
			this.properties.post_context_prompt = this.getInputData(5);
		}
		if(this.getInputData(6) !== undefined) {
			this.pre_instruction_prompt_widget.value = this.getInputData(6);
			this.properties.pre_instruction_prompt = this.getInputData(6);
		}
		if(this.getInputData(7) !== undefined) {
			this.post_instruction_prompt_widget.value = this.getInputData(7);
			this.properties.post_instruction_prompt = this.getInputData(7);
		}
		if(this.getInputData(8) !== undefined) {
			this.response_prompt_widget.value = this.getInputData(8);
			this.properties.response_prompt = this.getInputData(8);
		}
		if(this.getInputData(9) !== undefined) {
			this.properties.constitution = this.getInputData(9);
		}
		if(this.getInputData(10) !== undefined) {
			this.properties.goal = this.getInputData(10);
		}
		if(this.getInputData(11) !== undefined) {
			this.properties.instruction = this.getInputData(11);
		}
		if(this.getInputData(12) !== undefined) {
			this.properties.context = this.getInputData(12);
		}
		
		this.properties.final_prompt = this.properties.pre_constitution_prompt + " " + this.properties.constitution + " " + this.properties.post_constitution_prompt + " " +
										this.properties.pre_goal_prompt + " " + this.properties.goal + " " + this.properties.post_goal_prompt + " " +
										this.properties.pre_context_prompt + " " + this.properties.context + " " + this.properties.post_context_prompt + " " +
										this.properties.pre_instruction_prompt + " " + this.properties.instruction + " " + this.properties.post_instruction_prompt + " " +
										this.properties.response_prompt;

		this.setOutputData(0, this.properties.final_prompt );
	}

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
				//console.log("ingesting chunk: " + chunk);
				//console.log(this.properties.class_key)
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
			
			console.log("querying weaviate with: " + query);
			let response = await weaviateInstance.advancedQuery(this.properties.class_key, query, this.properties.record_count);
			
			console.log(response);
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


		

	// chat log buffer node
	function Chat_Log_Buffer_Node(){
		this.addInput("in_0", "string");
		this.addInput("in_1", "string");
		this.addOutput("buffer", "string");
		// clear buffer button
		this.addInput("clear", LiteGraph.ACTION);
		this.addWidget("button","Clear Buffer","", ()=>{
			this.memory_buffer = [];
			this.last_0_memory = "";
			this.last_1_memory = "";

			this.setOutputData(0, "" );
		});
		//add log buffer button
		this.addWidget("button", "Log", "", ()=>{
			//console.log("logging")
			console.log(this.memory_buffer);
		});
		this.properties = { 
			buffer_size: 10,
			prefix_0: "",
			prefix_1: ""
		 };
		this.text_widget = this.addWidget("number","Buffer Size",this.properties.buffer_size, "buffer_size", {precision:0, step:10});
		
		this.last_0_memory = "";
		this.last_1_memory = "";
		this.memory_buffer = [];
	}
	Chat_Log_Buffer_Node.title = "Chat Buffer";
	Chat_Log_Buffer_Node.prototype.onExecute = function() {

		// if 0 or 1 is not undefined, and 0 and 1 are different from last memory, add to buffer
		if(this.getInputData(0) !== undefined && this.last_0_memory !== this.getInputData(0)) {
			// add to buffer
			this.memory_buffer.push( this.getInputData(0));
			// if buffer is too big, remove oldest memory
			if(this.memory_buffer.length > this.properties.buffer_size) {
				this.memory_buffer.shift();
			}
			this.last_0_memory = this.getInputData(0);
		}

		if(this.getInputData(1) !== undefined && this.last_1_memory !== this.getInputData(1)) {
			// add to buffer
			this.memory_buffer.push( this.getInputData(1));
			// if buffer is too big, remove oldest memory
			if(this.memory_buffer.length > this.properties.buffer_size) {
				this.memory_buffer.shift();
			}
			this.last_1_memory = this.getInputData(1);
		}		
		
		// join memory buffer into one string separated by newlines (using join or map or something)
		let buffer_string = this.memory_buffer.join("\n");
		this.setOutputData(0, buffer_string );
	}
	Chat_Log_Buffer_Node.prototype.onAction = function(action, param) {
		if(action == "clear") {
			this.memory_buffer = [];
			this.last_0_memory = "";
			this.last_1_memory = "";

			this.setOutputData(0, "" );
		}
	}

	// file to text node
	// interrupt node
	function Interrupt_Node(){
		this.addInput("main", "string");
		this.addInput("interrupt", "string");
		this.addOutput("out", "string");
		this.properties = { 
			last_interrupt: "",
			
		 };
		this.text_widget = this.addWidget("text","Interrupt Message",this.properties.interrupt_message, "interrupt_message");
	}
	Interrupt_Node.title = "Interrupt";
	Interrupt_Node.prototype.onExecute = function() {
		
		if(this.getInputData(1) !== undefined && this.properties.last_interrupt !== this.getInputData(1)){
			this.properties.last_interrupt = this.getInputData(1);
			this.setOutputData(0, this.properties.last_interrupt);
		} else if(this.getInputData(0) !== undefined) {
			this.setOutputData(0, this.getInputData(0));
		} else {
			this.setOutputData(0, "");
		}
		
	}

	// query text node (text in, query in, text out)
	function Query_Text_Node(){
		this.addInput("text in", "string");
		this.addInput("constitution", "string");
		this.addInput("instruction", "string");
		this.addInput("prompt seed", "string")
		
		this.addOutput("out", "string");
		// add chunk trigger word widget
		this.properties = {
			chunk_trigger_word: "<chunk>",
		};
		this.text_widget = this.addWidget("text","Chunk Word",this.properties.chunk_trigger_word, "chunk_trigger_word");
	}
	Query_Text_Node.title = "Query Text";
	Query_Text_Node.prototype.onExecute = async function() {
        // split input(0) into chunks based on a trigger word like <chunk>
		let text_in = this.getInputData(0);
		let constitution = this.getInputData(1);
		let instruction = this.getInputData(2);
		let prompt_seed = this.getInputData(3);
		let chunks = text_in.split(this.properties.chunk_trigger_word);
		let output = "";

		
        // for each chunk, run it through the LLM with the query in a templatized prompt
		for(let i = 0; i < chunks.length; i++) {
			let pre_chunk_prompt = "<s>[INST] <<SYS>>\n" + constitution + " Chapter: "+chunks[i]+"<</SYS>>\n\n";
			//console.log("CHUNK " + i + ": " + chunks[i])
			// build prompt
			let chunk_prompt = pre_chunk_prompt + "\n\n "+ instruction +" [/INST] " + prompt_seed;
			// call LLM with prompt
			let llm_response = await call_llm(chunk_prompt, llm_server);
			output += llm_response;
			//console.log(llm_response)
		}
		// output the string
		this.setOutputData(0, output);
	}

	function Llama_Node() {
		this.addInput("constitution", "string");
		this.addInput("instruction", "string");
		this.addInput("prompt seed", "string");
		this.addOutput("out", "string");
		// server URL widget
		this.properties = {
			server_url: llm_server,
			model_selection: "llama",
			model_values: "llama;hermes;falcon;gpt3"
		};
		let that = this;
		this.text_widget = this.addWidget("text","Server URL",this.properties.server_url, "server_url");
		// add model selection widget, llama, falcon, or gpt3
		this.model_selection_widget = this.addWidget("combo","", this.properties.model_selection, function(v){
			that.properties.model_selection = v;
		}, { property: "model_selection", values: this.properties.model_values.split(";") } );

	}
	Llama_Node.title = "Llama LLM";
	Llama_Node.prototype.onExecute = async function() {
		let constitution = this.getInputData(0);
		let instruction = this.getInputData(1);
		let prompt_seed = "";
		if(this.getInputData(2) !== undefined) {
			prompt_seed = this.getInputData(2);
		}

		this.properties.model_selection = this.model_selection_widget.value;
		let query = "";
		switch(this.properties.model_selection) {
			case "llama":
				query = "<s>[INST] <<SYS>>\n"
				 + constitution 
				 + "\n<</SYS>>\n\n" 
				 + instruction + " [/INST] " + prompt_seed;
				break;
			case "falcon":
				query = "System: " + constitution + "\nUser: " + instruction + "\nFalcon: " + prompt_seed;
				break;
			case "hermes":
				query = "Below is an instruction that describes a task. Write a response that appropriately completes the request."
				+ "\n\n### Instruction:\n" 
				+ constitution + "\n"
				+ instruction + "\n\n### Response:" + prompt_seed;
				break;
			default:
				query=""
				break;
		}
		
		
		let llm_response = await call_llm(query, this.properties.server_url);
		
		this.setOutputData(0, llm_response);
	}

	function Llama_Node_With_Memory() {
		this.addInput("constitution", "string");
		this.addInput("instruction", "string");
		this.addInput("prompt seed", "string");
		this.addInput("chat buffer", "string"); // chat buffer should be in json format where the first item is the user message and the second item is the model response and they alternate
		this.addOutput("out", "string");
		this.addOutput("chat buffer", "string"); // json strig of chat buffer
		this.addOutput("latest pair", "string"); // latest pair of chat buffer (user message, model response
		// server URL widget
		this.properties = {
			server_url: llm_server,
			chat_buffer: [],
			last_buffer_input: ""
		};

		this.text_widget = this.addWidget("text","Server URL",this.properties.server_url, "server_url");
		// clear buffer button
		this.addInput("clear", LiteGraph.ACTION);
		this.addWidget("button","Clear Buffer","", ()=>{
			this.properties.chat_buffer = [];
			this.properties.last_buffer_input = "";
			this.setOutputData(1, JSON.stringify(this.properties.chat_buffer));
		});

	}
	Llama_Node_With_Memory.title = "Llama LLM With Memory";
	Llama_Node_With_Memory.prototype.onExecute = async function() {
		let constitution = this.getInputData(0);
		let instruction = this.getInputData(1);
		let prompt_seed = ""
		if(this.getInputData(2) !== undefined) {
			prompt_seed = this.getInputData(2);
		}


		// if input(3) is not undefined and is different from last_buffer_input, replace chat buffer with input(3)
		if(this.getInputData(3) !== undefined && this.getInputData(3) !== this.properties.last_buffer_input) {
			this.properties.chat_buffer = JSON.parse(this.getInputData(3));
			this.properties.last_buffer_input = this.getInputData(3);
		}

		let query = "<s>[INST] <<SYS>>\n" + constitution + "\n<</SYS>>\n\n";

		// add chat buffer to query
		// {{ user_msg_1 }} [/INST] {{ model_answer_1 }} </s><s>[INST] {{ user_msg_2 }} [/INST]
		for(let i = 0; i < this.properties.chat_buffer.length; i += 2) {
			if(i !== 0){
				//query
			}
			query += this.properties.chat_buffer[i] + " [/INST] " + this.properties.chat_buffer[i+1]  + "</s><s>[INST]";
		}

		query += instruction + " [/INST]" + prompt_seed;

		console.log("Query: " + query)
		let llm_response = await call_llm(query, this.properties.server_url);

		// add instruction to chat buffer
		this.properties.chat_buffer.push(instruction);
		// add llm response to chat buffer
		this.properties.chat_buffer.push(llm_response);

		// clean buffer
		if(this.properties.chat_buffer.length > 8) {
			this.properties.chat_buffer.shift();
			this.properties.chat_buffer.shift();
		}

		this.setOutputData(0, llm_response);
		this.setOutputData(1, JSON.stringify(this.properties.chat_buffer));
		this.setOutputData(2, JSON.stringify([this.properties.chat_buffer[this.properties.chat_buffer.length - 2], this.properties.chat_buffer[this.properties.chat_buffer.length - 1]]));
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

	function Prompt_Gate_Llama(){
		this.addInput("in", "string");
		this.addInput("context", "string")
		this.addInput("constitution", "string");
	
		this.addOutput("yes", LiteGraph.ACTION);
		this.addOutput("no", LiteGraph.ACTION);
		this.addOutput("yes", "string");
		this.addOutput("no", "string");
		this.addOutput("reasoning", "string");
		this.properties = { 			
			prompt: "",
			url: llm_server,
			reasoning: ""
		 };
		this.text_widget = this.addWidget("text","Prompt",this.properties.prompt, "prompt");
		this.text_widget2 = this.addWidget("text", "Url", this.properties.url, "url")
	}
	Prompt_Gate_Llama.title = "Prompt Gate (Llama)";
	Prompt_Gate_Llama.prototype.onExecute = async function() {
		this.properties.prompt = this.text_widget.value;
		this.properties.url = this.text_widget2.value;

		
		let assembled_prompt = 
			"<s>[INST] <<SYS>>\n" 
			+ this.getInputData(2) 
			+ " context: " 
			+ this.getInputData(1)
			+ " input: "
			+ this.getInputData(0)
			+ "<</SYS>>\n\n"
			+ this.properties.prompt
			+ ". Start your answer with yes or no[/INST] [assistant]";
		let llm_response = await call_llm(assembled_prompt, this.properties.url);
		// does the llm_response(string) text contain "yes"

		console.log(llm_response.toLowerCase())
		this.properties.reasoning = llm_response;
		this.setOutputData(4, llm_response);

		const positive_words = ["yes", "yeah"]

		if(containsWords(positive_words,llm_response.toLowerCase())) {
			console.log("yes")
			this.trigger("yes", this.properties.prompt);
			this.setOutputData(2, this.getInputData(0));
			this.setOutputData(3, "");
		} else {
			this.trigger("no", this.properties.prompt);
			this.setOutputData(2, "");
			this.setOutputData(3, this.getInputData(0));
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
		console.log("concatenating")

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
		
		console.log(this.properties.first + " " + this.properties.last)
		this.setOutputData(0, this.properties.first + " " + this.properties.last );

	}

	//start node
	function Start_Node(){
		this.addInput("start", LiteGraph.ACTION);
		// run button
		this.addWidget("button","Run","", ()=>{
			graph.runStepAsync()
		});
	}
	Start_Node.title = "Start";
	Start_Node.prototype.onAction = function(action, param) {
		if(action == "start") {
			console.log("-----------------Start triggered---------------------")
			graph.runStepAsync()
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
		this.addInput("in", LiteGraph.ACTION);
		this.addOutput("out", "number");
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
		if(action == "in") {
			this.properties.count++;
			this.setOutputData(0, this.properties.count);
			this.count_widget.value = this.properties.count;
		}
	}

	//checklist node, 0 inputs 5 text widgets, text output and trigger output once complete
	function Checklist_Node(){
		this.addInput("in", LiteGraph.ACTION);
		this.addInput("reset", LiteGraph.ACTION);
		this.addOutput("out", LiteGraph.ACTION);
		this.addOutput("text", "string");
		this.properties = {
			"item_0": "",
			"item_1": "",
			"item_2": "",
			"item_3": "",
			"item_4": "",
			"current_item": 0
		};
		this.addWidget("button","Reset","", ()=>{
			this.properties.current_item = 0;
			this.setOutputData(1, "");
			this.current_item_widget.value = this.properties.current_item;
		})
		this.current_item_widget = this.addWidget("text","Current Item",this.properties.current_item, "current_item");

		this.text_widget_0 = this.addWidget("text","Item 0", this.properties.item_0, "item_0");
		this.text_widget_1 = this.addWidget("text","Item 1", this.properties.item_1, "item_1");
		this.text_widget_2 = this.addWidget("text","Item 2", this.properties.item_2, "item_2");
		this.text_widget_3 = this.addWidget("text","Item 3", this.properties.item_3, "item_3");
		this.text_widget_4 = this.addWidget("text","Item 4", this.properties.item_4, "item_4");
	}
	Checklist_Node.title = "Checklist";
	Checklist_Node.prototype.onExecute = function() {
		// gather checklist items
		if(this.text_widget_0.value !== "") {
			this.properties.item_0 = this.text_widget_0.value;
		}
		if(this.text_widget_1.value !== "") {
			this.properties.item_1 = this.text_widget_1.value;
		}
		if(this.text_widget_2.value !== "") {
			this.properties.item_2 = this.text_widget_2.value;
		}
		if(this.text_widget_3.value !== "") {
			this.properties.item_3 = this.text_widget_3.value;
		}
		if(this.text_widget_4.value !== "") {
			this.properties.item_4 = this.text_widget_4.value;
		}

		// set output to current item
		this.setOutputData(1, this.properties["item_" + this.properties.current_item]);
	}
	Checklist_Node.prototype.onAction = function(action, param) {
		if(action == "in") {
			// gather checklist items
			if(this.text_widget_0.value !== "") {
				this.properties.item_0 = this.text_widget_0.value;
			}
			if(this.text_widget_1.value !== "") {
				this.properties.item_1 = this.text_widget_1.value;
			}
			if(this.text_widget_2.value !== "") {
				this.properties.item_2 = this.text_widget_2.value;
			}
			if(this.text_widget_3.value !== "") {
				this.properties.item_3 = this.text_widget_3.value;
			}
			if(this.text_widget_4.value !== "") {
				this.properties.item_4 = this.text_widget_4.value;
			}


			// increment current item
			this.properties.current_item++;
			// set current item widget value
			this.current_item_widget.value = this.properties.current_item;
			// if current item is greater than checklist length, trigger out
			if(this.properties.current_item >= 5) {
				this.trigger("out", this.properties.checklist);
				this.properties.current_item = 6;
			} else {
				// set output to current item
				this.setOutputData(1, this.properties["item_" + this.properties.current_item]);
			}
		}
		if(action == "reset") {
			this.properties.current_item = 0;
			this.setOutputData(1, "");
			this.current_item_widget.value = this.properties.current_item;
		}
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
		console.log("Text input node on execute")
		console.log(this.text_widget.value)
		console.log(this.properties.text)
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
		// out action
		this.addOutput("out", LiteGraph.ACTION);
		// out string
		this.addOutput("out", "string");		
		this.properties = {
			"gate_type": "and",
			"and_output": "0"
		};
		let that = this;
		//widget for gate type
		this.gate_type_widget = this.addWidget("combo","", this.properties.gate_type, function(v){
			that.properties.gate_type = v;
		}, { property: "gate_type", values: ["and", "or", "not", "xor"] } );

		// widget for output selector for and gate, 0, 1, 0 then 1, 1 then 0
		this.and_output_widget = this.addWidget("combo","", "0", function(v){
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

		console.log("GATE NODE: " + in_0 + " " + in_1)
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
					// trigger out
					this.trigger("out", this.properties.gate_type);
				}
				break;
			case "or":
				if(this.getInputData(0) !== undefined || this.getInputData(1) !== undefined) {
					this.setOutputData(0, this.getInputData(0) + " " + this.getInputData(1));
				}
				break;
			case "not":
				if(this.getInputData(0) === undefined) {
					this.setOutputData(0, this.getInputData(1));
				} else {
					this.setOutputData(0, this.getInputData(0));
				}
				break;
			case "xor":
				if(this.getInputData(0) !== undefined && this.getInputData(1) !== undefined) {
					this.setOutputData(0, this.getInputData(0) + " " + this.getInputData(1));
				} else if(this.getInputData(0) !== undefined) {
					this.setOutputData(0, this.getInputData(0));
				} else if(this.getInputData(1) !== undefined) {
					this.setOutputData(0, this.getInputData(1));
				}
				break;
		}
	}

	// JSON_API_Node url input, url widget, 1 output which is a json string
	function JSON_API_Node() {
		this.addInput("url", "string");
		this.addOutput("out", "string");
		this.properties = {
			"url": ""
		};
		this.url_widget = this.addWidget("text","Url",this.properties.url, "url");
	}
	JSON_API_Node.title = "JSON API";
	JSON_API_Node.prototype.onExecute = async function() {
		// update properties
		//see if input is not undefined
		if(this.getInputData(0) !== undefined) {
			this.properties.url = this.getInputData(0);
			// set widget value
			this.url_widget.value = this.getInputData(0);
		} else {
			this.properties.url = this.url_widget.value;
		}
		// set output to json string
		this.setOutputData(0, await getJSON(this.properties.url));
	}

	function Shared_Chat_Buffer_Node(){
		this.eventEmitter = eventEmitter;
		this.addInput("text in", "string");
		this.addInput("input event name", "string");
		this.addInput("output event name", "string");
		this.addInput("max length event name", "string");
		this.addInput("reset event name", "string");

		this.addOutput("text out", "string");
		this.properties = {
			"chat_buffer": [],
			"input_event_key": "",
			"output_event_key": "",
			"max_length_event_key": "",
			"reset_event_key": "",
			"buffer_length": 8,
		};
		this.input_event_name_widget = this.addWidget("text","Input Event Name",this.properties.input_event_key, "input_event_key");
		this.output_event_name_widget = this.addWidget("text","Output Event Name",this.properties.output_event_key, "output_event_key");
		this.max_len_name_widget = this.addWidget("text","Buffer Length Event Name",this.properties.max_length_event_key, "max_length_event_key");
		this.reset_event_name_widget = this.addWidget("text","Reset Event Name",this.properties.reset_event_key, "reset_event_key");
		this.buffer_length_widget = this.addWidget("number","Buffer Length",this.properties.buffer_length, "buffer_length", {precision:0, step:1});
		this.addWidget("button","Clear","", ()=>{
			this.properties.chat_buffer = [];
		})
		// input class name widget

	}
	Shared_Chat_Buffer_Node.title = "Shared Chat Buffer";
	Shared_Chat_Buffer_Node.prototype.onLoad = function(node) {
		this.eventEmitter.on(node.properties.input_event_key, (text)=>{
			console.log("Shared Chat Buffer Node: " + text)
			node.properties.chat_buffer.push(text);
			if(node.properties.chat_buffer.length > node.properties.buffer_length) {
				node.properties.chat_buffer.shift();
			}
		}, node);
		this.eventEmitter.on(node.properties.output_event_key, ()=>{
			node.setOutputData(0, node.properties.chat_buffer);
		}, node);
		this.eventEmitter.on(node.properties.max_length_event_key, (length)=>{
			node.properties.buffer_length = length;
			node.buffer_length_widget.value = length;
		}, node);
		this.eventEmitter.on(node.properties.reset_event_key, ()=>{
			node.properties.chat_buffer = [];
		}, node);
	}
	Shared_Chat_Buffer_Node.prototype.onExecute = function() {
		// reconnect itself in case something happened
		this.onLoad(this);

		// update properties
		if(this.input_event_name_widget.value !== "") {
			this.properties.input_event_key = this.input_event_name_widget.value;
		}
		if(this.output_event_name_widget.value !== "") {
			this.properties.output_event_key = this.output_event_name_widget.value;
		}
		if(this.max_len_name_widget.value !== "") {
			this.properties.max_length_event_key = this.max_len_name_widget.value;
		}
		if(this.reset_event_name_widget.value !== "") {
			this.properties.reset_event_key = this.reset_event_name_widget.value;
		}
		if(this.buffer_length_widget.value !== "") {
			this.properties.buffer_length = this.buffer_length_widget.value;
		}

		// inputs are [text_in: 0, input_event_name: 2, output_event_name: 4, max_length_event_name: 6, reset_event_name: 8]
		// input event name in
		if(this.getInputData(1) !== undefined
		&& this.getInputData(1) !== this.properties.input_event_key
		&& this.getInputData(1) !== "") {
			this.properties.input_event_key = this.getInputData(2);
			// set widget value
			this.input_event_name_widget.value = this.getInputData(2);
		}
		// output event name in
		if(this.getInputData(2) !== undefined
		&& this.getInputData(2) !== this.properties.output_event_key
		&& this.getInputData(2) !== "") {
			this.properties.output_event_key = this.getInputData(4);
			// set widget value
			this.output_event_name_widget.value = this.getInputData(4);
		}
		// max length event name in
		if(this.getInputData(3) !== undefined
		&& this.getInputData(3) !== this.properties.max_length_event_key
		&& this.getInputData(3) !== "") {
			this.properties.max_length_event_key = this.getInputData(7);
			// set widget value
			this.max_len_name_widget.value = this.getInputData(6);
		}
		// reset event name in
		if(this.getInputData(4) !== undefined
		&& this.getInputData(4) !== this.properties.reset_event_key
		&& this.getInputData(4) !== "") {
			this.properties.reset_event_key = this.getInputData(9);
			// set widget value
			this.reset_event_name_widget.value = this.getInputData(8);
		}
		
		// text in
		if(this.getInputData(0) !== undefined
		&& this.getInputData(0) !== this.properties.chat_buffer[this.properties.chat_buffer.length - 1]
		&& this.getInputData(0).trim() !== "") {
			this.properties.chat_buffer.push(this.getInputData(1));
			if(this.properties.chat_buffer.length > this.properties.buffer_length) {
				this.properties.chat_buffer.shift();
			}
		}

		// set output to chat buffer concatenated with new line
		this.setOutputData(0, this.properties.chat_buffer.join("\n"));

	}
	
	// event text receiver node, 0 inputs, 1 output, 1 widget for event name
	function Event_Text_Receiver_Node() {
		this.eventEmmiter = eventEmitter;
		this.addOutput("out", "string");
		this.addInput("event name", "string");
		this.properties = {
			"event_name": ""
		};
		this.event_name_widget = this.addWidget("text","Event Name",this.properties.event_name, "event_name");
	}
	Event_Text_Receiver_Node.title = "Event Text Receiver";
	Event_Text_Receiver_Node.prototype.onLoad = function(node) {
		node.eventEmmiter.on(node.properties.event_name, (text)=>{
			node.setOutputData(0, text);
		}, node);
	}
	Event_Text_Receiver_Node.prototype.onExecute = function() {
		// update properties
		if(this.event_name_widget.value !== "") {
			this.properties.event_name = this.event_name_widget.value;
		}
		// reconnect itself in case something happened
		this.onLoad(this);
	}
	

	/*****************************************************************************************/
	/*****************************************************************************************/

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = {
			Weaviate_Ingest_Node: Weaviate_Ingest_Node,
			Weaviate_Query_Node: Weaviate_Query_Node,
			Chat_Log_Buffer_Node: Chat_Log_Buffer_Node,
			Interrupt_Node: Interrupt_Node,
			Query_Text_Node: Query_Text_Node,
			Llama_Node: Llama_Node,
			Random_Selection_Node: Random_Selection_Node,
			Prompt_Template_Node: Prompt_Template_Node,
			Llama_Node_With_Memory: Llama_Node_With_Memory,
			Text_Node: Text_Node,
			Persona_Template_Node: Persona_Template_Node,
			Llama_Node_With_Memory: Llama_Node_With_Memory,
			Audio_Generation_Node: Audio_Generation_Node,
			Prefix_Text_Node: Prefix_Text_Node,
			Suffix_Text_Node: Suffix_Text_Node,
			Concatenate_Text_Node: Concatenate_Text_Node,
			Start_Node: Start_Node,
			Counter_Node: Counter_Node,
			Checklist_Node: Checklist_Node,
			Prompt_Gate_Llama: Prompt_Gate_Llama,
			Random_Number_Node: Random_Number_Node,
			Text_Input_Node: Text_Input_Node,
			Text_Output_Node: Text_Output_Node,
			Gate:Gate,
			JSON_API_Node: JSON_API_Node,
			Emit_Node: Emit_Node,
			Shared_Chat_Buffer_Node: Shared_Chat_Buffer_Node,
			Event_Text_Receiver_Node: Event_Text_Receiver_Node
		};
	}