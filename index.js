import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, PermissionsBitField } from 'discord.js';
import fetch from 'node-fetch';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────
const STAFF_ROLE_ID      = '1465061909668565038';
const HITTER_ROLE_ID     = '1465061911329767477';
const WELCOME_CHANNEL_ID = '1465062011380437216';
const PREFIX             = '$';

// Storage
const vouchCounts = new Map();
const afkUsers    = new Map();
const usedButtons = new Collection(); // messageId → Set<userId>

// ────────────────────────────────────────────────
// READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[${new Date().toUTCString()}] Logged in as ${client.user.tag} | Prefix: ${PREFIX}`);
  console.log(`Node version: ${process.version} | discord.js v${client.constructor.version}`);
});

// ────────────────────────────────────────────────
// MESSAGE CREATE
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // AFK removal on any message
  if (afkUsers.has(message.member.id)) {
    try {
      const data = afkUsers.get(message.member.id);
      await message.member.setNickname(data.originalNickname || null);
      afkUsers.delete(message.member.id);
      message.channel.send(`<@${message.member.id}> welcome back!`).catch(() => {});
    } catch {}
  }

  // AFK ping response
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

  // Staff-only below this point
  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return message.reply('You need the staff role to use commands.');
  }

  // $cmds
  if (cmd === 'cmds') {
    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('Staff Commands – Prefix $')
      .setDescription(
        '`$trigger`   → Scam join embed\n' +
        '`$fee`       → MM fee buttons\n' +
        '`$confirm`   → Trade yes/no\n' +
        '`$vouches [@user]` → Show vouches\n' +
        '`$setvouches @user <num>` → Set vouches\n' +
        '`$clearvouches @user` → Reset vouches\n' +
        '`$afk [reason]` → Set AFK status\n' +
        '`$steal <emoji or sticker> [name]` → Copy to server'
      )
      .setFooter({ text: client.user.tag });

    return message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // $trigger
  if (cmd === 'trigger') {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Scam Notifications')
      .setDescription(
        '🔥 **You Have Been Scammed !!** 🔥\n\n' +
        'You got hit. Join us to recover double your profit!\n\n' +
        '1. Find cross-trade\n' +
        '2. Use our MM server\n' +
        '3. Scam → split 50/50 (or 100% sometimes)\n\n' +
        '**JOIN NOW !!**'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_scam').setLabel('Join').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reject_scam').setLabel('Reject').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // $fee
  if (cmd === 'fee') {
    const embed = new EmbedBuilder()
      .setColor(0x1A1A1A)
      .setTitle('MIDDLEMAN FEE')
      .setDescription(
        'Items are held.\nChoose how to handle the fee:\n\n' +
        '• 50% Each (recommended)\n' +
        '• 100% (you pay full)'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fee_50').setLabel('50% Each').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('fee_100').setLabel('100% Full').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // $confirm
  if (cmd === 'confirm') {
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setDescription('**Trade Confirmation**\nClick Yes to proceed\nClick No to cancel');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('confirm_no').setLabel('No').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // $vouches
  if (cmd === 'vouches') {
    const target = message.mentions.users.first() || message.author;
    let count = vouchCounts.get(target.id) ?? Math.floor(Math.random() * 4501) + 500;
    vouchCounts.set(target.id, count);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${target.username}'s Vouches`)
      .setDescription(`**Total:** ${count}\nTrusted member`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    await message.channel.send({ embeds: [embed] });
  }

  // $setvouches
  if (cmd === 'setvouches') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[0]);
    if (!target || isNaN(amount) || amount < 0) {
      return message.reply('Usage: $setvouches @user <number>');
    }
    vouchCounts.set(target.id, amount);
    message.reply(`Set **${target.username}** vouches to **${amount}**`);
  }

  // $clearvouches
  if (cmd === 'clearvouches') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Mention a user');
    vouchCounts.delete(target.id);
    message.reply(`Cleared vouches for **${target.username}** (random next time)`);
  }

  // $afk
  if (cmd === 'afk') {
    const reason = args.join(' ').trim() || 'AFK';
    try {
      if (afkUsers.has(member.id)) return message.reply('You are already AFK.');
      const original = member.nickname || member.user.username;
      afkUsers.set(member.id, { originalNickname: original, reason });
      await member.setNickname(`${original} [AFK]`);
      message.reply(`**${member.user.tag}** is now AFK • Reason: ${reason}`);
    } catch (err) {
      message.reply('Failed to set AFK (bot missing Manage Nicknames permission?)');
      console.error(err);
    }
  }

  // $steal
  if (cmd === 'steal') {
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
      return message.reply('Bot is missing **Manage Emojis and Stickers** permission.');
    }

    if (args.length === 0) return message.reply('Usage: $steal <emoji or sticker> [new-name]');

    const nameArg = args[1] ? args[1].replace(/[^a-z0-9_]/gi, '').slice(0, 32) : 'stolen';
    let url = null;
    let isSticker = false;
    let finalName = nameArg;

    // Emoji
    const emojiMatch = content.match(/<a?:[a-zA-Z0-9_]+:(\d+)>/);
    if (emojiMatch) {
      const id = emojiMatch[1];
      const animated = content.includes('<a:');
      url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=4096`;
    }
    // Sticker
    else if (message.stickers.size > 0) {
      const sticker = message.stickers.first();
      url = sticker.url;
      isSticker = true;
      finalName = nameArg || sticker.name?.replace(/[^a-z0-9_]/gi, '') || 'stolen';
    }

    if (!url) return message.reply('Could not detect emoji or sticker. Paste it directly or reply to a message containing one.');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      if (isSticker) {
        const sticker = await message.guild.stickers.create({
          file: buffer,
          name: finalName.slice(0, 30),
          description: 'Added via $steal'
        });
        message.reply(`Sticker **${sticker.name}** added!\n${sticker.url}`);
      } else {
        const emoji = await message.guild.emojis.create({
          attachment: buffer,
          name: finalName
        });
        message.reply(`Emoji **:${emoji.name}:** added! ${emoji}`);
      }
    } catch (err) {
      console.error(err);
      let reply = 'Failed to upload. ';
      if (err.message.includes('size')) reply += 'File too large (emoji ≤256KB, sticker ≤512KB).';
      else if (err.message.includes('boost')) reply += 'Server needs boost level 1+ for stickers.';
      else if (err.message.includes('limit')) reply += 'Server reached emoji/sticker limit.';
      else reply += `Error: ${err.message}`;
      message.reply(reply);
    }
  }
});

// ────────────────────────────────────────────────
// BUTTON HANDLER
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferUpdate().catch(() => {});

  const msgId = interaction.message.id;
  const userId = interaction.user.id;

  if (!usedButtons.has(msgId)) usedButtons.set(msgId, new Set());
  const used = usedButtons.get(msgId);

  if (used.has(userId)) {
    return interaction.followUp({ content: 'You already used a button on this message.', ephemeral
