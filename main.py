import os
import discord
import json

from dotenv import load_dotenv
load_dotenv()



def serialize_message(message: discord.Message) -> dict:
    assert isinstance(message.channel, discord.TextChannel)
    assert message.guild

    return {
        'author': message.author.name,
        'author_hash': message.author.discriminator,
        'content': message.clean_content,
        'guild': message.guild.name,
        'channel': message.channel.name,
        'author_bot': message.author.bot,
        'created_at': str(message.created_at),
        'attachments': [str(a) for a in message.attachments],

        # ids are useful for making links to messages, etc
        'id': str(message.id),
        'author_id': str(message.author.id),
        'guild_id': str(message.guild.id),
        'channel_id': str(message.channel.id),
    }

def pretty_message(m: dict) -> str:
    attachments = '\n' + '\n'.join(m["attachments"]) if len(m["attachments"]) > 0 else ''
    return f'[{m["guild"]} {m["channel"]}] {m["author"]}#{m["author_hash"]}: {m["content"]}{attachments}'

class MyClient(discord.Client):
    async def on_ready(self):
        print(f"logged in as {self.user}")

    async def on_message(self, message: discord.Message):
        try:
            m = serialize_message(message)
            print(pretty_message(m))
            with open('messages.json', 'a') as f:
                print(json.dumps(m), file=f)
        except AssertionError as e:
            print(e)


intents = discord.Intents.default()
intents.message_content = True
client = MyClient(intents=intents)
client.run(os.environ['TOKEN'])
