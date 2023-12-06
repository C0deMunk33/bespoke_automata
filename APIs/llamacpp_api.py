#
from llama_cpp import Llama
llm = Llama(model_path="./wizard-mega-13B.ggmlv3.q4_0.bin", n_ctx=10000, n_gpu_layers=100, chat_format="chatml")

llm.create_chat_completion(
      messages = [
          {"role": "system", "content": "You are an assistant who perfectly describes images."},
          {
              "role": "user",
              "content": "Describe this image in detail please."
          }
      ]
)

