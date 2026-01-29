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
// CONFIGURATION SECTION - DO NOT CHANGE UNLESS YOU KNOW WHAT YOU'RE DOING
// ────────────────────────────────────────────────
const STAFF_ROLE_ID      = '1465061909668565038';          // The role ID that allows staff to use all prefix commands
const HITTER_ROLE_ID     = '1465061911329767477';         // Role given when someone clicks "Join" on the scam embed
const WELCOME_CHANNEL_ID = '1465062011380437216';         // Channel where new hitters get a welcome message
const PREFIX             = '$';                           // Command prefix - change if you want something else

// In-memory storage (lost on restart - add database later if you want persistence)
const vouchCounts = new Map();                            // userID → vouch count
const afkUsers    = new Map();                            // userID → {originalNickname, reason}
const usedButtons = new Collection();                     // messageID → Set<userIDs who already clicked>

// ────────────────────────────────────────────────
// BOT READY EVENT - STARTUP LOGS
// ────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[${new Date().toUTCString()}] Bot successfully logged in as ${client.user.tag}`);
  console.log(`Prefix currently set to: ${PREFIX}`);
  console.log(`Running on Node.js version: ${process.version}`);
  console.log(`discord.js library version: v${require('discord.js').version}`);
});

// ────────────────────────────────────────────────
// MAIN MESSAGE HANDLER - ALL COMMANDS LIVE HERE
// ────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;                         // Ignore other bots
  if (!message.guild) return;                             // Ignore DMs

  // Automatically remove AFK status when user sends any message
  if (afkUsers.has(message.member.id)) {
    try {
      const userData = afkUsers.get(message.member.id);
      await message.member.setNickname(userData.originalNickname || null);
      afkUsers.delete(message.member.id);
      message.channel.send(`<@${message.member.id}> welcome back! You're no longer AFK.`).catch(() => {});
    } catch (err) {
      console.error('Failed to remove AFK nickname:', err);
    }
  }

  // Reply when someone pings an AFK user
  if (message.mentions.has(message.member.id) && afkUsers.has(message.member.id)) {
    const afkData = afkUsers.get(message.member.id);
    message.channel.send(`<@${message.author.id}>, <@${message.member.id}> is currently **AFK**\nReason: ${afkData.reason}`).catch(() => {});
  }

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const member = message.member;

  // All commands below require the staff role
  if (!member.roles.cache.has(STAFF_ROLE_ID)) {
    return message.reply('You do not have permission to use staff commands. You need the staff role.');
  }

  // ── $cmds ── Shows the full list of available staff commands with descriptions
  if (cmd === 'cmds') {
    const embed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle('Staff Commands List – Prefix is $')
      .setDescription(
        'Here are all the commands only staff members can use:\n\n' +
        '`$trigger`     → Sends the full "You Have Been Scammed" recruitment / scam bait embed with Join/Reject buttons\n' +
        '`$fee`         → Sends the middleman fee selection embed with 50% / 100% buttons\n' +
        '`$confirm`     → Sends a simple trade confirmation embed with Yes/No buttons\n' +
        '`$vouches [@user]` → Displays the vouch count for the mentioned user (or yourself if no mention)\n' +
        '`$setvouches @user <number>` → Manually set a specific vouch count for any user\n' +
        '`$clearvouches @user` → Completely remove all stored vouches for the mentioned user\n' +
        '`$afk [optional reason]` → Sets your nickname to show AFK status and records the reason\n' +
        '`$steal <emoji or sticker> [optional new name]` → Steals / copies an emoji or sticker from another server into this one\n' +
        '`$invites`     → Sends the full recruitment/middleman role explanation message to the channel'
      )
      .setFooter({ text: `Bot: ${client.user.tag} • Staff only` });

    return message.channel.send({ embeds: [embed] }).catch(console.error);
  }

  // ── $trigger ── FULL LONG VERSION OF THE SCAM BAIT / RECRUITMENT EMBED
  if (cmd === 'trigger') {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Scam Notifications – Urgent Alert')
      .setDescription(
        '🔥 **You Have Been Scammed !!** 🔥\n\n' +
        'You got hit. You lost your items/money in a trade scam.\n' +
        'Join us right now to recover **double your profit** and get revenge!\n\n' +
        '**How it works – follow these exact steps:**\n' +
        '1. Find a cross-trade opportunity (people trading across servers)\n' +
        '2. Use our trusted Middleman (MM) server to secure the deal\n' +
        '3. After you scam successfully → we split the profit 50/50 (sometimes you can keep 100% if agreed)\n\n' +
        '**This is your chance – do not miss it!**\n' +
        '**JOIN NOW !! JOIN NOW !! JOIN NOW !!**'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_scam').setLabel('Join the Community').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reject_scam').setLabel('Reject / Not Interested').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // ── $fee ── FULL MIDDLEMAN FEE SELECTION
  if (cmd === 'fee') {
    const embed = new EmbedBuilder()
      .setColor(0x1A1A1A)
      .setTitle('MIDDLEMAN FEE DECISION – IMPORTANT')
      .setDescription(
        'The middleman is currently holding the items/money for this trade.\n\n' +
        'Both parties must now decide how to handle the middleman fee:\n\n' +
        '• **50% Each** (recommended and fairest option) – both buyer and seller pay half the fee\n' +
        '• **100% Full** – one side pays the entire fee (usually the one requesting the MM)\n\n' +
        'Click one of the buttons below to make your choice. The other party will be notified of your selection.'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fee_50').setLabel('50% Each – Recommended').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('fee_100').setLabel('100% Full – I Pay Everything').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // ── $confirm ── FULL TRADE CONFIRMATION
  if (cmd === 'confirm') {
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('TRADE CONFIRMATION REQUIRED')
      .setDescription(
        '**Final Trade Confirmation**\n\n' +
        'Please read everything carefully before proceeding.\n' +
        '• All items and payment details have been verified by the middleman\n' +
        '• Once both sides confirm, the trade will be released\n' +
        '• There are NO refunds after confirmation\n\n' +
        '**Click Yes to proceed with the trade**\n' +
        '**Click No to cancel / back out of the deal**'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_yes').setLabel('Yes – Proceed & Release').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('confirm_no').setLabel('No – Cancel Trade').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    return;
  }

  // ── $invites ── FULL RECRUITMENT / MIDDLEMAN REQUIREMENTS MESSAGE
  if (cmd === 'invites') {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('You have been recruited – Welcome to the team')
      .setDescription(
        "Hello, you have been personally recruited to join our community.\n\n" +
        "If you are looking to obtain the **middleman role** (which comes with serious responsibilities and privileges), " +
        "you currently have **exactly 3 possible paths** to earn it:\n\n" +
        "1. **Buy the middleman role directly** – pay with real money, Litecoin (LTC), or other agreed cryptocurrency.\n" +
        "   Contact an admin for current pricing and payment instructions.\n\n" +
        "2. **Hit / scam 10 people successfully** – complete 10 verified hits/scams and provide clear proof (screenshots, videos, logs) " +
        "directly to Schior for review and approval.\n\n" +
        "3. **Recruit 10 new active members** – bring in 10 people who actually join our hitting community, participate, " +
        "and stay active (just invites without activity do not count).\n\n" +
        "**Important final note:** No matter which path you choose, you **MUST** read and fully understand the middleman rules document. " +
        "You will be tested on these rules later — failing the test means you will not receive the role even if you completed one of the requirements."
      )
      .setFooter({ text: "Choose wisely • Good luck in the game" });

    await message.channel.send({ embeds: [embed] }).catch(console.error);
    return;
  }

  // All other commands remain the same as in your original version
  // $vouches, $setvouches, $clearvouches, $afk, $steal ...

  if (cmd === 'vouches') {
    const target = message.mentions.users.first() || message.author;
    let count = vouchCounts.get(target.id) ?? Math.floor(Math.random() * 4501) + 500;
    vouchCounts.set(target.id, count);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${target.username}'s Vouch Statistics`)
      .setDescription(`**Total Vouches Recorded:** ${count}\nThis user is considered a trusted member of the community.`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    await message.channel.send({ embeds: [embed] });
    return;
  }

  // ... (rest of commands unchanged - $setvouches, $clearvouches, $afk, $steal)

  message.reply('Unknown staff command. Type $cmds to see the full list again.');
});

// Button interactions remain exactly the same
client.on('interactionCreate', async interaction => {
  // ... (your original button handler code here - no changes needed)
});

// Login logic
if (!process.env.TOKEN) {
  console.error('CRITICAL ERROR: TOKEN environment variable is missing.');
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error('Discord login failed:', err);
  process.exit(1);
});
