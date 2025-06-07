const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const Selenium = require("./selenium");

async function* searchPiratebay(showName) {
	const selenium = new Selenium();
	const driver = await selenium.start();

	try {
		await driver.get(`https://thepiratebay.zone/search/${showName}`);

		let currentChunk = [];
		const results = await driver.findElements(
			By.xpath(`//*[@id="searchResult"]/tbody/tr`)
		);
		try {
			const nextPageButtonLogo = await driver.wait(
				until.elementLocated(
					By.xpath('//*[@id="searchResult"]/tbody/tr[31]/td/a/img')
				),
				5000
			);

			while (nextPageButtonLogo) {
				await getResults(results);
				await driver
					.findElement(
						By.xpath(
							"#searchResult > tbody > tr:nth-child(31) > td > a:last-child"
						)
					)
					.click();
			}
		} catch (error) {
			await getResults(results);
		}
		// if( )

		if (currentChunk.length > 0) {
			yield currentChunk;
		}
	} finally {
		await driver.quit();
	}
}

async function* getResults(results) {
	for (let result of results) {
		try {
			const title = await result
				.findElement(By.css("td:nth-child(2) div a"))
				.getText();
			const url = "";
			const magnet = await result
				.findElement(By.css("td:nth-child(2) a:nth-child(2)"))
				.getAttribute("href");
			const size = await result
				.findElement(By.css("td:nth-child(2) font"))
				.getText();
			const date = await result
				.findElement(By.css("td:nth-child(2) font"))
				.getText();
			const seeders = await result
				.findElement(By.css("td:nth-child(3)"))
				.getText();

			if (title && seeders) {
				currentChunk.push({
					title,
					url: "",
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
}

module.exports = { searchPiratebay };
