import { createHash, randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const BRAND = 0x8b5cf6;
const SUCCESS = 0x23a55a;
const WARNING = 0xf0b232;
const PANEL_BUTTON_ID = "ppa:start";
const SECURITY_BUTTON_ID = "ppa:security";
const SESSION_LIFETIME_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 1000;
const ACCESS_DELAY_SECONDS = 60;

const ROLE_NAMES = {
  access: "✅・Peak Access",
  recent: "🟢・Reciente",
  styles: {
    Chilleando: "😎・Chilleando",
    Competidor: "🏆・Competidor",
    Agresivo: "🔥・Agresivo",
  },
  gameRoles: {
    IGL: "🧠・IGL",
    Fragger: "🎯・Fragger",
    Ambas: "⚡・Polivalente",
  },
};

const sessions = new Map();
const cooldowns = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.state !== "countdown" && session.expiresAt <= now) sessions.delete(key);
  }
  for (const [key, endsAt] of cooldowns) {
    if (endsAt <= now) cooldowns.delete(key);
  }
}, 60_000).unref();

export const peakPassSetupCommand = new SlashCommandBuilder()
  .setName("peakpass-setup")
  .setDescription("Instala o actualiza el sistema Peak Pass Access")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export function buildPassId(guildId, userId) {
  const digest = createHash("sha256")
    .update(`peak-pass:${guildId}:${userId}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `PPA-${digest}`;
}

export function formatClock(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function customId(session, action, value) {
  return ["ppa", session.nonce, action, value].filter(Boolean).join(":");
}

function button(label, id, style = ButtonStyle.Primary, emoji) {
  const component = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) component.setEmoji(emoji);
  return component;
}

function row(...components) {
  return new ActionRowBuilder().addComponents(...components);
}

function baseEmbed(title, description, color = BRAND) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Peak Pass Access · Peak Open Club" })
    .setTimestamp();
}

function panelEmbeds(botUser) {
  const avatar = botUser?.displayAvatarURL({ size: 256 });
  const hero = new EmbedBuilder()
    .setColor(BRAND)
    .setAuthor({ name: "PEAKING  •  OFFICIAL ACCESS SYSTEM", ...(avatar ? { iconURL: avatar } : {}) })
    .setTitle("🛂  PEAK PASS ACCESS")
    .setDescription([
      "> **Tu identidad. Tu ruta. Tu acceso.**",
      "",
      "Peak Pass es tu credencial personal dentro de **Peak Open Club**. Protege tu entrada, construye tu perfil de jugador y evoluciona junto a tu trayectoria.",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━",
    ].join("\n"))
    .addFields(
      { name: "IDENTIDAD", value: "`PPA ÚNICO`", inline: true },
      { name: "ACCESO", value: "`CLUB UNLOCK`", inline: true },
      { name: "SISTEMA", value: "🟢 **ONLINE**", inline: true },
    )
    .setFooter({ text: "SECURE  •  PRIVATE  •  EVOLUTIVE" });
  if (avatar) hero.setThumbnail(avatar);

  const protocol = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("ENTRY PROTOCOL  //  01—03")
    .setDescription("Un recorrido privado diseñado para completarse sin salir de este mensaje.")
    .addFields(
      {
        name: "01  ┃  IDENTITY CORE",
        value: "Vincula tu cuenta, protege la sesión y genera tu identificador Peak.",
      },
      {
        name: "02  ┃  BUILD YOUR ROUTE",
        value: "Define tu estilo de juego y la función que tomas dentro de la partida.",
      },
      {
        name: "03  ┃  CLUB UNLOCK",
        value: "Recibe el estado **Reciente** y desbloquea automáticamente Peak Open Club.",
      },
      {
        name: "🛡️  PRIVACY SHIELD",
        value: "No solicitamos datos externos ni mostramos tu ID interno de Discord.",
      },
    )
    .setFooter({ text: "Tiempo estimado: 2 minutos  •  Una sesión  •  Un solo mensaje" });

  return [hero, protocol];
}

function securityEmbed() {
  return baseEmbed(
    "🛡️  PEAK PASS SECURITY",
    [
      "Tu recorrido se ejecuta de forma privada y solo tú puedes ver sus respuestas.",
      "",
      "**Protecciones activas**",
      "`01` Reto Live Pulse aleatorio",
      "`02` Sesión temporal anti-repetición",
      "`03` Bloqueo tras tres señales incorrectas",
      "`04` Identificador PPA que no expone tu ID de Discord",
      "`05` Asignación segura de roles al finalizar",
    ].join("\n"),
    SUCCESS,
  );
}

function integrityEmbed(member) {
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  return baseEmbed(
    "IDENTITY CORE · 1/5",
    "Activa tu identidad Peak. El análisis se ejecuta dentro de Discord y no solicita datos personales.",
  )
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .addFields(
      { name: "◉ Integridad de cuenta", value: "Cuenta localizada y vinculada", inline: false },
      { name: "◉ Antigüedad", value: `Creada <t:${accountCreated}:R>`, inline: false },
      { name: "◉ Protocolo", value: "Sesión privada y anti-repetición activa", inline: false },
    );
}

function pulseEmbed(session, errorText) {
  const description = errorText
    ? `${errorText}\n\nSelecciona la señal indicada antes de que expire la sesión.`
    : "Sincroniza la señal privada generada para esta sesión. El reto cambia en cada intento.";

  return baseEmbed("LIVE PULSE · 2/5", description, errorText ? WARNING : BRAND)
    .addFields({ name: "SEÑAL OBJETIVO", value: `${session.challenge.emoji} **${session.challenge.label}**` });
}

function styleEmbed() {
  return baseEmbed(
    "PLAYSTYLE ENGINE · 3/5",
    "Construye tu ruta de entrada. Podrás actualizar este dato más adelante desde tu perfil.",
  ).addFields(
    { name: "😎 CHILLEANDO", value: "Partidas relajadas, buen ambiente y cero presión." },
    { name: "🏆 COMPETIDOR", value: "Mejora constante, coordinación y objetivo de ganar." },
    { name: "🔥 AGRESIVO", value: "Ritmo alto, iniciativa y presión constante al rival." },
  );
}

function roleEmbed() {
  return baseEmbed(
    "ROLE ENGINE · 4/5",
    "Define la función que mejor representa tu impacto dentro de una partida.",
  ).addFields(
    {
      name: "🧠 IGL",
      value: "Plantea la partida, mantiene un mental sólido y da buenas calls para dirigir al equipo.",
    },
    {
      name: "🎯 FRAGGER",
      value: "Busca eliminaciones y consigue el máximo daño posible sobre los enemigos.",
    },
    {
      name: "⚡ AMBAS",
      value: "Lidera la estrategia y produce eliminaciones según lo necesite la partida.",
    },
  );
}

function passEmbed(member, guildId, active = false) {
  return baseEmbed(
    "PEAK PASS ACCESS",
    `### ${member.displayName}\nTitular registrado en **Peak Open Club**`,
    active ? SUCCESS : BRAND,
  )
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "IDENTIFICADOR PEAK", value: `\`${buildPassId(guildId, member.id)}\``, inline: true },
      { name: "ESTADO", value: active ? "🟢 RECIENTE · ACTIVO" : "🟣 RECIENTE · PREPARADO", inline: true },
      { name: "EMISIÓN", value: active ? "Acceso validado ahora" : "Pendiente de activación", inline: false },
    )
    .setFooter({ text: "Validado por Peaking · Personal · Evolutivo · Intransferible" });
}

function countdownEmbed(member, session, remaining) {
  const facts = [
    ["Tu identificador Peak", `${buildPassId(member.guild.id, member.id)} es único y no expone tu ID de Discord.`],
    ["Tu estilo de juego", `${session.playstyle} define el tipo de experiencia que buscas.`],
    ["Tu rol en partida", `${session.gameRole} ayuda a conectarte con escuadras compatibles.`],
    ["Tu estado inicial", "Empiezas como Reciente y evolucionas con participación real."],
    ["Tu progreso", "Eventos, partidas y contribuciones harán avanzar tu estado Peak."],
    ["Tu privacidad", "Peak Pass no solicita información personal externa."],
  ];
  const elapsed = ACCESS_DELAY_SECONDS - remaining;
  const [factTitle, factText] = facts[Math.min(Math.floor(elapsed / 10), facts.length - 1)];

  return baseEmbed(
    "PEAK PASS ACCESS FINALIZADO",
    `Otorgándote acceso en breve…\n\n## ${formatClock(remaining)}`,
  )
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .addFields({ name: factTitle, value: factText });
}

function challengeButtons(session) {
  return [
    { label: "OLA", emoji: "🌊" },
    { label: "PICO", emoji: "⛰️" },
    { label: "PULSO", emoji: "⚡" },
  ].map((option) =>
    button(
      option.label,
      customId(session, "pulse", option.label),
      option.label === session.challenge.label ? ButtonStyle.Primary : ButtonStyle.Secondary,
      option.emoji,
    ),
  );
}

function styleButtons(session) {
  return row(
    button("CHILLEANDO", customId(session, "style", "Chilleando"), ButtonStyle.Secondary, "😎"),
    button("COMPETIDOR", customId(session, "style", "Competidor"), ButtonStyle.Primary, "🏆"),
    button("AGRESIVO", customId(session, "style", "Agresivo"), ButtonStyle.Secondary, "🔥"),
  );
}

function gameRoleButtons(session) {
  return row(
    button("IGL", customId(session, "role", "IGL"), ButtonStyle.Secondary, "🧠"),
    button("FRAGGER", customId(session, "role", "Fragger"), ButtonStyle.Primary, "🎯"),
    button("AMBAS", customId(session, "role", "Ambas"), ButtonStyle.Secondary, "⚡"),
  );
}

function findRole(guild, name) {
  return guild.roles.cache.find((role) => role.name === name);
}

async function ensureRole(guild, name, color) {
  const existing = findRole(guild, name);
  if (existing) return existing;
  return guild.roles.create({ name, color, reason: "Instalación de Peak Pass Access" });
}

async function ensureRoles(guild) {
  const definitions = [
    [ROLE_NAMES.access, 0x23a55a],
    [ROLE_NAMES.recent, 0x57f287],
    [ROLE_NAMES.styles.Chilleando, 0x95a5a6],
    [ROLE_NAMES.styles.Competidor, 0xfee75c],
    [ROLE_NAMES.styles.Agresivo, 0xed4245],
    [ROLE_NAMES.gameRoles.IGL, 0x5865f2],
    [ROLE_NAMES.gameRoles.Fragger, 0xeb459e],
    [ROLE_NAMES.gameRoles.Ambas, 0x9b59b6],
  ];

  const roles = [];
  for (const [name, color] of definitions) {
    roles.push(await ensureRole(guild, name, color));
  }
  return roles;
}

function containsPanelButton(message) {
  return message.components.some((actionRow) =>
    actionRow.components.some((component) => component.customId === PANEL_BUTTON_ID),
  );
}

async function ensurePeakPassChannel(guild) {
  let category = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && /inicio/i.test(channel.name),
  );

  if (!category) {
    category = await guild.channels.create({
      name: "🚪・INICIO",
      type: ChannelType.GuildCategory,
      reason: "Instalación de Peak Pass Access",
    });
  }

  let channel = guild.channels.cache.find(
    (candidate) => candidate.type === ChannelType.GuildText && candidate.name.includes("peak-pass"),
  );

  if (!channel) {
    channel = await guild.channels.create({
      name: "🛂・peak-pass",
      type: ChannelType.GuildText,
      parent: category.id,
      topic: "Activa tu identidad Peak y desbloquea Peak Open Club.",
      reason: "Instalación de Peak Pass Access",
    });
  } else if (channel.parentId !== category.id) {
    await channel.setParent(category.id, { lockPermissions: false });
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());
  await channel.permissionOverwrites.set([
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads],
    },
    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ]);

  return channel;
}

async function upsertPanel(channel) {
  const components = [
    row(
      button("ACTIVAR MI PEAK PASS", PANEL_BUTTON_ID, ButtonStyle.Primary, "🛂"),
      button("SEGURIDAD", SECURITY_BUTTON_ID, ButtonStyle.Secondary, "🛡️"),
    ),
  ];
  const recentMessages = await channel.messages.fetch({ limit: 50 });
  const existing = recentMessages.find(
    (message) => message.author.id === channel.client.user.id && containsPanelButton(message),
  );

  if (existing) {
    await existing.edit({ content: null, embeds: panelEmbeds(channel.client.user), components });
    return { message: existing, created: false };
  }

  const message = await channel.send({ embeds: panelEmbeds(channel.client.user), components });
  await message.pin().catch(() => null);
  return { message, created: true };
}

export async function syncPeakPassPanel(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  await ensureRoles(guild);
  const channel = await ensurePeakPassChannel(guild);
  return upsertPanel(channel);
}

export async function handlePeakPassSetup(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Este comando solo funciona dentro del servidor.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const botMember = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
  const requiredPermissions = [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const missingPermissions = botMember.permissions.missing(requiredPermissions);
  if (missingPermissions.length > 0) {
    await interaction.editReply({
      content: `❌ Peaking necesita estos permisos antes de instalar Peak Pass:\n${missingPermissions.map((permission) => `• ${permission}`).join("\n")}`,
    });
    return;
  }

  const panel = await syncPeakPassPanel(interaction.guild);
  const roles = Object.values(ROLE_NAMES.styles).length + Object.values(ROLE_NAMES.gameRoles).length + 2;
  const channel = panel.message.channel;

  await interaction.editReply({
    content: [
      "✅ **Peak Pass Access está listo.**",
      `Canal: ${channel}`,
      `Roles sincronizados: **${roles}**`,
      panel.created ? "Panel publicado y fijado." : "Panel existente actualizado sin duplicarlo.",
      "Ya puedes pulsar **INICIALIZAR PEAK PASS** para probar el recorrido.",
    ].join("\n"),
  });
}

async function getMember(interaction) {
  return interaction.guild.members.fetch(interaction.user.id);
}

function accountCooldownRemaining(key) {
  const endsAt = cooldowns.get(key);
  if (!endsAt) return 0;
  if (endsAt <= Date.now()) {
    cooldowns.delete(key);
    return 0;
  }
  return Math.ceil((endsAt - Date.now()) / 1000);
}

function getSession(interaction, nonce) {
  const key = sessionKey(interaction.guildId, interaction.user.id);
  const session = sessions.get(key);
  if (!session || session.nonce !== nonce || session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session;
}

async function startSession(interaction) {
  const member = await getMember(interaction);
  const key = sessionKey(interaction.guildId, interaction.user.id);
  const accessRole = findRole(interaction.guild, ROLE_NAMES.access);

  if (accessRole && member.roles.cache.has(accessRole.id)) {
    await interaction.reply({
      embeds: [passEmbed(member, interaction.guildId, true)],
      content: "Tu Peak Pass ya está activo.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = accountCooldownRemaining(key);
  if (cooldown > 0) {
    await interaction.reply({
      content: `⏳ Live Pulse está recalibrando tu acceso. Inténtalo de nuevo en ${cooldown} segundos.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const current = sessions.get(key);
  if (current?.state === "countdown") {
    await interaction.reply({
      content: "Tu Peak Pass ya se está activando. Espera a que termine la cuenta atrás.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const challenges = [
    { label: "OLA", emoji: "🌊" },
    { label: "PICO", emoji: "⛰️" },
    { label: "PULSO", emoji: "⚡" },
  ];
  const session = {
    nonce: randomBytes(4).toString("hex"),
    challenge: challenges[Math.floor(Math.random() * challenges.length)],
    attempts: 0,
    state: "identity",
    userId: interaction.user.id,
    expiresAt: Date.now() + SESSION_LIFETIME_MS,
  };
  sessions.set(key, session);

  await interaction.reply({
    embeds: [integrityEmbed(member)],
    components: [row(button("EJECUTAR CONTROL", customId(session, "scan"), ButtonStyle.Primary, "🔍"))],
    flags: MessageFlags.Ephemeral,
  });
}

async function grantAccess(member, session) {
  await member.guild.roles.fetch();
  await ensureRoles(member.guild);
  const names = [
    ROLE_NAMES.access,
    ROLE_NAMES.recent,
    ROLE_NAMES.styles[session.playstyle],
    ROLE_NAMES.gameRoles[session.gameRole],
  ];
  const roles = names.map((name) => findRole(member.guild, name)).filter(Boolean);
  await member.roles.add(roles, "Peak Pass Access finalizado");
}

async function runCountdown(interaction, member, session) {
  session.state = "countdown";
  await interaction.update({
    embeds: [countdownEmbed(member, session, ACCESS_DELAY_SECONDS)],
    components: [],
  });

  for (let remaining = ACCESS_DELAY_SECONDS - 5; remaining > 0; remaining -= 5) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await interaction.editReply({ embeds: [countdownEmbed(member, session, remaining)] });
  }

  await new Promise((resolve) => setTimeout(resolve, 5_000));
  await grantAccess(member, session);
  sessions.delete(sessionKey(interaction.guildId, interaction.user.id));
  await interaction.editReply({
    content: "✅ **Acceso otorgado. Bienvenido a Peak Open Club.**",
    embeds: [passEmbed(member, interaction.guildId, true)],
    components: [],
  });
}

export async function handlePeakPassButton(interaction) {
  if (!interaction.inGuild()) return;
  if (interaction.customId === SECURITY_BUTTON_ID) {
    await interaction.reply({ embeds: [securityEmbed()], flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.customId === PANEL_BUTTON_ID) {
    await startSession(interaction);
    return;
  }

  const [, nonce, action, value] = interaction.customId.split(":");
  const session = getSession(interaction, nonce);
  if (!session) {
    await interaction.reply({
      content: "Esta sesión ha caducado. Vuelve al panel e inicializa un nuevo Peak Pass.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await getMember(interaction);
  if (action === "scan" && session.state === "identity") {
    session.state = "pulse";
    await interaction.update({
      embeds: [pulseEmbed(session)],
      components: [row(...challengeButtons(session))],
    });
    return;
  }

  if (action === "pulse" && session.state === "pulse") {
    if (value !== session.challenge.label) {
      session.attempts += 1;
      if (session.attempts >= 3) {
        const key = sessionKey(interaction.guildId, interaction.user.id);
        sessions.delete(key);
        cooldowns.set(key, Date.now() + FAILURE_COOLDOWN_MS);
        await interaction.update({
          embeds: [baseEmbed("LIVE PULSE BLOQUEADO", "Tres señales incorrectas. El acceso se recalibrará durante 60 segundos.", WARNING)],
          components: [],
        });
        return;
      }

      await interaction.update({
        embeds: [pulseEmbed(session, `Señal incorrecta · intento ${session.attempts}/3`)],
        components: [row(...challengeButtons(session))],
      });
      return;
    }

    session.state = "style";
    await interaction.update({ embeds: [styleEmbed()], components: [styleButtons(session)] });
    return;
  }

  if (action === "style" && session.state === "style" && ROLE_NAMES.styles[value]) {
    session.playstyle = value;
    session.state = "role";
    await interaction.update({ embeds: [roleEmbed()], components: [gameRoleButtons(session)] });
    return;
  }

  if (action === "role" && session.state === "role" && ROLE_NAMES.gameRoles[value]) {
    session.gameRole = value;
    session.state = "issued";
    await interaction.update({
      embeds: [passEmbed(member, interaction.guildId, false)],
      components: [
        row(button("DESBLOQUEAR PEAK OPEN CLUB", customId(session, "unlock"), ButtonStyle.Success, "🔓")),
      ],
    });
    return;
  }

  if (action === "unlock" && session.state === "issued") {
    await runCountdown(interaction, member, session);
  }
}
