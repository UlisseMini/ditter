import os
import discord
import json

from dotenv import load_dotenv
load_dotenv()


def s(x):
    "str(x) but str(None) = None"
    return str(x) if x else None


def serialize_message(message: discord.Message) -> dict:
    assert isinstance(message.channel, discord.TextChannel)
    assert isinstance(message.author, discord.Member)
    assert message.guild

    author = message.author
    activity = author.activity
    return {
        'content': message.clean_content,
        'guild': message.guild.name,
        'channel': message.channel.name,
        'created_at': s(message.created_at),
        'attachments': [s(a) for a in message.attachments],

        # ids are useful for making links to messages, etc
        'id': s(message.id),
        'author_id': s(message.author.id),
        'guild_id': s(message.guild.id),
        'channel_id': s(message.channel.id),

        # embeds are used by bots, or social media posts
        'embeds': [{
            'title': embed.title,
            'description': embed.description,
            'url': embed.url,
        } for embed in message.embeds ],

        # author
        'author': {
            'name': author.name,
            'hash': author.discriminator,
            'bot': author.bot,

            # discord.Member only properties
            'nick': author.nick,
            'joined_at': s(author.joined_at),
            'color': s(author.color),
            # idk what this is, not being used yet
            # 'accent_color': s(author.accent_color) if author.accent_color else None,
            'avatar': s(author.avatar),
            # TODO: Figure out why this isn't working (always returns offline, wrong intents?)
            'status': s(author.status), # dnd, online, etc
            # TODO: Get this working? has been null for every message so far
            'activities': [a.name for a in author.activities],
            'activity': {
                'name': activity.name,
                'type': activity.type,
                # 'timestamps': dict(activity.timestamps),
            } if activity else None
        },

    }

def pretty_message(m: dict) -> str:
    attachments = '\n' + '\n'.join(m["attachments"]) if len(m["attachments"]) > 0 else ''
    author = m["author"]
    return f'[{m["guild"]} {m["channel"]}] {author["name"]}#{author["hash"]}: {m["content"]}{attachments}'

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
