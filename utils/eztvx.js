const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const Selenium = require("./selenium");

async function* searchEztvx(showName) {
    const selenium = new Selenium();
    const driver = await selenium.start();

    try {
        await driver.get(`https://eztvx.to/search/${showName}`);

        try {
            const showLinksBtn = await driver.wait(
                until.elementLocated(
                    By.xpath("/html/body/div/table[5]/tbody/tr[3]/td[3]/div/form/button")
                ),
                5000
            );
            await showLinksBtn.click();
        } catch (error) {
            yield [];
            return;
        }

        await driver.wait(
            until.elementsLocated(
                By.xpath(`//*[@id="header_holder"]/table[5]/tbody/tr`)
            ),
            10000
        );

        let currentChunk = [];
        const results = await driver.findElements(By.xpath(`//*[@id="header_holder"]/table[5]/tbody/tr`));

        for (let i = 2; i < results.length; i++) {
            try {
                const result = results[i];
                const title = await result.findElement(By.css("td:nth-child(2) a")).getText();
                const url = await result.findElement(By.css("td:nth-child(3) a.download_1")).getAttribute("href");
                const magnet = await result.findElement(By.css("td:nth-child(3) a.magnet")).getAttribute("href");
                const size = await result.findElement(By.css("td:nth-child(4)")).getText();
                const date = await result.findElement(By.css("td:nth-child(5)")).getText();
                const seeders = await result.findElement(By.css("td.forum_thread_post_end font")).getText();

                if (title && url && seeders) {
                    currentChunk.push({
                        title,
                        url: url.startsWith("http") ? url : `https://eztvx.to${url}`,
                        magnet: magnet ? magnet : null,
                        size,
                        date,
                        seeders,
                    });

                    if (currentChunk.length >= 5) {
                        yield currentChunk;
                        currentChunk = [];
                    }
                }
            } catch (error) {
                if (error.name !== "NoSuchElementError") {
                    console.error("Error processing result:", error);
                }
            }
        }

        if (currentChunk.length > 0) {
            yield currentChunk;
        }

    } finally {
        await driver.quit();
    }
}

module.exports = { searchEztvx };