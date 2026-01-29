const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');

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
const usedButtons = new Collection();

// ────────────────────────────────────────────────
// READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[${new Date().toUTCString()}] Logged in as ${client.user.tag} | Prefix: ${PREFIX}`);
  console.log(`Node: ${process.version} | d.js: v${require('discord.js').version}`);
});

// ────────────────────────────────────────────────
// MESSAGE CREATE
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // AFK removal
  if (afkUsers.has(message.member.id)) {
    try {
      const data = afkUsers.get(message.member.id);
      await message.member.setNickname(data.originalNickname || null);
      afkUsers.delete(message.member.id);
      message.channel.send(`<@${message.member.id}> welcome back!`).catch(() => {});
    } catch {}
  }

  // AFK ping
  if (message.mentions.has(message.member.id) && afkUsers.has(message.member.id)) {
    const reason = afkUsers.get(message.member.id).reason;
    message.channel.send(`<@${message.author.id}>, <@${message.member.id}> is **AFK**\nReason: ${reason}`).catch(() => {});
  }

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  if (!message.member.roles.cache.has(STAFF_ROLE_ID)) {
    return message.reply('Staff role required.');
  }

  // $cmds
  if (cmd === 'cmds') {
    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('Staff Commands – $ prefix')
      .addFields(
        { name: '$trigger',   value: 'Scam bait / join embed', inline: true },
        { name: '$fee',       value: 'MM fee buttons', inline: true },
        { name: '$confirm',   value: 'Trade yes/no', inline: true },
        { name: '$vouches [@user]', value: 'Show vouches', inline: true },
        { name: '$setvouches @user <num>', value: 'Set vouches', inline: true },
        { name: '$clearvouches @user', value: 'Reset vouches', inline: true },
        { name: '$afk [reason]', value: 'Set AFK status', inline: true },
        { name: '$steal <emoji/sticker> [name]', value: 'Steal emoji/sticker', inline: true },
        { name: '$invites',   value: 'Recruitment / MM role message', inline: true }
      )
      .setFooter({ text: client.user.tag });

    return message.channel.send({ embeds: [embed] });
  }

  // $trigger – using fields to avoid truncation
  if (cmd === 'trigger') {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Scam Notifications')
      .addFields(
        {
          name: 'You Have Been Scammed !! 🔥',
          value: 'You got hit. Join us to recover **double your profit**!',
          inline: false
        },
        {
          name: 'Steps',
          value: '1. Find cross-trade\n2. Use our MM server\n3. Scam → split 50/50 (or 100% sometimes)',
          inline: false
        },
        {
          name: 'Final call',
          value: '**JOIN NOW !!**',
          inline: false
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_scam').setLabel('Join').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reject_scam').setLabel('Reject').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // $fee – fields
  if (cmd === 'fee') {
    const embed = new EmbedBuilder()
      .setColor(0x1A1A1A)
      .setTitle('MIDDLEMAN FEE')
      .addFields(
        {
          name: 'Current status',
          value: 'Items are held by the middleman.',
          inline: false
        },
        {
          name: 'Fee options',
          value: '• 50% Each (recommended)\n• 100% (one side pays full)',
          inline: false
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fee_50').setLabel('50% Each').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('fee_100').setLabel('100% Full').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // $confirm – fields
  if (cmd === 'confirm') {
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('Trade Confirmation')
      .addFields(
        { name: 'Instructions', value: 'Click Yes to proceed\nClick No to cancel', inline: false }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('confirm_no').setLabel('No').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // $invites – fields to prevent half text
  if (cmd === 'invites') {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('You have been recruited')
      .addFields(
        {
          name: 'Message',
          value: 'Hello, you have been recruited.',
          inline: false
        },
        {
          name: 'Middleman role – 3 choices',
          value: '1. Buy it with money/ltc.\n2. Hit 10 people and show Schior.\n3. Recruit 10 people and make them join our hitting community.',
          inline: false
        },
        {
          name: 'Requirement',
          value: 'Make sure to read middleman rules as you will be tested later on.',
          inline: false
        }
      )
      .setFooter({ text: client.user.tag });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
    return;
  }

  // $vouches
  if (cmd === 'vouches') {
    const target = message.mentions.users.first() || message.author;
    let count = vouchCounts.get(target.id) ?? Math.floor(Math.random() * 4501) + 500;
    vouchCounts.set(target.id, count);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${target.username}'s Vouches`)
      .addFields(
        { name: 'Total', value: `${count}`, inline: true },
        { name: 'Status', value: 'Trusted member', inline: true }
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    await message.channel.send({ embeds: [embed] });
    return;
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
    return;
  }

  // $clearvouches
  if (cmd === 'clearvouches') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Mention a user');
    vouchCounts.delete(target.id);
    message.reply(`Cleared vouches for **${target.username}**`);
    return;
  }

  // $afk
  if (cmd === 'afk') {
    const reason = args.join(' ').trim() || 'AFK';
    try {
      if (afkUsers.has(message.member.id)) return message.reply('You are already AFK.');
      const original = message.member.nickname || message.member.user.username;
      afkUsers.set(message.member.id, { originalNickname: original, reason });
      await message.member.setNickname(`${original} [AFK]`);
      message.reply(`**${message.member.user.tag}** is now AFK • Reason: ${reason}`);
    } catch (err) {
      message.reply('Failed to set AFK (missing permissions?)');
      console.error(err);
    }
    return;
  }

  // $steal
  if (cmd === 'steal') {
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
      return message.reply('Bot missing **Manage Emojis and Stickers** permission.');
    }

    if (args.length === 0) return message.reply('Usage: $steal <emoji or sticker> [name]');

    const nameArg = args[1] ? args[1].replace(/[^a-z0-9_]/gi, '').slice(0, 32) : 'stolen';
    let url = null;
    let isSticker = false;
    let finalName = nameArg;

    const emojiMatch = content.match(/<a?:[a-zA-Z0-9_]+:(\d+)>/);
    if (emojiMatch) {
      const id = emojiMatch[1];
      const animated = content.includes('<a:');
      url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=4096`;
    }
    else if (message.stickers.size > 0) {
      const sticker = message.stickers.first();
      url = sticker.url;
      isSticker = true;
      finalName = nameArg || sticker.name?.replace(/[^a-z0-9_]/gi, '') || 'stolen';
    }

    if (!url) return message.reply('No emoji/sticker detected. Paste it or reply to one.');

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
          file: buffer,
          name: finalName
        });
        message.reply(`Emoji **:${emoji.name}:** added! ${emoji}`);
      }
    } catch (err) {
      console.error(err);
      let reply = 'Upload failed. ';
      if (err.message.includes('size')) reply += 'File too large.';
      else if (err.message.includes('boost')) reply += 'Needs server boost.';
      else if (err.message.includes('limit')) reply += 'Limit reached.';
      else reply += err.message;
      message.reply(reply);
    }
    return;
  }

  message.reply('Unknown command. Use $cmds');
});

// ────────────────────────────────────────────────
// BUTTONS
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferUpdate().catch(() => {});

  const msgId = interaction.message.id;
  const userId = interaction.user.id;

  if (!usedButtons.has(msgId)) usedButtons.set(msgId, new Set());
  const used = usedButtons.get(msgId);

  if (used.has(userId)) {
    return interaction.followUp({ content: 'Already used.', ephemeral: true });
  }
  used.add(userId);

  try {
    if (interaction.customId === 'join_scam') {
      await interaction.member.roles.add(HITTER_ROLE_ID);
      await interaction.channel.send(`<@${userId}> → Welcome! Check rules.`);
      const wc = interaction.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (wc?.isTextBased()) wc.send(`Hello <@${userId}>`).catch(() => {});
      interaction.followUp({ content: 'Role added', ephemeral: true });
    }
    else if (interaction.customId === 'reject_scam') {
      await interaction.channel.send(`<@${userId}> rejected.`);
      interaction.followUp({ content: 'Rejected', ephemeral: true });
    }
    else if (interaction.customId === 'fee_50') {
      await interaction.channel.send(`<@${userId}> chose **50% each**`);
      interaction.followUp({ content: 'Saved', ephemeral: true });
    }
    else if (interaction.customId === 'fee_100') {
      await interaction.channel.send(`<@${userId}> chose **100% full**`);
      interaction.followUp({ content: 'Saved', ephemeral: true });
    }
    else if (interaction.customId === 'confirm_yes') {
      await interaction.channel.send(`<@${userId}> **confirmed**`);
      interaction.followUp({ content: 'Saved', ephemeral: true });
    }
    else if (interaction.customId === 'confirm_no') {
      await interaction.channel.send(`<@${userId}> **declined**`);
      interaction.followUp({ content: 'Saved', ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    interaction.followUp({ content: 'Failed (permissions?)', ephemeral: true });
  }
});

// ─── LOGIN ───
if (!process.env.TOKEN) {
  console.error('No TOKEN set in env variables.');
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error('Login error:', err);
  process.exit(1);
});
