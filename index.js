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

// ────────────────────────────────────────────────
// READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[${new Date().toUTCString()}] Logged in as ${client.user.tag} | Prefix: ${PREFIX}`);
});

// ────────────────────────────────────────────────
// MESSAGE CREATE – ONLY $invites
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const member = message.member;

  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return message.reply('You need the staff role to use this command.');
  }

  if (cmd === 'invites') {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('You have been recruited')
      .setDescription(
        "Hello, you have been recruited, if you are looking for middleman role, you have 3 choices.\n" +
        "1. Buy it with money/ltc.\n" +
        "2. Hit 10 people and show Schior.\n" +
        "3. Recruit 10 people and make them join our hitting community.\n\n" +
        "Make sure to read middleman rules as you will be tested later on.\n\n" +
        "**Make sure to read https://discord.com/channels/1459873714953912508/1465062017118245070 and https://discord.com/channels/1459873714953912508/1465062006238351503**"
      )
      .setFooter({ text: client.user.tag });

    await message.channel.send({ embeds: [embed] }).
