const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────
const STAFF_ROLE_ID = '1465061909668565038';
const PREFIX = '$';

// Only keep AFK if you still want it (optional – can be removed too)
const afkUsers = new Map();

// ────────────────────────────────────────────────
// READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[${new Date().toUTCString()}] Logged in as ${client.user.tag} | Prefix: ${PREFIX}`);
});

// ────────────────────────────────────────────────
// MESSAGE CREATE – ONLY $invites + basic AFK
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // Optional: AFK removal on any message
  if (afkUsers.has(message.member.id)) {
    try {
      const data = afkUsers.get(message.member.id);
      await message.member.setNickname(data.originalNickname || null);
      afkUsers.delete(message.member.id);
      message.channel.send(`<@${message.member.id}> welcome back!`).catch(() => {});
    } catch {}
  }

  // Optional: AFK ping response
  if (message.mentions.has(message.member.id) && afkUsers.has(message.member.id)) {
    const reason = afkUsers.get(message.member.id).reason;
    message.channel.send(`<@${message.author.id}>, <@${message.member.id}> is **AFK**\nReason: ${reason}`).catch(() => {});
  }

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const member = message.member;

  // Only staff can use $invites
  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return message.reply('You need the staff role to use this command.');
  }

  // ONLY COMMAND LEFT: $invites
  if (cmd === 'invites') {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('You have been recruited')
      .setDescription(
        "Hello, you have been recruited, if you are looking for middleman role, you have 3 choices.\n" +
        "1. Buy it with money/ltc.\n" +
        "2. Hit 10 people and show Schior.\n" +
        "3. Recruit 10 people and make them join our hitting community.\n\n" +
        "Make sure to read middleman rules as you will be tested later on."
      )
      .setFooter({ text: client.user.tag });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
    return;
  }

  // If someone tries any other command
  message.reply('Only $invites is available. Type $invites to use it.');
});

// ─── LOGIN ───
if (!process.env.TOKEN) {
  console.error('ERROR: No TOKEN environment variable set. Add it in Railway variables.');
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
