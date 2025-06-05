module.exports = class Selenium {
	constructor() {
		this.driver = null;
	}

	async start() {
		if (this.driver) {
			return this.driver;
		}

		const { Builder, By, until } = require("selenium-webdriver");
		const chrome = require("selenium-webdriver/chrome");

		const screen = {
			width: 1280,
			height: 720,
		};

		this.driver = new Builder()
			.forBrowser("chrome")
			.setChromeOptions(new chrome.Options().windowSize(screen))
			.build();

		return this.driver;
	}

	getDriver() {
		if (!this.driver) {
			throw new Error("Selenium driver is not started. Call start() first.");
		}
		return this.driver;
	}

	async quit() {
		if (this.driver) {
			await this.driver.quit();
			this.driver = null;
		}
	}
};
