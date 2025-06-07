const { Telegraf, Markup } = require("telegraf");
const { searchEztvx } = require("./utils/eztvx");
const { searchPirateBay, searchPiratebay } = require("./utils/piratebay");
require("dotenv").config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 10;
const userSessions = {};

bot.start((ctx) => {
    ctx.reply("🎬 TV Show Torrent Finder\n\nSend me a TV show name to search");
});

bot.on("text", async (ctx) => {
    const showName = ctx.message.text.trim();
    const userId = ctx.from.id;

    // Clear previous session if exists
    if (userSessions[userId]) {
        delete userSessions[userId];
    }

    try {
        // Initialize user session
        userSessions[userId] = {
            torrents: [],
            currentPage: 0,
            isSearching: true,
            messageId: null,
            searchTerm: showName,
            cancelRequested: false,
            searchStartTime: Date.now()
        };

        // Send initial message with stop button
        const initialMsg = await ctx.replyWithHTML(
            `🔍 Searching for <b>"${showName}"</b>...\n` +
            `⏳ Results will appear below:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🛑 Stop Search', 'stop_search')]
            ])
        );
        
        userSessions[userId].messageId = initialMsg.message_id;

        // Start progressive search
        progressiveSearch(ctx, userId, showName);

    } catch (error) {
        console.error("Initialization error:", error);
        ctx.replyWithHTML("❌ Failed to start search. Please try again.");
    }
});

async function progressiveSearch(ctx, userId, showName) {
    try {
        const torrentStream = searchPiratebay(showName);
        
        for await (const newTorrents of torrentStream) {
            // Check if user requested to stop
            if (!userSessions[userId] || userSessions[userId].cancelRequested) {
                break;
            }
            
            // Add new torrents to session
            userSessions[userId].torrents = [...userSessions[userId].torrents, ...newTorrents];
            
            // Update message with current results
            await updateResultsMessage(ctx, userId);
        }

        // Final update
        if (userSessions[userId]) {
            userSessions[userId].isSearching = false;
            await updateResultsMessage(ctx, userId, true);
        }

    } catch (error) {
        console.error("Search error:", error);
        if (userSessions[userId]) {
            await showFinalResults(ctx, userId, 
                `❌ Search failed after finding ${userSessions[userId].torrents.length} torrents`);
        }
    }
}

async function updateResultsMessage(ctx, userId, isFinal = false) {
    const session = userSessions[userId];
    if (!session || !session.messageId) return;

    const { torrents, currentPage, isSearching, searchTerm, searchStartTime } = session;
    const totalItems = torrents.length;
    console.log("🚀 ~ updateResultsMessage ~ totalItems:", totalItems)
    const totalPages = Math.ceil(totalItems / CHUNK_SIZE);
    const startIdx = currentPage * CHUNK_SIZE;
    const endIdx = Math.min(startIdx + CHUNK_SIZE, totalItems);
    const currentChunk = torrents.slice(startIdx, endIdx);

    // Create buttons for current chunk
    const torrentButtons = currentChunk.map((torrent, idx) => [
        Markup.button.callback(
            `${torrent.title.substring(0, 30)}${torrent.title.length > 30 ? '...' : ''}`,
            `select_${startIdx + idx}`
        )
    ]);

    // Pagination buttons
    const paginationButtons = [];
    if (currentPage > 0) {
        paginationButtons.push(Markup.button.callback('◀️ Prev', `page_${currentPage - 1}`));
    }
    if (endIdx < totalItems) {
        paginationButtons.push(Markup.button.callback('Next ▶️', `page_${currentPage + 1}`));
    }

    // Action buttons (stop/search again)
    const actionButtons = [];
    if (isSearching && !isFinal) {
        actionButtons.push([Markup.button.callback('🛑 Stop Search', 'stop_search')]);
    } else {
        actionButtons.push([Markup.button.callback('🔍 New Search', 'new_search')]);
    }

    // Status text
    const searchTime = Math.floor((Date.now() - searchStartTime) / 1000);
    const statusText = isSearching 
        ? `🔍 Searching "${searchTerm}" (${searchTime}s)\nFound ${totalItems} so far` 
        : `✅ Found ${totalItems} torrents for "${searchTerm}"`;

    try {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            session.messageId,
            null,
            `${statusText}\n\nPage ${currentPage + 1}/${totalPages}`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        ...torrentButtons,
                        paginationButtons.length ? paginationButtons : [],
                        ...actionButtons
                    ]
                }
            }
        );
    } catch (error) {
        console.error("Message update error:", error);
    }
}

async function showFinalResults(ctx, userId, statusText) {
    const session = userSessions[userId];
    if (!session) return;

    session.isSearching = false;
    session.cancelRequested = false;
    
    await updateResultsMessage(ctx, userId, true);
}

// Handle torrent selection
bot.action(/select_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const torrentIndex = parseInt(ctx.match[1]);
    const session = userSessions[userId];

    if (!session || torrentIndex >= session.torrents.length) {
        return ctx.answerCbQuery("⚠️ Please start a new search");
    }

    const torrent = session.torrents[torrentIndex];
    const details = `🎬 <b>${torrent.title}</b>\n\n` +
                   `📅 ${torrent.date} | 💾 ${torrent.size}\n` +
                   `👥 Seeders: ${torrent.seeders}\n\n` +
                   `🔗 <a href="${torrent.url}">Download</a> | ` +
				   (torrent.magnet ? `🧲 <code>${torrent.magnet}</code>\n` : '');

    await ctx.editMessageText(details, {
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback("🔙 Back", `page_${session.currentPage}`)]]
        }
    });

    await ctx.answerCbQuery();
});

// Handle pagination
bot.action(/page_(\d+)/, async (ctx) => {
    const userId = ctx.from.id;
    const page = parseInt(ctx.match[1]);
    const session = userSessions[userId];

    if (!session || page < 0 || page * CHUNK_SIZE >= session.torrents.length) {
        return ctx.answerCbQuery("⚠️ Invalid page");
    }

    session.currentPage = page;
    await updateResultsMessage(ctx, userId);
    await ctx.answerCbQuery();
});

// Handle stop search
bot.action('stop_search', async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];

    if (!session) {
        return ctx.answerCbQuery("⚠️ No active search");
    }

    session.cancelRequested = true;
    await ctx.answerCbQuery(`🛑 Stopped - Found ${session.torrents.length} torrents`);
    await showFinalResults(ctx, userId, `🛑 Stopped - Found ${session.torrents.length} torrents`);
});

// Handle new search
bot.action('new_search', async (ctx) => {
    await ctx.editMessageText("Send me the name of a TV show to search");
    await ctx.answerCbQuery();
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.replyWithHTML('❌ Something went wrong. Please try again.');
});

bot.launch().then(() => console.log("🤖 Bot running"));

// Graceful shutdown
process.once("SIGINT", () => {
    console.log("🛑 Stopping bot...");
    bot.stop("SIGINT");
    process.exit();
});

process.once("SIGTERM", () => {
    console.log("🛑 Stopping bot...");
    bot.stop("SIGTERM");
    process.exit();
});