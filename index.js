const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName("estime")
    .setDescription("Estime le prix d’un vêtement sur Vinted")
    .addStringOption(option =>
      option.setName("recherche")
        .setDescription("Ex: pull nike blanc taille M")
        .setRequired(true))
].map(command => command.toJSON());

client.once("ready", () => {
  console.log("✅ Bot prêt !");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "estime") {
    const query = interaction.options.getString("recherche");
    await interaction.reply("🔎 Recherche en cours sur Vinted...");

    try {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.goto(`https://www.vinted.fr/catalog?search_text=${encodeURIComponent(query)}`);

      await page.waitForSelector(".feed-grid__item", { timeout: 10000 });

      const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".feed-grid__item"))
          .slice(0, 100)
          .map(el => {
            const priceEl = el.querySelector("[data-testid='item-tile-price']");
            return priceEl ? parseFloat(priceEl.textContent.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
          })
          .filter(price => price !== null);
      });

      await browser.close();

      if (items.length < 5) {
        await interaction.editReply("❌ Pas assez d’annonces fiables trouvées.");
        return;
      }

      const avg = (items.reduce((a, b) => a + b, 0) / items.length).toFixed(2);
      const demande = items.length >= 50 ? "📈 Forte" : "📉 Faible";

      await interaction.editReply(`📊 **Résultats pour : \`${query}\`**
- Moyenne des prix : **${avg} €**
- Annonces analysées : ${items.length}
- Demande : ${demande}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Une erreur est survenue.");
    }
  }
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔁 Enregistrement des commandes slash...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commandes enregistrées !");
    client.login(TOKEN);
  } catch (error) {
    console.error(error);
  }
})();
