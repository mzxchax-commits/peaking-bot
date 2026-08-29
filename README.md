# Peaking Bot

Bot oficial de Peak Open Club, preparado para ejecutarse en Railway.

## Variables de entorno

- `DISCORD_TOKEN`: token secreto del bot de Discord.
- `CLIENT_ID`: Application ID de la aplicación de Discord.
- `GUILD_ID`: ID del servidor de pruebas. Hace que el comando aparezca al instante.

No guardes estas variables en el repositorio. Configúralas en Railway desde
**Variables**.

## Arranque

```bash
npm install
npm start
```

Railway detecta `package.json` y ejecuta automáticamente el script `start`.

## Probar Peak Pass en Discord

1. En Railway configura `DISCORD_TOKEN`, `CLIENT_ID=1543237858989576263` y
   `GUILD_ID=1543227776742727702`.
2. Asegúrate de que Peaking tiene estos permisos en el servidor:
   **Manage Roles**, **Manage Channels**, **Manage Messages**, **View Channels**,
   **Send Messages**, **Embed Links** y **Read Message History**.
3. Mueve el rol de Peaking por encima de los roles que administrará.
4. Cuando Railway muestre `Peaking conectado`, ejecuta `/peakpass-setup`.
5. Abre `🛂・peak-pass` y pulsa **INICIALIZAR PEAK PASS**.

El comando puede ejecutarse varias veces: actualiza el panel existente y no
publica mensajes duplicados. El recorrido es privado, usa un reto aleatorio,
aplica un bloqueo tras tres fallos y edita un único mensaje durante la cuenta
atrás de 60 segundos.

## Intents de Discord

Peak Pass solo utiliza el intent estándar `Guilds`. No necesita activar
`Server Members Intent` ni `Message Content Intent` en Discord Developer Portal.
