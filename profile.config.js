export default {
  profile: {
    name: "Howaboua",
    handle: "@howaboua",
    avatarUrl: "https://avatars.githubusercontent.com/u/634445?v=4",
    links: {
      x: "https://x.com/howaboua",
      github: "https://github.com/IgorWarzocha",
      website: "https://howaboua.dev",
      linkedin: "https://www.linkedin.com/in/igorwarzocha",
    },
  },
  // Order is deduplication priority. `host: null` means this machine.
  machines: [
    { name: "server", host: null, sessionsDir: "~/.pi/agent/sessions" },
    { name: "desktop", host: process.env.PI_DESKTOP_HOST ?? "desktop", sessionsDir: "~/.pi/agent/sessions" },
    { name: "laptop", host: process.env.PI_LAPTOP_HOST ?? "laptop", sessionsDir: "~/.pi/agent/sessions" },
  ],
};
