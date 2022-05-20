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
  if (attrs["_html"]) {
    el.innerHTML = attrs["_html"];
    delete attrs["_html"];
  }

  for (const attr in attrs) el.setAttribute(attr, attrs[attr]);
  if (children) children.forEach((child) => el.append(child));

  return el;
}

function attachmentEl(url) {
  if (url.match(/\.(mp4|mov|webm|mkv)$/)) {
    return h("video", { src: url });
  } else {
    return h("img", { src: url });
  }
}

function messageEl(m, invites) {
  const channelHref = `https://discord.com/channels/${m.guild_id}/${m.channel_id}`;
  const messageHref = `${channelHref}/${m.id}`;
  const images = m.attachments.map((url) => attachmentEl(url));
  return h("div", { class: "message" }, [
    h("a", { class: "guild", href: invites[m.guild] }, [m.guild]),
    h("a", { class: "channel", href: messageHref }, [m.channel]),
    h("div", { class: "author" }, [m.author]),
    h("div", { class: "content", _html: md.render(m.content) }),
    ...images,
  ]);
}

const get = (k) => JSON.parse(localStorage.getItem(k));
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function onMessage(m, messagesEl, invites) {
  messagesEl.prepend(messageEl(m, invites));
}

document.addEventListener("DOMContentLoaded", async () => {
  const messages = get("messages") || [];

  const messagesEl = h("div", { class: "messages" });
  document.body.appendChild(messagesEl);

  const invites = await (await fetch("/invites")).json();

  messages.forEach((m) => onMessage(m, messagesEl, invites));

  const ws = new WebSocket(
    (window.location.protocol === "https:" ? "wss://" : "ws://") +
      window.location.host +
      "/subscribe"
  );
  ws.onopen = () => console.log("connected to /subscribe");
  ws.onclose = () => console.log("disconnected from /subscribe"); // TODO: retry
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    onMessage(m, messagesEl, invites);
    messages.push(m);
    if (messages.length > 100) {
      messages = messages.slice(10);
    }
    set("messages", messages);
  };
});
