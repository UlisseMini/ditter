// Must be loaded after markdownit and highlight.js

const md = window.markdownit({
  html: false, // security!
  linkify: true,
  breaks: true, // \n -> <br>
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }

    return ""; // use external default escaping
  },
});

function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs["_html"] != null) {
    el.innerHTML = attrs["_html"];
    delete attrs["_html"];
  }

  for (const attr in attrs) {
    if (attr.startsWith("on")) {
      el.addEventListener(attr.slice(2), attrs[attr]);
    } else {
      el.setAttribute(attr, attrs[attr]);
    }
  }
  if (children) children.forEach((child) => el.append(child));

  return el;
}

function checkbox(name, onchange) {
  return h("div", {}, [
    h("input", {
      type: "checkbox",
      id: `checkbox-${name}`,
      checked: "",
      onchange,
    }),
    h("label", { for: `checkbox-${name}` }, [name]),
  ]);
}

function attachmentEl(url) {
  if (url.match(/\.(mp4|mov|webm|mkv)$/)) {
    return h("video", { src: url });
  } else {
    return h("img", { src: url });
  }
}

const hiddenGuild = {};

function cssColor(color) {
  // default for "no color" is black for some reason, should be white (on dark theme that is)
  return "color: " + (color === "#000000" ? "#eeeeee" : color);
}

const avatar = (link) => {
  // TODO: handle no link
  link = link || "";
  // TODO: do this properly
  return link.replace(/\?size=\d+/, "") + "?size=80";
};

// embed to markdown
const embedMd = (embed) => {
  let md = "";
  if (embed.title) md += `**${embed.title}**\n`;
  if (embed.description) md += embed.description;
  return md;
};

const embedsMd = (embeds) => (embeds || []).map(embedMd).join("\n\n");

const emojify = (content) =>
  // <:Hmmmm:928586668787785728> -> ![Hmmmm](https://cdn.discordapp.com/emojis/928586668787785728.webp?size=44&quality=lossless)
  // TODO: Handle animated emoji
  content.replace(
    /<:(\w+):(\d+)>/,
    "![$1](https://cdn.discordapp.com/emojis/$2.webp?size=44&quality=lossless)"
  );

// for dev, I get distracted reading messages, this is for focus.
const rot13 = (s) =>
  // why write code when SO exists? https://stackoverflow.com/a/28049798 :)
  s.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
    );
  });

function messageEl(m, invites) {
  const channelHref = `https://discord.com/channels/${m.guild_id}/${m.channel_id}`;
  const messageHref = `${channelHref}/${m.id}`;
  const images = m.attachments.map((url) => attachmentEl(url));
  const style = `display: ` + (hiddenGuild[m.guild] ? "none" : "");

  return h("div", { class: `message g-${m.guild}`, style: style }, [
    h("a", { class: "guild", href: invites[m.guild] }, [m.guild]),
    h("a", { class: "channel", href: messageHref }, [m.channel]),
    h("div", { class: "author" }, [
      h("img", { class: "avatar", src: avatar(m.author.avatar) }),
      h("div", { class: "name", style: cssColor(m.author.color) }, [
        m.author.name,
      ]),
    ]),
    h("div", { class: "content" }, [
      h("div", {
        class: "messageContent",
        _html: md.render(emojify(rot13(m.content))),
      }),
      h("div", {
        class: "embedContent",
        // currently we only show embed content from bots
        _html: md.render(embedsMd(m.author.bot ? m.embeds : [])),
      }),
    ]),
    ...images,
  ]);
}

const get = (k) => JSON.parse(localStorage.getItem(k));
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const setHidden = (guildName, hidden) => {
  hiddenGuild[guildName] = hidden;
  document.querySelectorAll(`.g-${guildName}`).forEach((el) => {
    el.style.display = hidden ? "none" : "";
  });
};

function websocket(relativePath) {
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  const ws = new WebSocket(protocol + window.location.host + relativePath);
  return ws;
}

document.addEventListener("DOMContentLoaded", async () => {
  const connectionStatus = document.getElementById("connection-status");
  connectionStatus.textContent = "Connecting...";

  // get invites, i.e. invites[guild] = "<invite link to guild>"
  const invites = await (await fetch("/invites")).json();

  // append feed hiding form to body
  const feedForm = h("form", {}, [
    ...Object.keys(invites).map((guild) =>
      checkbox(guild, (e) => setHidden(guild, !e.target.checked))
    ),
  ]);
  document.body.appendChild(feedForm);

  // create messagesEl and append cached messages
  const messagesEl = h("div", { class: "messages" });
  let messages = get("messages") || [];
  messages.forEach((m) => {
    messagesEl.prepend(messageEl(m, invites));
  });
  document.body.appendChild(messagesEl);

  // connect to websocket
  const ws = websocket("/subscribe");
  ws.onopen = () => {
    connectionStatus.textContent = `Connected`;
    console.log(`connected to ${relativePath}`);
  };
  ws.onclose = () => {
    connectionStatus.textContent = `Disconnected, refresh?`;
    console.log(`disconnected from ${relativePath}`);
  };
  ws.onerror = (e) => console.error(e);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    messagesEl.prepend(messageEl(m, invites));
    messages.push(m);
    if (messages.length > 100) {
      messages = messages.slice(1);
    }
    set("messages", messages);
  };
});
