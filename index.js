import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import {
  handlePeakPassButton,
  handlePeakPassSetup,
  peakPassSetupCommand,
  syncPeakPassPanel,
} from "./src/peak-pass.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error("❌ Falta la variable DISCORD_TOKEN.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Peaking conectado como ${readyClient.user.tag}`);
  if (clientId) console.log(`🆔 Application ID: ${clientId}`);

  try {
    const commands = [peakPassSetupCommand.toJSON()];
    if (guildId) {
      const guild = await readyClient.guilds.fetch(guildId);
      await guild.commands.set(commands);
      console.log(`⚡ Comando /peakpass-setup registrado en ${guild.name}.`);
      const panel = await syncPeakPassPanel(guild);
      console.log(`🎨 Panel Peak Pass ${panel.created ? "publicado" : "actualizado"} automáticamente.`);
    } else {
      await readyClient.application.commands.set(commands);
      console.log("🌍 Comando /peakpass-setup registrado globalmente.");
    }
  } catch (error) {
    console.error("No se pudieron registrar los comandos:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "peakpass-setup") {
      await handlePeakPassSetup(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("ppa:")) {
      await handlePeakPassButton(interaction);
    }
  } catch (error) {
    console.error("Error procesando una interacción Peak Pass:", error);

    const response = {
      content: "⚠️ Peak Pass ha encontrado un problema. Inténtalo de nuevo o avisa al staff.",
      components: [],
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response).catch(() => null);
    } else {
      await interaction.reply({ ...response, ephemeral: true }).catch(() => null);
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

client.login(token);
