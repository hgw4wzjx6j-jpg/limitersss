import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType, SlashCommandBuilder, REST, Routes } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ────────────────────────────────────────────────
//  SETTINGS & KEYS
// ────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;

const ALLOWED_KEYS = [
  'WEEK-2026-01-25-EXP-2026-02-01-ghA1th0ll4h-k3y-x7p9q2',
  'MONTH-2026-01-25-EXP-2026-02-25-gha1thollah-k3y-m0nth-v8r4z',
  'YEAR-2026-01-25-EXP-2027-01-25-ghaithollah-k3y-y34r-t6w9m',
  'LIFETIME-ghaithollah-permanent-k3y-l1f3t1m3-2026-forever-z9k2n'
];

const guildConfigs = new Map(); // guildId → {hitterRoleId, welcomeChannelId, staffRoleId}

const DEFAULTS = {
  hitterRoleId: '1465061911329767477',
  welcomeChannelId: '1465062011380437216',
  staffRoleId: '1465061909668565038'
};

function isKeyValid(key) {
  if (key.startsWith('LIFETIME')) return true;
  const parts = key.split('-');
  if (parts.length < 5) return false;
  const expStr = `${parts[5]}-${parts[6]}-${parts[7]}`;
  const exp = new Date(expStr);
  return !isNaN(exp.getTime()) && new Date() <= exp;
}

function getConfig(guildId) {
  return guildConfigs.get(guildId) || DEFAULTS;
}

function hasStaffPermission(member, guildId) {
  return member?.roles.cache.has(getConfig(guildId).staffRoleId);
}

// ────────────────────────────────────────────────
//  READY + REGISTER SLASH
// ────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Configure bot for this server')
      .addStringOption(o => o.setName('key').setDescription('Activation key').setRequired(true))
      .addRoleOption(o => o.setName('hitter_role').setDescription('Role given on Join').setRequired(true))
      .addChannelOption(o => o.setName('welcome_channel').setDescription('Welcome message channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(o => o.setName('staff_role').setDescription('Role that can use commands').setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('Slash commands registered');
});

// ────────────────────────────────────────────────
//  SLASH HANDLER (/setup)
// ────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setup') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Admins only', ephemeral: true });
    }

    const key = interaction.options.getString('key');
    if (!ALLOWED_KEYS.some(k => k === key && isKeyValid
