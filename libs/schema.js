
const chat_history_class_name = "ChatHistory";

const chatHistoryProperties = [
    {
        "name": "message",
        "dataType": ["string"]
    },
    {
        "name": "timestamp",
        "dataType": ["number"]
    },
    {
        "name": "party_id",
        "dataType": ["string"]
    },
    {
        "name": "counterparty_id",
        "dataType": ["string"]
    }
]


const preloaded_facts_class_name = "PreloadedFacts";

const preloadedFactProperties = [
    {
        "name": "fact",
        "dataType": ["string"]
    },
    {
        "name": "timestamp",
        "dataType": ["number"]
    },
    {
        "name": "party_id",
        "dataType": ["string"]
    }
]

const goals_class_name = "Goals";

const goalProperties = [
    {
        "name": "goal",
        "dataType": ["string"]
    },
    {
        "name": "timestamp",
        "dataType": ["number"]
    },
    {
        "name": "party_id",
        "dataType": ["string"]
    },
    {
        "name": "completed",
        "dataType": ["boolean"]
    }
]

const internal_thoughts_class_name = "InternalThoughts";

const internalThoughtProperties = [
    {
        "name": "thought",
        "dataType": ["string"]
    },
    {
        "name": "timestamp",
        "dataType": ["number"]
    },
    {
        "name": "party_id",
        "dataType": ["string"]
    }
]

const websites_class_name = "Websites";

const websiteProperties = [
    {
        "name": "url",
        "dataType": ["string"]
    },
    {
        "name": "text",
        "dataType": ["string"]
    },
    {
        "name": "timestamp",
        "dataType": ["number"]
    },
    {
        "name": "party_id",
        "dataType": ["string"]
    }
];

const schema = [
    {
        "class": chat_history_class_name,
        "description": "Chat history of the user",
        "properties": chatHistoryProperties
    },
    {
        "class": preloaded_facts_class_name,
        "description": "Facts that are preloaded into the system",
        "properties": preloadedFactProperties
    },
    {
        "class": goals_class_name,
        "description": "Goals that the bot has set",
        "properties": goalProperties
    },
    {
        "class": internal_thoughts_class_name,
        "description": "Internal thoughts of the bot",
        "properties": internalThoughtProperties
    },
    {
        "class": websites_class_name,
        "description": "Websites that the bot has visited",
        "properties": websiteProperties
    }
]