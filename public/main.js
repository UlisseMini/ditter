// This file must be loaded after markdownit and highlight.js

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

function cssColor(color) {
  // default for "no color" is black for some reason, should be white (on dark theme that is)
  return "color: " + (color === "#000000" ? "#eeeeee" : color);
}

const avatar = (author) => {
  const link =
    author.guild_avatar || author.avatar || author.default_avatar || "null";
  // TODO: inline image, right size
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
  // TODO: Make emoji display inline block (img is block by default rn)
  content.replace(
    /<:(\w+):(\d+)>/,
    "![$1](https://cdn.discordapp.com/emojis/$2.webp?size=44&quality=lossless)"
  );

const rot13 = (s) =>
  // why write code when SO exists? https://stackoverflow.com/a/28049798 :)
  s.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
    );
  });

// preprocess markdown
// TODO: Put this into `md.render` somehow via a plugin
const preprocess = (s) => {
  if (document.location.hostname === "localhost") {
    // so I don't get distracted while developing, lol
    s = rot13(s);
  }

  return emojify(s);
};

// TODO: Don't hardcode Today here
const humanTime = (d) => (d ? `Today at ${d.toLocaleTimeString()}` : "");

const fullTime = (d) => (d ? `${d.toLocaleString()}` : "");

function messageEl(m, invites) {
  const channelHref = `https://discord.com/channels/${m.guild_id}/${m.channel_id}`;
  const messageHref = `${channelHref}/${m.id}`;
  const images = m.attachments.map((url) => attachmentEl(url));
  const created_at = new Date(m.created_at);

  return h("div", { class: `message g-${m.guild}` }, [
    h("a", { class: "guild", href: invites[m.guild] }, [m.guild]),
    h("a", { class: "channel", href: messageHref }, [m.channel]),
    h("div", { class: "message-header" }, [
      h("img", { class: "avatar", src: avatar(m.author) }),
      h("div", { class: "name", style: cssColor(m.author.color) }, [
        m.author.name,
      ]),
      h("time", { datetime: m.created_at, title: fullTime(created_at) }, [
        humanTime(created_at),
      ]),
    ]),
    h("div", { class: "content" }, [
      h("div", {
        class: "messageContent",
        _html: md.render(preprocess(m.content)),
      }),
      h("div", {
        class: "embedContent",
        // currently we only show embed content from bots
        _html: md.render(preprocess(embedsMd(m.author.bot ? m.embeds : []))),
      }),
    ]),
    ...images,
  ]);
}

const getStyleSheet = (title) => {
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i];
    if (sheet.title === title) {
      return sheet;
    }
  }
};

// Delete the first css rule with selector 'selector'
const deleteBySelector = (sheet, selector) => {
  for (let i = 0; i < sheet.cssRules.length; i++) {
    const rule = sheet.cssRules[i];
    if (rule.selectorText === selector) {
      sheet.deleteRule(i);
      break;
    }
  }
};

const setHidden = (className, hidden) => {
  const sheet = getStyleSheet("dynamic");
  const selector = "." + className;
  if (hidden) {
    sheet.insertRule(`${selector} { display: none; }`);
  } else {
    deleteBySelector(sheet, selector);
  }
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
      checkbox(guild, (e) => setHidden(`g-${guild}`, !e.target.checked))
    ),
  ]);
  document.body.appendChild(feedForm);

  // create messagesEl and append recent messages
  const messagesEl = h("div", { class: "messages" });
  let messages = await (await fetch("/recents")).json();
  messages.forEach((m) => {
    messagesEl.prepend(messageEl(m, invites));
  });
  document.body.appendChild(messagesEl);

  // connect to websocket
  const ws = websocket("/subscribe");
  ws.onopen = () => {
    connectionStatus.textContent = `Connected`;
    console.log(`connected to /subscribe`);
  };
  ws.onclose = () => {
    connectionStatus.textContent = `Disconnected, refresh?`;
    console.log(`disconnected from /subscribe`);
  };
  ws.onerror = (e) => console.error(e);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    messagesEl.prepend(messageEl(m, invites));
    messages.push(m);
    if (messages.length > 1000) {
      messages = messages.slice(1);
    }
  };
});
