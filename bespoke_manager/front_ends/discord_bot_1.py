# This example requires the 'message_content' privileged intent to function.

import discord
import requests
bot_brain_name = 'Assistant_Brain_2'

class InferenceQueue:
    def __init__(self):
        self.queue = []
    def add(self, item):
        self.queue.append(item)
    def pop(self):
        if len(self.queue) > 0:
            return self.queue.pop(0)
        else:
            return None
    def __len__(self):
        return len(self.queue)
    def __str__(self):
        return str(self.queue)

class MyClient(discord.Client):
    # constructor
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # load graph
        self.inference_queue = InferenceQueue()

    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        print('------')


    async def on_message(self, message):
        await self.wait_until_ready()
        print(f'Message from {message.author}: {message.content}')
        # we do not want the bot to reply to itself
        if message.author.id == self.user.id:
            return

        #if message.content.startswith('!hello'):
        # get JSON via POST message to http://localhost:9999/{bot_brain_name}
        # message needs to be passed as user_input, reply comes back as agent_response, JSON
        url = f'http://192.168.0.61:9999/brains/{bot_brain_name}'
       
        reply = requests.post(url, 
                                json={
                                    'value': f"user {message.author} said: {message.content}",
                                    'name': "user_in"})
        reply_text = reply.json()[0]['value'].strip()
        reason = reply.json()[1]['value'].strip()

        print("Reason: ")
        print(reason)
        if reply_text != 'None' or reply_text != "":
            await message.reply(reply_text, mention_author=False)
            
        #await (self.get_channel(message.channel.id)).send(reply.json()[0]['value'])
        

intents = discord.Intents.default()
intents.message_content = True

client = MyClient(intents=intents)

# get discord token from .discord_bot_key file
with open('.discord_bot_key', 'r') as f:
    token = f.read()

client.run(token)
