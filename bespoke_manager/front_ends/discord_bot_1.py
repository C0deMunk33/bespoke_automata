# This example requires the 'message_content' privileged intent to function.

import discord


class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        print('------')

    async def on_message(self, message):
        print(f'Message from {message.author}: {message.content}')
        # we do not want the bot to reply to itself
        if message.author.id == self.user.id:
            return

        if message.content.startswith('!hello'):
            await message.reply('Hello!', mention_author=True)


intents = discord.Intents.default()
intents.message_content = True

client = MyClient(intents=intents)

# get discord token from .discord_bot_key file
with open('.discord_bot_key', 'r') as f:
    token = f.read()

client.run(token)
