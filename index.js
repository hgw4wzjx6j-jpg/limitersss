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
//  CONFIG
// ────────────────────────────────────────────────
const REQUIRED_ROLE_ID      = '1465061909668565038';
const HITTER_ROLE_ID        = '1465061911329767477';
const WELCOME_CHANNEL_ID    = '1465062011380437216';

const TRIGGER_CMD           = '+trigger';
const FEE_CMD               = '+fee';
const CONFIRM_CMD           = '+confirm';
const VOUCHES_CMD           = '+vouches';
const SET_VOUCHES_CMD       = '+setvouches';
const AFK_CMD               = '+afk';

// ────────────────────────────────────────────────
//  STORAGE
// ────────────────────────────────────────────────
const feeChoices     = new Set();
const confirmChoices = new Set();
const vouchCounts    = new Map();
const afkUsers       = new Map(); // userId → { originalNickname, reason }

// ────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────
function hasPermission(member) {
  return member?.roles.cache.has(REQUIRED_ROLE_ID);
}

function getVouches(userId) {
  if (!vouchCounts.has(userId)) {
    vouchCounts.set(userId, Math.floor(Math.random() * 4501) + 500);
  }
  return vouchCounts.get(userId);
}

// ────────────────────────────────────────────────
//  READY
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ────────────────────────────────────────────────
//  MESSAGE CREATE – commands + AFK logic
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();
  const member = message.member;
  const userId = message.author.id;

  // ─── AFK removal + welcome back ────────────────────────────────
  if (afkUsers.has(userId)) {
    try {
      const data = afkUsers.get(userId);
      await member.setNickname(data.originalNickname || null);
      afkUsers.delete(userId);

      await message.channel.send(`<@${userId}> welcome back`).catch(() => {});
    } catch (err) {
      console.error('AFK removal failed:', err);
    }
  }

  // ─── AFK ping reply (works for everyone) ────────────────────────
  if (message.mentions.has(userId) && afkUsers.has(userId)) {
    const data = afkUsers.get(userId);
    await message.channel.send(
      `<@${message.author.id}> hello the person you pinged is afk: ${data.reason}`
    ).catch(() => {});
  }

  // ─── Commands below require the role ────────────────────────────
  if (!hasPermission(member)) return;

  // +trigger
  if (content === TRIGGER_CMD) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Scam Notifications')
      .setDescription(
        '🔥 **You Have Been Scammed !!** 🔥\n\n' +
        'We are sad to inform you that you have just been\n' +
        'hitted.\n\n' +
        'You can easily recover by joining us!\n\n' +
        '**1** Find a cross-trade (example: Adopt Me for\n' +
        'MM2).\n\n' +
        '**2** Use our MM server.\n\n' +
        '**3** Scam with the middleman and they will split\n' +
        '50/50 with you. (If they feel nice they might give\n' +
        'the whole hit)\n\n' +
        '**JOIN US !!**\n' +
        '• If you join you will surely get double your profit!\n' +
        '• This will be a good investment in making money.\n' +
        'BUT the only catch is you have to split 50/50 with\n' +
        'the MM - or they might give 100% depending if they\n' +
        'feel nice.'
      )
      .setFooter({ text: 'JOIN US !!' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('join_scam').setLabel('Join').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('reject_scam').setLabel('Reject').setStyle(ButtonStyle.Danger)
      );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // +fee
  else if (content === FEE_CMD) {
    const embed = new EmbedBuilder()
      .setColor(0x1A1A1A)
      .setTitle('MM FEE')
      .setDescription(
        'MM FEE\n\n' +
        '**Thank You For Using Our services**\n' +
        'Your items are currently being held for the time\n' +
        'being.\n\n' +
        'To proceed with the trade, please make the\n' +
        'necessary donations that the MM deserves. We\n' +
        'appreciate your cooperation.\n\n' +
        'Please be patient while a MM will\n' +
        'list a price\n' +
        'Discuss with your trader about\n' +
        'how you would want to do the Fee.\n\n' +
        'Users are able to split the fee\n' +
        'OR manage to pay the full fee if\n' +
        'possible.\n' +
        '(Once clicked, you can\'t redo)'
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('fee_50').setLabel('50% Each').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('fee_100').setLabel('100%').setStyle(ButtonStyle.Danger)
      );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // +confirm
  else if (content === CONFIRM_CMD) {
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setDescription(
        'Hello for confirmation please click yes, if you click\n' +
        'yes it means you confirm and want to continue\n' +
        'trade\n\n' +
        'And click no if you think the trade is not fair and\n' +
        'you dont want to continue the trade'
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('confirm_yes').setLabel('Yes').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('confirm_no').setLabel('No').setStyle(ButtonStyle.Danger)
      );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  }

  // +vouches @user
  else if (content.startsWith(VOUCHES_CMD)) {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Mention a user').catch(() => {});

    const count = getVouches(target.id);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${target.username}'s Vouches`)
      .setDescription(`**Total Vouches:** ${count}\n\nThis user is highly trusted!`)
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: 'Vouch System' });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // +setvouches @user amount
  else if (content.startsWith(SET_VOUCHES_CMD)) {
    const args = message.content.split(/\s+/).slice(1);
    const target = message.mentions.users.first();
    if (!target || args.length < 2) return message.reply('Usage: +setvouches @user amount').catch(() => {});

    const amt = parseInt(args[1]);
    if (isNaN(amt) || amt < 0) return message.reply('Invalid number').catch(() => {});

    vouchCounts.set(target.id, amt);
    await message.channel.send(`Set **${target.username}** vouches to **${amt}**`).catch(console.error);
  }

  // +afk reason (updated)
  else if (content.startsWith(AFK_CMD)) {
    const reason = message.content.slice(AFK_CMD.length).trim() || 'AFK';

    try {
      const currentNick = member.nickname || member.user.username;

      if (afkUsers.has(userId)) {
        return message.reply('You are already AFK').catch(() => {});
      }

      afkUsers.set(userId, { originalNickname: currentNick, reason });

      // Add [AFK] at the end
      const newNick = currentNick.endsWith('[AFK]') ? currentNick : `${currentNick} [AFK]`;
      await member.setNickname(newNick);

      await message.channel.send(`**${member.user.tag} is now AFK**\nReason: ${reason}`).catch(() => {});
    } catch (err) {
      console.error('AFK set failed:', err);
      await message.reply('Could not set AFK (check permissions / nickname length)').catch(() => {});
    }
  }
});

// ────────────────────────────────────────────────
//  BUTTON INTERACTIONS
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferUpdate().catch(() => {});

  const userId = interaction.user.id;
  const member = interaction.member;

  if (interaction.customId === 'join_scam') {
    if (member.roles.cache.has(HITTER_ROLE_ID)) {
      return interaction.followUp({ content: 'You already have the role.', ephemeral: true });
    }

    try {
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.followUp({ content: 'Bot missing Manage Roles permission.', ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(HITTER_ROLE_ID);
      if (!role) return interaction.followUp({ content: 'Role not found.', ephemeral: true });

      if (interaction.guild.members.me.roles.highest.position <= role.position) {
        return interaction.followUp({ content: 'Bot role hierarchy too low.', ephemeral: true });
      }

      await member.roles.add(role);

      await interaction.channel.send(
        `<@${userId}> welcome to our hitting community, make sure to read https://discord.com/channels/1459873714953912508/1465062006238351503 and if you are confused read https://discord.com/channels/1459873714953912508/1465062017118245070 ENJOY!`
      );

      const wc = interaction.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (wc?.isTextBased()) {
        await wc.send(`Hello <@${userId}>, welcome to our hitting community here you can talk and ask for guide.`);
      }

      interaction.followUp({ content: 'Role assigned.', ephemeral: true });
    } catch (err) {
      console.error('Join error:', err);
      interaction.followUp({ content: 'Error assigning role.', ephemeral: true });
    }
  }

  else if (interaction.customId === 'reject_scam') {
    await interaction.channel.send(`<@${userId}> has rejected the offer to become a hitter.`).catch(() => {});
    interaction.followUp({ content: 'Rejected.', ephemeral: true });
  }

  else if (interaction.customId === 'fee_50' || interaction.customId === 'fee_100') {
    if (feeChoices.has(userId)) return interaction.followUp({ content: 'Already chose.', ephemeral: true });
    feeChoices.add(userId);

    const text = interaction.customId === 'fee_50'
      ? `<@${userId}> has choosen to pay 50%`
      : `<@${userId}> has choosen to pay 100%`;

    await interaction.channel.send(text).catch(() => {});
    interaction.followUp({ content: 'Choice recorded.', ephemeral: true });
  }

  else if (interaction.customId === 'confirm_yes' || interaction.customId === 'confirm_no') {
    if (confirmChoices.has(userId)) return interaction.followUp({ content: 'Already answered.', ephemeral: true });
    confirmChoices.add(userId);

    const text = interaction.customId === 'confirm_yes'
      ? `<@${userId}> has confirmed the trade`
      : `<@${userId}> does not wanna continue trade.`;

    await interaction.channel.send(text).catch(() => {});
    interaction.followUp({ content: 'Recorded.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
