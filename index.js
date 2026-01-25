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
//  FIXED CONFIG (no more setup/keys)
// ────────────────────────────────────────────────
const STAFF_ROLE_ID = '1465061909668565038';    // change if needed
const HITTER_ROLE_ID = '1465061911329767477';
const WELCOME_CHANNEL_ID = '1465062011380437216';

// Storage
const feeChoices = new Set();
const confirmChoices = new Set();
const vouchCounts = new Map();
const afkUsers = new Map();

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
  const member = message.member;

  // AFK removal
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

  // Require staff role for all commands
  if (!member.roles.cache.has(STAFF_ROLE_ID)) return;

  // +cmds – new command listing everything
  if (cmd === '+cmds') {
    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('Available Commands')
      .setDescription(
        '**Staff Commands:**\n\n' +
        '`+trigger` → Sends the scam notification embed with Join/Reject buttons\n' +
        '`+fee` → Sends the MM fee/donation embed with 50%/100% buttons\n' +
        '`+confirm` → Sends the trade confirmation embed with Yes/No buttons\n' +
        '`+vouches @user` → Shows fake vouch count for the mentioned user\n' +
        '`+setvouches @user <number>` → Sets a custom vouch count for the user\n' +
        '`+afk <reason>` → Sets your nickname to [AFK] + reason, removes when you type\n' +
        '`+cmds` → Shows this command list\n\n' +
        '**How buttons work:**\n' +
        '- Join → gives hitter role + sends welcome messages\n' +
        '- Reject → announces rejection\n' +
        '- Fee buttons → announces who chose 50% or 100%\n' +
        '- Confirm buttons → announces confirmation or decline\n\n' +
        'All commands require the staff role.'
      )
      .setFooter({ text: 'Bot commands • Staff only' });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // +trigger
  if (cmd === '+trigger') {
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
  if (cmd === '+fee') {
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
  if (cmd === '+confirm') {
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
  if (cmd === '+vouches') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Mention a user');

    const count = vouchCounts.get(target.id) || Math.floor(Math.random() * 4501) + 500;
    vouchCounts.set(target.id, count);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${target.username}'s Vouches`)
      .setDescription(`**Total Vouches:** ${count}\n\nThis user is highly trusted!`)
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: 'Vouch System' });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // +setvouches @user amount
  if (cmd === '+setvouches') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[2]);
    if (!target || isNaN(amount) || amount < 0) return message.reply('Usage: +setvouches @user <number>');

    vouchCounts.set(target.id, amount);
    await message.reply(`Set **${target.username}** vouches to **${amount}**`).catch(() => {});
  }

  // +afk reason
  if (cmd === '+afk') {
    const reason = content.slice(5).trim() || 'AFK';
    try {
      const current = member.nickname || member.user.username;
      if (afkUsers.has(member.id)) return message.reply('You are already AFK');

      afkUsers.set(member.id, { originalNickname: current, reason });
      await member.setNickname(`${current} [AFK]`);
      await message.reply(`**${member.user.tag} is now AFK**\nReason: ${reason}`);
    } catch (err) {
      await message.reply('Could not set AFK (check permissions)').catch(() => {});
    }
  }
});

// ────────────────────────────────────────────────
//  BUTTONS
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  await interaction.deferUpdate().catch(() => {});

  const userId = interaction.user.id;

  if (interaction.customId === 'join_scam') {
    try {
      const role = interaction.guild.roles.cache.get(HITTER_ROLE_ID);
      if (!role) return interaction.followUp({ content: 'Role not found', ephemeral: true });

      await interaction.member.roles.add(role);

      await interaction.channel.send(`<@${userId}> welcome to our hitting community, make sure to read https://discord.com/channels/1459873714953912508/1465062006238351503 and if you are confused read https://discord.com/channels/1459873714953912508/1465062017118245070 ENJOY!`);

      const wc = interaction.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (wc?.isTextBased()) {
        await wc.send(`Hello <@${userId}>, welcome to our hitting community here you can talk and ask for guide.`);
      }

      interaction.followUp({ content: 'Role assigned', ephemeral: true });
    } catch (err) {
      interaction.followUp({ content: 'Error', ephemeral: true });
    }
  }

  if (interaction.customId === 'reject_scam') {
    await interaction.channel.send(`<@${userId}> has rejected the offer to become a hitter.`).catch(() => {});
    interaction.followUp({ content: 'Rejected', ephemeral: true });
  }

  if (interaction.customId === 'fee_50' || interaction.customId === 'fee_100') {
    if (feeChoices.has(userId)) return interaction.followUp({ content: 'Already chose', ephemeral: true });
    feeChoices.add(userId);

    const text = interaction.customId === 'fee_50'
      ? `<@${userId}> has choosen to pay 50%`
      : `<@${userId}> has choosen to pay 100%`;

    await interaction.channel.send(text).catch(() => {});
    interaction.followUp({ content: 'Recorded', ephemeral: true });
  }

  if (interaction.customId === 'confirm_yes' || interaction.customId === 'confirm_no') {
    if (confirmChoices.has(userId)) return interaction.followUp({ content: 'Already answered', ephemeral: true });
    confirmChoices.add(userId);

    const text = interaction.customId === 'confirm_yes'
      ? `<@${userId}> has confirmed the trade`
      : `<@${userId}> does not wanna continue trade.`;

    await interaction.channel.send(text).catch(() => {});
    interaction.followUp({ content: 'Recorded', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
