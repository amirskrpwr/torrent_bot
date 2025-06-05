const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const Selenium = require("./selenium");

// Function to search eztvx.to
async function searchEztvx(showName) {
	const selenium = new Selenium();
	const driver = await selenium.start();

	await driver.get(`https://eztvx.to/search/${showName}`);

	// Find search input and submit query
	try {
		const showLinksBtn = await driver.wait(
			until.elementLocated(
				By.xpath("/html/body/div/table[5]/tbody/tr[3]/td[3]/div/form/button")
			),
			5000
		);
        await showLinksBtn.click();
    } catch (error) {
		await driver.quit();
		return [];
	}

	const results = await driver.wait(
		until.elementsLocated(
			By.xpath(`//*[@id="header_holder"]/table[5]/tbody/tr`)
		)
	);

	const torrents = [];

	if (results.length > 2) {
		for (let i = 2; i < results.length; i++) {
			// Start from the third row (index 2)
			const result = results[i];
			try {
				const title = await result
					.findElement(By.css("td:nth-child(2) a"))
					.getText();
				const url = await result
					.findElement(By.css("td:nth-child(3) a.download_1"))
					.getAttribute("href");
				const magnet = await result
					.findElement(By.css("td:nth-child(3) a.magnet"))
					.getAttribute("href");
				const size = await result
					.findElement(By.css("td:nth-child(4)"))
					.getText();
				const date = await result
					.findElement(By.css("td:nth-child(5)"))
					.getText();
				const seeders = await result
					.findElement(By.css("td.forum_thread_post_end font"))
					.getText();

				if (title && url && seeders) {
					torrents.push({
						title,
						url: url.startsWith("http") ? url : `https://eztvx.to${url}`,
						magnet: magnet ? magnet : null,
						size,
						date,
						seeders,
					});
				}
			} catch (error) {
				if (error.name === "NoSuchElementError") {
				} else {
					// Close the driver
					await driver.quit();

					throw error; // Re-throw unexpected errors
				}
			}
		}
	}

	// Close the driver
	await driver.quit();

	return torrents;
}

module.exports = {
	searchEztvx,
};
