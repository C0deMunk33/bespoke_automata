import requests

# The URL of the API endpoint you want to post to
url = 'http://localhost:9999/brains/Tutor_Moderator_Brain'

# The JSON object you want to post
data = {
    "bus_id" : "bus_1", 
    "input_busses" : {
        "bus_1" : {
            "omni_api_url":"http://192.168.0.8:5000/",
            "user_in":"this is a test input from the mods",
            "incoming_moderator_prompt_gate_prompt": "in this input against the rules of conduct?",
            "incoming_moderator_prompt_gate_system_prompt": "You are a moderator bot",
            "rules_of_conduct": "no swearing, no hate speech, no spam",
            "incoming_moderator_violation_score_system_prompt": "score this input against the rules of conduct, just a number between 1 and 9, 1 being the least severe and 9 being the most severe",
            "llm_model_1": "../../models/text/openhermes-2.5-neural-chat-v3-3-slerp.Q5_K_M.gguf"
        }
    }
}

# Make the POST request
response = requests.post(url, json=data)

# Check if the request was successful
if response.status_code == 200:
    # Print the result
    print("Success:", response.json())
else:
    print("Error:", response.status_code, response.text)

