import { Client, GatewayIntentBits, Partials, Events, Message } from "discord.js";
import { pgTable, text, integer } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";

// --- Database Schema ---
const roleLimits = pgTable("role_limits", {
  roleId: text("role_id").primaryKey(),
  limitAmount: integer("limit_amount").notNull(),
});

const userUsage = pgTable("user_usage", {
  userId: text("user_id").primaryKey(),
  usageAmount: integer("usage_amount").default(0).notNull(),
});

const botAdmins = pgTable("bot_admins", {
  userId: text("user_id").primaryKey(),
});

// --- Database Initialization ---
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { roleLimits, userUsage, botAdmins } });

// --- Storage Logic ---
const storage = {
  async getRoleLimit(roleId) {
    const [limit] = await db.select().from(roleLimits).where(eq(roleLimits.roleId, roleId));
    return limit;
  },
  async setRoleLimit(roleId, limit) {
    const [result] = await db.insert(roleLimits).values({ roleId, limitAmount: limit })
      .onConflictDoUpdate({ target: roleLimits.roleId, set: { limitAmount: limit } }).returning();
    return result;
  },
  async getUserUsage(userId) {
    const [usage] = await db.select().from(userUsage).where(eq(userUsage.userId, userId));
    return usage;
  },
  async setUserUsage(userId, amount) {
    const [result] = await db.insert(userUsage).values({ userId, usageAmount: amount })
      .onConflictDoUpdate({ target: userUsage.userId, set: { usageAmount: amount } }).returning();
    return result;
  },
  async addToUserUsage(userId, amount) {
    const current = await this.getUserUsage(userId);
    const newAmount = (current?.usageAmount || 0) + amount;
    return this.setUserUsage(userId, newAmount);
  },
  async getAdmin(userId) {
    const [admin] = await db.select().from(botAdmins).where(eq(botAdmins.userId, userId));
    return admin;
  },
  async addAdmin(userId) {
    const [result] = await db.insert(botAdmins).values({ userId }).onConflictDoNothing().returning();
    if (!result) return this.getAdmin(userId);
    return result;
  }
};

// --- Bot Logic ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel, Partials.Message],
});

async function isOwner(userId) {
  const app = await client.application?.fetch();
  return app?.owner?.id === userId;
}

async function isAdmin(userId) {
  if (await isOwner(userId)) return true;
  const admin = await storage.getAdmin(userId);
  return !!admin;
}

client.once(Events.ClientReady, (c) => console.log(`Ready! Logged in as ${c.user.tag}`));

const PREFIX = ".";

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX) || !message.guild) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  try {
    if (command === "limit") {
      if (!(await isAdmin(message.author.id))) return message.reply("❌ Permission Denied.");
      const roleMention = args[0], amount = parseInt(args[1]);
      if (!roleMention || isNaN(amount)) return message.reply("⚠️ Usage: `.limit @Role <amount>`");
      const roleId = roleMention.match(/^<@&?(\d+)>$/)?.[1] || roleMention;
      const role = message.guild.roles.cache.get(roleId);
      if (!role) return message.reply("❌ Role not found.");
      await storage.setRoleLimit(roleId, amount);
      await message.reply({ embeds: [{ color: 0xffcc00, title: "⚙️ System Configuration", description: `Role limits recalibrated for **${role.name}**`, fields: [{ name: "📏 Target Limit", value: `\`${amount}\``, inline: true }], thumbnail: { url: "https://i.imgur.com/p8v0Dk6.gif" }, footer: { text: "Real-time Update applied" } }] });
    } else if (command === "checklimit") {
      let targetId = message.author.id;
      const userIdMatch = args[0]?.match(/^<@!?(\d+)>$/);
      if (userIdMatch) targetId = userIdMatch[1];
      const member = message.guild.members.cache.get(targetId);
      if (!member) return message.reply("Member not found.");
      const userUsageData = await storage.getUserUsage(targetId);
      const usage = userUsageData?.usageAmount || 0;
      let maxLimit = 0, limitingRole = null;
      for (const [roleId, role] of member.roles.cache) {
        const limitRecord = await storage.getRoleLimit(roleId);
        if (limitRecord && limitRecord.limitAmount > maxLimit) { maxLimit = limitRecord.limitAmount; limitingRole = role.name; }
      }
      const userTag = targetId === message.author.id ? "Your" : `<@${targetId}>'s`;
      const percentage = maxLimit > 0 ? Math.min(Math.round((usage / maxLimit) * 100), 100) : 0;
      const progressEmoji = "🟩".repeat(Math.floor(percentage / 10)) + "⬜".repeat(10 - Math.floor(percentage / 10));
      await message.reply({ embeds: [{ color: usage >= maxLimit ? 0xff0000 : 0x0099ff, title: "✨ Premium Limit Status", thumbnail: { url: member.user.displayAvatarURL() }, description: `**${userTag}** current usage profile:`, fields: [{ name: "⚡ Hit Limit", value: `\`${usage}\``, inline: true }, { name: "🏆 Max Limit", value: `\`${maxLimit}\``, inline: true }, { name: "💎 Role Tier", value: limitingRole ? `\`${limitingRole}\`` : "No Role", inline: true }, { name: "📊 Progress Bar", value: `${progressEmoji} \`${percentage}%\``, inline: false }], footer: { text: "System Online • Secure Storage", icon_url: client.user?.displayAvatarURL() }, timestamp: new Date().toISOString() }] });
    } else if (command === "addlimit") {
      if (!(await isAdmin(message.author.id))) return message.reply("❌ Permission Denied.");
      const userMention = args[0], amount = parseInt(args[1]);
      if (!userMention || isNaN(amount)) return message.reply("⚠️ Usage: `.addlimit @User <amount>`");
      const userId = userMention.match(/^<@!?(\d+)>$/)?.[1] || userMention;
      await storage.addToUserUsage(userId, amount);
      const newUsage = await storage.getUserUsage(userId);
      await message.reply(`Has hitted ${amount}$ worth of stuff, Check your limit`);
    } else if (command === "resetlimit") {
      if (!(await isAdmin(message.author.id))) return message.reply("❌ Permission Denied.");
      const userId = args[0]?.match(/^<@!?(\d+)>$/)?.[1] || args[0];
      if (!userId) return message.reply("⚠️ Usage: `.resetlimit @User`");
      await storage.setUserUsage(userId, 0);
      await message.reply({ embeds: [{ color: 0x00ffff, title: "♻️ Limit Reset", description: `Usage for <@${userId}> has been cleared.`, fields: [{ name: "📉 Hit Limit", value: "`0`", inline: true }, { name: "🔄 Status", value: "`Reset Complete`", inline: true }], footer: { text: "Database Sync Complete" } }] });
    } else if (command === "admin") {
      if (!(await isOwner(message.author.id))) return message.reply("Only the bot owner can use this command.");
      const userId = args[0]?.match(/^<@!?(\d+)>$/)?.[1] || args[0];
      if (!userId) return message.reply("Usage: .admin @User");
      await storage.addAdmin(userId);
      await message.reply(`User <@${userId}> is now an admin.`);
    } else if (command === "removelimit") {
      if (!(await isAdmin(message.author.id))) return message.reply("❌ Permission Denied.");
      const userMention = args[0], amount = parseInt(args[1]);
      if (!userMention || isNaN(amount)) return message.reply("⚠️ Usage: `.removelimit @User <amount>`");
      const userId = userMention.match(/^<@!?(\d+)>$/)?.[1] || userMention;
      await storage.addToUserUsage(userId, -amount);
      const newUsage = await storage.getUserUsage(userId);
      await message.reply({
        embeds: [{
          color: 0xff4444,
          title: "➖ Limit Removed",
          description: `Successfully reduced usage for <@${userId}>`,
          fields: [
            { name: "➖ Removed", value: `\`${amount}\``, inline: true },
            { name: "📉 New Hit Limit", value: `\`${newUsage?.usageAmount || 0}\``, inline: true }
          ],
          footer: { text: "Database Sync Complete" }
        }]
      });
    }
  } catch (error) { console.error(error); message.reply("An error occurred."); }
});

client.login(process.env.DISCORD_TOKEN);
