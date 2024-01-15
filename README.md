# bespoke_automata

!!!READ CAREFULLY, INSTALLATION IS NOT STREAMLINED !!!


## how to install/run BA and it's stack:
* have CUDA stack running, drivers updated, NVCC working etc
* clone repo https://github.com/C0deMunk33/bespoke_automata
* npm run start
* work through installing the modules until it works

### Llama:
* LINUX: `CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python`
* WINDOWS: `$env:CMAKE_ARGS = "-DLLAMA_CUBLAS=on"` then `pip install llama-cpp-python`
* `cd bespoke_automata/APIs/`
* `python llama_api.py`
* work through pip installs until it works
* the server will be `your_ip:5000`
* endpoint acts like GPT (and defaults to GPT, but that may be broken)

### Simple Vector DB:
* `cd bespoke_automata/APIs/`
* `python simple_vector_db_api.py`
* work through any pip installs
* endpoint will be `your_ip:4999`

### Back end:
* save brain to `bespoke_automata/bespoke_manager/graphs`
* cd `bespoke_automata/bespoke_manager/`
* `node server.js`
* run through any NPM install issues
* Brains will be `your_ip:9999`
* `your_ip:9999/brains` will list brains
* `your_ip:9999/brains/[brain filename sans extension]` is brain endpoint
* `your_ip:9999/brains/[brain filename sans extension]/schema` shows IO params for that brain

### DEMO Brains:
* `./bespoke_manager/graphs`
