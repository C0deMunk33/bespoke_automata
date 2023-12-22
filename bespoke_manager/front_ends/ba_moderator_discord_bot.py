import discord
import requests
import asyncio
bot_brain_name = 'BA_Moderator'

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

class BA_Moderator_Client(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.inference_queue = InferenceQueue()
        

    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        print('------')
        self.loop.create_task(self.run_moderation_loop())

    async def run_moderation_loop(self):
        await self.wait_until_ready()
        while not self.is_closed():
            message = self.inference_queue.pop()
            if message is not None:
                url = f'http://192.168.0.61:9999/brains/{bot_brain_name}'
                body = {
                    'user_in': f"user {message.author} said: {message.content}",
                    'chat_buffer': "This is a chat room",
                    'user_id': f"{message.author.id}",
                }
                print(body)
                reply = requests.post(url, json=body)
                print(reply.json())
                # post to discord #bot_brain_dumps channel
                await self.get_channel(1187561115933221057).send("-------------------------------------")
                await self.get_channel(1187561115933221057).send(f"User {message.author} said: {message.content}")
                await self.get_channel(1187561115933221057).send(reply.json())
                
            await asyncio.sleep(1)

    async def on_message(self, message):
        await self.wait_until_ready()
        print(f'Message from {message.author}: {message.content}')
        print(f'Channel: {message.channel}')

        if(message.channel.name != "private_bot_test" 
           and message.channel.name != "agent_playground" ):
            return;
        # we do not want the bot to reply to itself
        if message.author.id == self.user.id:
            return

        # add message to inference queue
        self.inference_queue.add(message)

intents = discord.Intents.default()
intents.message_content = True

client = BA_Moderator_Client(intents=intents)

with open('.discord_ba_moderator_key', 'r') as f:
    token = f.read()
print(token)
client.run(token)