import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ────────────────────────────────────────────────
//  KEYS & STORAGE
// ────────────────────────────────────────────────
const ALLOWED_KEYS = [
  'WEEK-2026-01-25-EXP-2026-02-01-ghA1th0ll4h-k3y-x7p9q2',
  'MONTH-2026-01-25-EXP-2026-02-25-gha1thollah-k3y-m0nth-v8r4z',
  'YEAR-2026-01-25-EXP-2027-01-25-ghaithollah-k3y-y34r-t6w9m',
  'LIFETIME-ghaithollah-permanent-k3y-l1f3t1m3-2026-forever-z9k2n'
];

const guildSetup = new Map();     // guildId → { keyValidated: bool }
const guildConfig = new Map();    // guildId → { staffRoleId, hitterRoleId, welcomeChannelId }
const feeChoices = new Set();
const confirmChoices = new Set();
const vouchCounts = new Map();
const afkUsers = new Map();       // userId → { originalNickname, reason }

function isKeyValid(key) {
  if (key.startsWith('LIFETIME')) return true;
  const parts = key.split('-');
  if (parts.length < 5) return false;
  const exp = new Date(`${parts[5]}-${parts[6]}-${parts[7]}`);
  return !isNaN(exp) && new Date() <= exp;
}

// ────────────────────────────────────────────────
//  READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ────────────────────────────────────────────────
//  MESSAGE CREATE
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();
  const args = content.split(/\s+/);
  const cmd = args[0].toLowerCase();
  const guildId = message.guild?.id;
  const member = message.member;
  if (!guildId) return;

  const setup = guildSetup.get(guildId) || { keyValidated: false };
  const config = guildConfig.get(guildId) || {};

  // AFK removal + welcome back
  if (afkUsers.has(member.id)) {
    try {
      await member.setNickname(afkUsers.get(member.id).originalNickname || null);
      afkUsers.delete(member.id);
      await message.channel.send(`<@${member.id}> welcome back`).catch(() => {});
    } catch {}
  }

  // AFK ping reply
  if (message.mentions.has(member.id) && afkUsers.has(member.id)) {
    await message.channel.send(
      `<@${message.author.id}> hello the person you pinged is afk: ${afkUsers.get(member.id).reason}`
    ).catch(() => {});
  }

  // Setup & config commands (admin only)
  if (cmd === '+setup') {
    if (!member.permissions.has('Administrator')) return message.reply('Admins only');
    const key = args[1];
    if (!key || !ALLOWED_KEYS.includes(key) || !isKeyValid(key)) {
      return message.reply('Invalid or expired key');
    }
    guildSetup.set(guildId, { keyValidated: true });
    await message.reply('Valid key! Now set:\n+staff <role_id>\n+hitter <role_id>\n+welcome <channel_id>');
    return;
  }

  if (!setup.keyValidated && ['+staff','+hitter','+welcome','+help'].includes(cmd)) {
    return message.reply('Run +setup <key> first');
  }

  if (cmd === '+staff' && member.permissions.has('Administrator')) {
    const roleId = args[1];
    if (!roleId || !/^\d{17,19}$/.test(roleId)) return message.reply('Invalid role ID');
    guildConfig.set(guildId, { ...config, staffRoleId: roleId });
    await message.reply(`Staff role set to ${roleId}`);
  }

  if (cmd === '+hitter' && member.permissions.has('Administrator')) {
    const roleId = args[1];
    if (!roleId || !/^\d{17,19}$/.test(roleId)) return message.reply('Invalid role ID');
    guildConfig.set(guildId, { ...config, hitterRoleId: roleId });
    await message.reply(`Hitter role set to ${roleId}`);
  }

  if (cmd === '+welcome' && member.permissions.has('Administrator')) {
    const channelId = args[1];
    if (!channelId || !/^\d{17,19}$/.test(channelId)) return message.reply('Invalid channel ID');
    guildConfig.set(guildId, { ...config, welcomeChannelId: channelId });
    await message.reply(`Welcome channel set to ${channelId}`);
  }

  // +help
  if (cmd === '+help') {
    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('Bot Setup & Commands Guide')
      .setDescription(
        '**Setup (admin only):**\n' +
        '1. +setup <key> — activate bot\n' +
        '   Keys:\n' +
        '   • WEEK-2026-01-25-EXP-2026-02-01-ghA1th0ll4h-k3y-x7p9q2\n' +
        '   • MONTH-2026-01-25-EXP-2026-02-25-gha1thollah-k3y-m0nth-v8r4z\n' +
        '   • YEAR-2026-01-25-EXP-2027-01-25-ghaithollah-k3y-y34r-t6w9m\n' +
        '   • LIFETIME-ghaithollah-permanent-k3y-l1f3t1m3-2026-forever-z9k2n\n\n' +
        '2. After success:\n' +
        '   +staff <role_id> — who uses commands\n' +
        '   +hitter <role_id> — Join button role\n' +
        '   +welcome <channel_id> — welcome msg channel\n\n' +
        '**Commands (staff only):**\n' +
        '+trigger — scam popup\n' +
        '+fee — fee prompt\n' +
        '+confirm — trade confirm\n' +
        '+vouches @user — show vouches\n' +
        '+setvouches @user <num> — set vouches\n' +
        '+afk <reason> — go AFK'
      )
      .setFooter({ text: 'Keys are case-sensitive' });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // Require staff role for all other commands
  if (!config.staffRoleId || !member.roles.cache.has(config.staffRoleId)) return;

  // +trigger (example – add your full embed/row here)
  if (cmd === '+trigger') {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Scam Notifications')
      .setDescription('your full scam text here...');
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('join_scam').setLabel('Join').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('reject_scam').setLabel('Reject').setStyle(ButtonStyle.Danger)
      );
    await message.channel.send({ embeds: [embed], components: [row] });
  }

  // ... add your +fee, +confirm, +vouches, +setvouches, +afk blocks here ...
  // replace any fixed IDs with config.hitterRoleId, config.welcomeChannelId, etc.
});

// ────────────────────────────────────────────────
//  BUTTONS (use guild config)
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferUpdate().catch(() => {});

  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const config = guildConfig.get(guildId) || {};

  if (interaction.customId === 'join_scam') {
    if (!config.hitterRoleId) return interaction.followUp({ content: 'Server not configured', ephemeral: true });
    if (interaction.member.roles.cache.has(config.hitterRoleId)) {
      return interaction.followUp({ content: 'Already has role', ephemeral: true });
    }

    try {
      const role = interaction.guild.roles.cache.get(config.hitterRoleId);
      if (!role) return interaction.followUp({ content: 'Role not found', ephemeral: true });

      await interaction.member.roles.add(role);

      await interaction.channel.send(`<@${interaction.user.id}> welcome to our hitting community...`);

      const wc = interaction.guild.channels.cache.get(config.welcomeChannelId);
      if (wc?.isTextBased()) {
        await wc.send(`Hello <@${interaction.user.id}>, welcome...`);
      }

      interaction.followUp({ content: 'Role assigned', ephemeral: true });
    } catch (err) {
      interaction.followUp({ content: 'Error', ephemeral: true });
    }
  }

  // ... add your fee/confirm/reject button logic here ...
});

client.login(process.env.DISCORD_TOKEN);
