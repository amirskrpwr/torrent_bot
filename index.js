const { Telegraf, Markup } = require("telegraf");
const { searchEztvx } = require("./utils/eztvx");
require("dotenv").config();

// Initialize Telegram bot with your token
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const userSessions = {};

// Command handler for /start
bot.start((ctx) => {
	ctx.reply(
		"Welcome to TV Show Torrent Finder! Send me the name of a TV show to search for torrents."
	);
});

// Message handler for TV show search
bot.on("text", async (ctx) => {
	const showName = ctx.message.text.trim();
	const userId = ctx.from.id;

	try {
		// Send initial message
		const processingMsg = await ctx.reply(
			`Searching for "${showName}" on eztvx.to...`
		);

		// Search on eztvx.to
		const torrents = await searchEztvx(showName);

		if (torrents.length === 0) {
			await ctx.telegram.editMessageText(
				ctx.chat.id,
				processingMsg.message_id,
				null,
				`No torrents found for "${showName}" on eztvx.to.`
			);
			return;
		}

		// Store results in user session
		userSessions[userId] = { torrents, currentPage: 0 };

		// Show first 5 results with pagination
		await showTorrentsPage(ctx, processingMsg.message_id, userId, 0);
	} catch (error) {
		console.error("Error:", error);
		ctx.reply("An error occurred while searching. Please try again later.");
	}
});

bot.action(/select_(\d+)/, async (ctx) => {
	const userId = ctx.from.id;
	const torrentIndex = parseInt(ctx.match[1]);
	const session = userSessions[userId];

	if (!session || !session.torrents || !session.torrents[torrentIndex]) {
		return ctx.answerCbQuery("Session expired. Please search again.");
	}

	const torrent = session.torrents[torrentIndex];

	const message =
		`📺 <b>${torrent.title}</b>\n\n` +
		`🕒 ${torrent.date} | 💾 ${torrent.size}\n\n` +
		`🔗 <a href="${torrent.url}">Download Torrent</a>\n` +
		(torrent.magnet ? `🧲 <code>${torrent.magnet}</code>\n` : "") +
		`👥 Seeders: ${torrent.seeders}\n\n`;

	await ctx.editMessageText(message, {
		parse_mode: "HTML",
		disable_web_page_preview: false,
		reply_markup: Markup.inlineKeyboard([
			Markup.button.callback("⬅️ Back to list", `page_${session.currentPage}`),
		]).reply_markup,
	});

	await ctx.answerCbQuery();
});

// Handle pagination
bot.action(/page_(\d+)/, async (ctx) => {
	const userId = ctx.from.id;
	const page = parseInt(ctx.match[1]);
	const session = userSessions[userId];

	if (!session)
		return ctx.answerCbQuery("Session expired. Please search again.");

	session.currentPage = page;
	await showTorrentsPage(
		ctx,
		ctx.callbackQuery.message.message_id,
		userId,
		page
	);
	await ctx.answerCbQuery();
});

// Start the bot
bot
	.launch()
	.then(() => console.log("Bot started"))
	.catch((err) => console.error("Bot failed to start:", err));

// Enable graceful stop
process.once("SIGINT", () => {
	driver.quit();
	bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
	driver.quit();
	bot.stop("SIGTERM");
});

// Show a page of torrents with inline keyboard
async function showTorrentsPage(ctx, messageId, userId, page) {
	const session = userSessions[userId];
	if (!session || !session.torrents) return;

	const { torrents } = session;
	const itemsPerPage = 5;
	const totalPages = Math.ceil(torrents.length / itemsPerPage);
	const startIdx = page * itemsPerPage;
	const endIdx = Math.min(startIdx + itemsPerPage, torrents.length);
	const currentTorrents = torrents.slice(startIdx, endIdx);

	// Create buttons for each torrent
	const buttons = currentTorrents.map((torrent, index) => [
		Markup.button.callback(
			`📺 ${torrent.title.substring(0, 30)}${
				torrent.title.length > 30 ? "..." : ""
			}`,
			`select_${startIdx + index}`
		),
	]);

	// Add pagination buttons if needed
	const pagination = [];
	if (page > 0) {
		pagination.push(Markup.button.callback("⬅️ Previous", `page_${page - 1}`));
	}
	if (page < totalPages - 1) {
		pagination.push(Markup.button.callback("Next ➡️", `page_${page + 1}`));
	}

	if (pagination.length > 0) {
		buttons.push(pagination);
	}

	const keyboard = Markup.inlineKeyboard(buttons);

	await ctx.telegram.editMessageText(
		ctx.chat.id,
		messageId,
		null,
		`🔍 Found ${torrents.length} torrents. Page ${
			page + 1
		}/${totalPages}:\nSelect a torrent:`,
		{
			...keyboard,
			parse_mode: "HTML",
			disable_web_page_preview: true,
		}
	);
}
