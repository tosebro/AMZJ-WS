'use strict';

console.debug('[*] amazon-product.js loaded.');

// define consts
const classnamePrefix = 'amzj-ws_';

// define class for carousel item
class CarouselItem {
	// constructor
	constructor() {
		this.asin = '';
		this.title = '';
		this.thumbImageUrl = '';
		this.pageUrl = '';
		this.originalImageUrl = '';
	}
}

// Amazon product information
class AmazonProduct {
	// constructor
	constructor() {
		console.debug('[*] AmazonProduct constructed.');
		this._url = '';
		this._asin = '';
		this._title = '';
		this._summary = '';
		this._landingImageUrl = '';
		this._sampleImageUrls = [];
		this._carouselAsins = [];
	}

	get asin() {
		return this._asin;
	}

	set asin(asin) {
		this._asin = asin;
	}

	get url() {
		return this._url;
	}

	set url(url) {
		this._url = url;
	}

	get title() {
		return this._title;
	}

	set title(title) {
		this._title = title;
	}

	get summary() {
		return this._summary;
	}

	set summary(summary) {
		this._summary = summary;
	}

	get landingImageUrl() {
		return this._landingImageUrl;
	}

	set landingImageUrl(landingImageUrl) {
		this._landingImageUrl = landingImageUrl;
	}

	get sampleImageUrls() {
		return this._sampleImageUrls;
	}

	set sampleImageUrls(sampleImageUrls) {
		this._sampleImageUrls = sampleImageUrls;
	}

	get carouselAsins() {
		return this._carouselAsins;
	}

	set carouselAsins(carouselAsins) {
		this._carouselAsins = carouselAsins;
	}
}

// instance of Amazon Product class
let product = new AmazonProduct();

// AmazonProductPage Helper class
// Retrieve data from the page DOM, update DOM, etc.
class AmazonProductPageHelper {
	// retrieve product information from DOM, and set it to AmazonProduct instance
	static getProductInformationFromPage() {
		product.asin = this.getAsin();
		product.url = this.getUrl();
		product.title = this.getTitle();
		product.summary = this.getSummary();
		product.landingImageUrl = this.getLandingImageUrl();
		product.sampleImageUrls = this.getSampleImageUrls();
		product.carouselAsins = this.getCarouselAsins();
	}

	// retrieve ASIN from DOM
	// return: string, ASIN
	static getAsin() {
		let asin = '';
		if ($('#ASIN')) {
			asin = $('#ASIN').val();
		}
		$('input[name="ASIN.0"]').each(function () {
			let asinCandidate = $(this).val();
			if (asinCandidate && asinCandidate != '') {
				asin = asinCandidate;
			}
		});
		// console.debug("ASIN: " + asin);
		return asin;
	}

	static getUrl() {
		return AmazonProductPageHelper.normalizePageUrl(location.href);
	}

	static getTitle() {
		let title = $('#productTitle').text();
		return title;
	}

	static getSummary() {
		// retrieve title and author
		let title = AmazonProductPageHelper.getTitle();
		title = title.replace(/\r?\n/g, '');
		title = title.replace(/\s\s+/g, ' ');
		title = title.replace(/^\s+/g, '');
		title = title.replace(/\s+$/g, '');

		let author = $('#bylineInfo').text();
		author = author.replace(/\r?\n/g, '');
		author = author.replace(/\s\s+/g, ' ');
		author = author.replace(/^\s+/g, '');
		author = author.replace(/\s+$/g, '');

		// retrieve url
		const url = AmazonProductPageHelper.getUrl();

		// retrieve description
		let description = '';

		if ($('#productDescription').length) {
			// retrieve Product Description element at the right of the thumb image
			console.debug('[*] Retrieve description #productDescription');
			description = $('#productDescription').text();
		}
		else if ($('#bookDescription_feature_div').length) {
			console.debug('[*] Retrieve description from #bookDescription_feature_div');
			description = $('#bookDescription_feature_div').text();
		}
		else if ($('#iframeContent').length) {
			// mainly for novels. retrieve Product Description element at the right of the thumb
			console.debug('[*] Retrieve description from #iframeContent');
			description = $('#iframeContent').text();
		}
		else {
			// retrieve Product Description element in the middle of the page
			// collect script code as text
			console.debug('[*] Retrieve description from bookDescEncodedData.');
			$('script').each(function (index, element) {
				const scriptCode = $(element).text();
				if (scriptCode.indexOf('bookDescEncodedData') !== -1) {
					// retrieve description text
					const descriptionRegex = /bookDescEncodedData = "([0-9a-zA-Z%]+)",/;
					const descriptionMatchResult = scriptCode.match(descriptionRegex);
					console.debug(scriptCode);
					console.debug(descriptionMatchResult);

					if (descriptionMatchResult) {
						description = decodeURIComponent(descriptionMatchResult[1]);
					}
				}
			});
		}

		description = description.replace(/(<br( \/)?>)+/gi, '\n');
		description = description.replace(/(\r?\n)+/g, '\n');
		description = description.replace(/<.+?>/g, '');
		description = description.replace(/\s\s+/g, ' ');
		description = description.replace(/^\s+/g, '');
		description = description.replace(/\s+$/g, '');

		// create product summary text
		const summary = `Title: ${title}\nAuthor: ${author}\nDescription: ${description}\nURL: ${url}`;

		return summary;
	}

	// get landing image url
	static getLandingImageUrl() {
		let url = '';
		let element = $('#landingImage');
		if (element) {
			url = AmazonProductPageHelper.normalizeImageUrl($(element).attr('data-old-hires'));
		}

		return url;
	}

	// get large sample image urls as array
	static getSampleImageUrls() {
		// collect script code as text
		let urls = [];

		$('script').each(function (index, element) {
			const scriptCode = $(element).text();
			// check if the script contains mainUrls
			if (scriptCode.indexOf('"ImageBlockATF"') !== -1) {
				//console.debug(scriptCode);

				// search multiple types of urls, maybe depends on product type
				// obtain urls from hiRes or mainUrl object in JSON
				const sampleImageUrlRegex = /"(hiRes|mainUrl)":"(https:\/\/[a-zA-Z0-9\.-]+\/images\/I\/[a-zA-Z0-9,.%_\+-]+\.jpg)"/g;
				const urlResult = scriptCode.matchAll(sampleImageUrlRegex);
				for (const r of urlResult) {
					let url = AmazonProductPageHelper.normalizeImageUrl(r[2]);
					urls.push(url);
				}
			}
		});

		return urls;
	}

	// obtain similarity ASIN list from this page
	// return: Array, ASIN list
	static getCarouselAsins() {
		// get carousel id lists. div elements having attribute 'data-a-carousel-options', which have carousel ASIN list
		let carouselIdJsons = [];
		let carouselAsins = [];
		console.debug('[*] div[data-a-carousel-options] counts: ' + $('div[data-a-carousel-options]').length);
		$('div[data-a-carousel-options]').each(function () {
			// got and parse a JSON data from an attribute
			let carouselJson = JSON.parse($(this).attr('data-a-carousel-options'));
			// case 1: id_list format
			if (carouselJson.ajax && carouselJson.ajax.id_list) {
				// console.debug(carouselJson.ajax);
				const idJsonList = carouselJson.ajax.id_list;
				console.debug('[*] carousel ajax.id_list: ');
				console.debug(idJsonList);

				idJsonList.forEach(function (idJsonString) {
					try {
						const idJson = JSON.parse(idJsonString);
						if (idJson && idJson.id) {
							carouselAsins.push(idJson.id);
						}
					} catch (error) {
						console.error('[!] Failed to parse ajax.id_list');
					}
				});
			}
			else if (carouselJson && carouselJson.initialSeenAsins) {
				// case 2: initialSeenAsins format
				const ids = carouselJson.initialSeenAsins;
				ids.forEach(function (id) {
					carouselAsins.push(id);
				});
			}
		});

		// unique asin list
		const uniqAsins = carouselAsins.filter((id, index, array) => {
			return array.indexOf(id) === index;
		});

		// console output for debug
		console.debug('[*] unique carousel id count: ' + uniqAsins.length);
		console.debug('[*] unique carousel id list: ');
		console.debug(uniqAsins);

		return uniqAsins;
	}

	// normalize page url
	// return: https://www.amazon.co.jp/dp/<ASIN>/
	static normalizePageUrl(url) {
		// if url not specified, return empty string
		if (url == null || url == '') {
			return '';
		}

		// if url is already normalized, retrun as it is
		let urlPattern = /^https:\/\/www.amazon.co.jp\/.*?dp\/([0-9A-Z]{10})\/?.*$/;
		let mr = url.match(urlPattern);
		if (mr) {
			return 'https://www.amazon.co.jp/dp/' + mr[1] + '/';
		}
		else {
			return url;
		}
	}

	// normalize page url - get original image url from resized url
	static normalizeImageUrl(url) {
		let originalUrl = "";
		if (url) {
			originalUrl = url.replace(/\._[a-zA-Z0-9_,-]+_\.jpg$/g, ".jpg");
		}
		return originalUrl;
	}
}

// TrialReading Helper class
// Retrieve Trial reading data from https://read.amazon.co.jp/
class AmazonTrialReadingHelper {
	// change favicon with kindle reading icons to indicate completed loading trial reading images
	static changeFaviconWithReading() {
		// favicon
		const faviconUrl = 'https://m.media-amazon.com/images/G/01/kfw/mobile/kindle_favicon._CB624847354_.png';
		let faviconElement = $("<link>", {
			id: 'trial-reading-favicon',
			rel: 'icon',
			href: faviconUrl,
			type: 'image/png'
		});
		$('head').each(function () {
			$(this).append(faviconElement);
		});
	}

	// load trial reading images from read.amazon.co.jp
	static loadTrialReadingImages(trialReadingAsin, marketPlaceId) {
		// AmazonTrialReadingHelper.loadTrialReadingImagesFromGotoPage(trialReadingAsin, marketPlaceId);
		AmazonTrialReadingHelper.loadTrialReadingImagesFromGotoPage(trialReadingAsin, marketPlaceId);
		AmazonTrialReadingHelper.loadTrialReadingImagesFromStartReading(trialReadingAsin, marketPlaceId);
	}

	// load trial reading images
	// Approach 1: retrieve images from go-to-page response 
	static loadTrialReadingImagesFromGotoPage(trialReadingAsin, marketPlaceId) {
		let mySummaryAreaElement = getWindowShoppingElement();

		// Approach 1: retrieve images from go-to-page response
		console.log('[*] Approach 1: retrieve images from go-to-page response');

		// create element
		let trialReadingGotopageElement = createSummarySectionElement('trialReading-gotopage');
		mySummaryAreaElement.append(trialReadingGotopageElement);

		// retrieve trial reading images
		const gotoPageUrl = `https://read.amazon.co.jp/sample/print/go-to-page?asin=${trialReadingAsin}&buyingAsin=${trialReadingAsin}&page=1&token=null`

		$.ajax({
			type: "GET",
			url: gotoPageUrl,
			xhrFields: {
				withCredentials: true
			}
		}).then(
			// success
			function (data, textStatus, jqXHR) {
				console.log('[*] go-to-page response: ');
				console.debug(jqXHR.status);
				console.debug(textStatus);
				console.debug(data);

				// print error message if available
				if (data.error) {
					console.log('[*] go-to-page no data');
					return;
				}

				// obtain urls from hiRes or mainUrl object in JSON
				console.debug('[*] Obtain Trial Reading Images');
				const largeImageUrlRegex = /https:\/\/\w+\.cloudfront\.net\/[0-9a-zA-Z.]+\.LXXXXXXX\.jpg\?[a-zA-Z0-9=~&._-]+/g;

				const imageUrlsJson = data.largeImageUrls;
				Object.keys(imageUrlsJson).forEach(function (key) {
					console.log('[*] Image data: ' + [key] + ': ' + imageUrlsJson[key]);
					let imageLinkElement = createImageLinkElement('trial-reading-gotopage-' + key, imageUrlsJson[key]);
					$('#trialReading-gotopage-content').append(imageLinkElement);
				});

				$('#trialReading-gotopage-status').text('[*] Completed loading trialReading-gotopage.');
			},
			// error
			function (jqXHR, textStatus, errorThrown) {
				console.log(`[!] ERROR: Failed to retrive trial reading go-to-page response. / Status: ${jqXHR.status} ${textStatus}`);
				$('#trialReading-gotopage-status').text('[!] Failed loading trialReading-gotopage. Use the link above.');
			}
		);
	}

	// load trial reading images
	// Approach 2: from market place id
	static loadTrialReadingImagesFromStartReading(trialReadingAsin, marketPlaceId) {
		let mySummaryAreaElement = getWindowShoppingElement();

		// Approach 2: from market place id
		// Steps:
		// - Retrieve market place id from url
		//   - e.g. https://read.amazon.co.jp/trialReadingAsin=B0XXXXXXXX/marketPlaceId=A1XXXXXXXXXXXX/
		// - Access the startReading url to obtain contentVersion and formatVersion
		//   - e.g. https://read.amazon.co.jp/service/web/content/startReading?asin=B0XXXXXXXX&marketplace=XXXXXXXXXXXXXX&cor=JP&clientVersion=999999999&randval=0.20289257499346114
		// - Access the getFileUrl to obtain signed urls
		//   - e.g. https://read.amazon.com/service/web/content/getFileUrl?asin=B0XXXXXXXX&contentVersion=xxxxxxxx&formatVersion=CR!XXXXXXXXXXXXXXXXXXXXXXXXXXXX&isSample=true&resourceIds=24,25&randomValue=0.2884068378403035
		// - Access the signed urls
		// - If the response is an image data, load it in the page.
		// - If the response is a javascript (callback function), parse it and load the image data part in the page

		let trialReadingSignedElement = createSummarySectionElement('trialReading-signed');
		mySummaryAreaElement.append(trialReadingSignedElement);

		// let trialReadingSignedStatusElement = $("<div>", {
		// 	id: 'trialReading-signed-status',
		// 	class: 'mysummary_section_status'
		// }).appendTo('#trialReading-signed-content');

		// retrieve marketplace id from url
		console.debug('[*] Market Place ID: ' + marketPlaceId);

		// Access the startReading url to obtain contentVersion and formatVersion
		const startReadingUrl = `https://read.amazon.co.jp/service/web/content/startReading?asin=${trialReadingAsin}&marketplace=${marketPlaceId}&cor=JP&clientVersion=999999999&randval=0.20289257499346114`;
		console.debug('[*] startReadingUrl: ' + startReadingUrl);

		$('#trialReading-signed-status').text('[*] Start loading signed urls...');

		$.ajax({
			type: "GET",
			url: startReadingUrl,
			xhrFields: {
				withCredentials: true
			}
		}).then(
			// success
			function (data, textStatus, jqXHR) {
				console.log('[*] startReading url response: ' + jqXHR.status + textStatus);

				// obtain contentVersion and formatVersion
				const contentVersion = data.contentVersion;
				console.debug('[*] contentVersion: ' + contentVersion);

				const formatVersion = data.formatVersion;
				console.debug('[*] formatVersion: ' + formatVersion);

				// Access the getFileUrl to obtain sample image urls
				const resourceIdFrom = 0;
				const resourceIdTo = 511;
				let resourceIds = [];
				for (let i = resourceIdFrom; i <= resourceIdTo; ++i) {
					resourceIds.push(i);
				}
				const resourceIdsParameterValue = resourceIds.join(',');

				// create placeholder for each signed url image
				for (let i = resourceIdFrom; i <= resourceIdTo; ++i) {
					var originalTitleElement = $("<div>", {
						id: 'trialReading-signed-content-placeholder-' + i
					}).appendTo('#trialReading-signed-content');
				}

				const getFileUrl = `https://read.amazon.com/service/web/content/getFileUrl?asin=${trialReadingAsin}&contentVersion=${contentVersion}&formatVersion=${formatVersion}&isSample=true&resourceIds=${resourceIdsParameterValue}&randomValue=0.2884068378403035`
				console.debug('[*] getFileUrl: ' + getFileUrl);
				$.ajax({
					type: "GET",
					url: getFileUrl,
					xhrFields: {
						withCredentials: true
					}
				}).then(
					// success
					function (data, textStatus, jqXHR) {
						console.log('[*] getFileUrl response: ' + jqXHR.status + ' ' + textStatus);

						// if not supported, return
						if (data.downloadRestrictionReason) {
							console.log(`[!] getFileUrl failed. Error code: ${data.downloadRestrictionReason.reasonCode}`);
							$('#trialReading-signed-status').text(`[!] getFileUrl failed. Error code: ${data.downloadRestrictionReason.reasonCode}`);
							return;
						}

						const imageUrlsJson = data.resourceUrls;
						// let erroredId = null; // set the id if getting 403 error, then skip rest ids
						Object.keys(imageUrlsJson).forEach(function (key) {
							const index = key;
							const signedUrlJson = imageUrlsJson[key];
							const id = signedUrlJson.id;
							const signedUrl = signedUrlJson.signedUrl;
							console.log('[*] Image data: ' + id + ': ' + signedUrl);

							// retrieve each signedUrl
							$.ajax({
								type: "GET",
								url: signedUrl,
								xhrFields: {
									withCredentials: true
								}
							}).then(
								// success
								function (data, textStatus, jqXHR) {

									// check content-type and load the image
									const contentType = jqXHR.getResponseHeader('Content-Type');
									const status = `[*] Sample Image signedUrl id: ${id} / Status ${jqXHR.status} / ${contentType}`;
									console.log(status);
									$('#trialReading-signed-status').text(status);

									if (contentType == 'application/javascript') {
										// if javascript, extract data:image part and create image element
										// skip, maybe it is enough if the all image/jpeg are loaded
										const imageDataMatchResult = data.toString().match(/"(data:image\/jpeg;base64,.+?)"/);
										if (imageDataMatchResult) {
											let imageLinkElement = createImageLinkElement('trial-reading-signed-' + id, imageDataMatchResult[1]);
											$(imageLinkElement).attr('download', 'download');
											$('#trialReading-signed-content-placeholder-' + id).append(imageLinkElement);
										}
									}
									else if (contentType == 'image/jpeg') {
										// if image itself, create image element
										// skip, it should be enough if the all data:image/parts are loaded
										// let imageLinkElement = createImageLinkElement('trial-reading-signed-' + id, signedUrl);
										// $('#trialReading-signed-content-placeholder-' + id).append(imageLinkElement);
									}
									else {
										// if other content-type, skip it
										// console.debug('[!] not image or javascript data');
									}

									if (id == resourceIdTo) {
										$('#trialReading-signed-status').text('[*] Completed loading trial reading images.');
										AmazonTrialReadingHelper.changeFaviconWithReading();
									}
								},
								// error
								function (jqXHR, textStatus, errorThrown) {
									const status = `[!] Sample Image signedUrl id: ${id} / Status ${jqXHR.status} / ERROR`;
									console.log(status);
									$('#trialReading-signed-status').text(status);

									if (id == resourceIdTo) {
										$('#trialReading-signed-status').text('[*] Completed loading trial reading images.');
										AmazonTrialReadingHelper.changeFaviconWithReading();
									}
								}
							);
						});
					},
					// error
					function (jqXHR, textStatus, errorThrown) {
						console.log(`[!] ERROR: Failed to retrive getFileUrl. / Status: ${jqXHR.status}`);
					}
				);
			},
			// error
			function (jqXHR, textStatus, errorThrown) {
				console.log(`[!] ERROR: Failed to retrive contentVersion/formatVersion. / Status: ${jqXHR.status}`);
			}
		);
	}
}

// insert my summary area once the page is loaded
window.onload = function () {
	main();
};

// main function
function main() {
	console.debug('[*] Loading page completed. Started creating the window shopping part...');

	// phrases to check the page type
	const ageVerificationRedirectUrlPrefix = 'https://www.amazon.co.jp/gp/product/black-curtain-redirect.html';
	const ageVerificationPageUrl = 'https://www.amazon.co.jp/black-curtain/black-curtain';

	const antiAutomatedAccessPhrase = 'To discuss automated access to Amazon data please contact api-services-support@amazon.com.';
	const markupHtml = document.documentElement.innerHTML;

	// get age verification bypass flag from LocalStorage
	const enableAgeVerificationBypassLocalStorageValue = localStorage.getItem('enableAgeVerificationBypass')
	const enableAgeVerificationBypass = (enableAgeVerificationBypassLocalStorageValue == 'true');
	console.debug('[*] Check enableAgeVerificationBypass flag: ' + enableAgeVerificationBypass);

	if (location.href.indexOf(ageVerificationPageUrl) == 0 || $('#black-curtain-warning').length !== 0) {
		// if age verification page
		// check bypass flag. If true, submit 'yes' button automatically
		// e.g. https://www.amazon.co.jp/black-curtain/black-curtain?ie=UTF8&returnUrl=%2Fdp%2FXXXXXXXXXX
		if (enableAgeVerificationBypass) {
			console.debug('[*] Identified age verification page - black curtain');
			console.debug('[*] Click yes button... Move to href url instead...');
			const url = $('#black-curtain-yes-button > span > a').attr('href');
			console.debug(url);
			location.href = url;
		}
	}
	else if ($('a[href^="' + ageVerificationRedirectUrlPrefix + '"]').length !== 0) {
		// if age verification page with redirect link
		// check bypass flag. If true, submit 'yes' button automatically
		if (enableAgeVerificationBypass) {
			console.debug('[*] Identified age verification page (redirection page)');
			console.debug('[*] Click yes button...');
			const redirectUrl = $('a[href^="' + ageVerificationRedirectUrlPrefix + '"]')[0].click();
		}
	}
	else if (markupHtml.indexOf(antiAutomatedAccessPhrase) != -1) {
		// if anti automated access page, wait some seconds and then reload the page
		// The page sometimes appears if accessing via Tor network
		console.debug('[*] Anti automated access page. Sleep 10 sec, then reload the page...');
		sleep(10, function () {
			location.reload();
		});
	}
	else {
		insertWindowShoppingArea();
	}
}

// insert summary area in the page
function insertWindowShoppingArea() {
	// notification start
	console.debug("[*] insertWindowShoppingArea start.");

	// get product information and set it to the AmazonProduct instance
	AmazonProductPageHelper.getProductInformationFromPage();

	// remove purchase links to avoid misoperation
	// removePurchaseLinks();

	// create my summary area
	let mySummaryAreaElement = $("<div>", {
		id: 'mySummaryArea',
		width: '100%'
	}).insertBefore('#dp');

	// Navigation area
	insertNavigation();

	// title information
	insertTitleInformation();

	// product information
	insertProductInformation();

	// insert landing image
	insertLandingImage();

	// insert self carousel data
	insertSelfCarousel();

	// insert large sample images
	insertSampleImages();

	// insert trial reading
	insertTrialReadingImages();

	// insert similarity items
	insertCarouselItems();

	// notification finish
	console.debug("[*] insertWindowShoppingArea ended.");
}

// insert navigation links
function insertNavigation() {
	console.debug("[*] Navigation start");

	// create title information element
	let sectionElement = createSummarySectionElement('navigationLinks');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(sectionElement);

	// add navigate link
	let carouselLink = createNavigateLinkElement('carouselItems', 'Recommended_Items');
	carouselLink.attr('accesskey', 'c');
	$('#navigationLinks-content').append(carouselLink);

	// add navigate link
	let dpLink = createNavigateLinkElement('dp', 'Original_Product_Part');
	dpLink.attr('accesskey', 'p');
	$('#navigationLinks-content').append(dpLink);

	// copy url button
	let copyUrlButton = createCopyButtonElement('copyUrlButton', '', product.url);
	copyUrlButton.text('Copy URL');
	$('#navigationLinks-content').append(copyUrlButton);

	console.debug("[*] Navigation end");
}

// insert title area
function insertTitleInformation() {
	console.debug("[*] Title Information start");

	// create title information element
	let titleInformationElement = createSummarySectionElement('titleInformation');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(titleInformationElement);

	// set up title information
	$('#titleInformation-content').text(product.title);

	console.debug("[*] Title Information end");
}

// product information
function insertProductInformation() {
	console.debug("[*] Product Description start");

	// create title information element
	let productInformationElement = createSummarySectionElement('productInformation');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(productInformationElement);

	let productInformationTextElement = $("<textarea>", {
		id: 'productInformationText',
		rows: 12,
		cols: 20,
		// readonly: 'readonly',
		style: 'color: #f0f0f0; background-color: #202020; font-size: 1.5em; line-height: 1.5em;'
	}).appendTo('#productInformation-content');
	productInformationTextElement.text(product.summary);

	// copy button
	let copyButton = createCopyButtonElement('productInformationTextCopy', 'z', $('#productInformationText').text());
	$('#productInformation-content').append(copyButton);

	console.debug("[*] Product Information end");
}

// insert landing image
function insertLandingImage() {
	console.debug("[*] Landing Image start");

	// create title information element
	let largeThumbnailImageElement = createSummarySectionElement('largeLandingImage');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(largeThumbnailImageElement);

	// get landing page image
	let url = product.landingImageUrl;
	if (url != '') {
		let landingImageElement = createImageLinkElement('landing-page', url);
		$('#largeLandingImage-content').append(landingImageElement);
	}

	// copy download command button
	let landingImageDownloadTextElement = createCopyButtonElement('landingImageDownloadText', 's', url);
	$('#largeLandingImage-content').append(landingImageDownloadTextElement);

	console.debug("[*] Landing Image end");
}

// insert the carousel for the item which is showed in the page
// note that for some products we can obtain a large image uri only from carousel info
function insertSelfCarousel() {
	console.debug("[*] insertSelfCarouselElement start");

	// create title information element
	let selfCarouselElement = createSummarySectionElement('selfCarousel');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(selfCarouselElement);

	// updated when carousel data retrieved in insertCarouselItems() function

	console.debug("[*] insertSelfCarouselElement end");
}

// insert sample images
function insertSampleImages() {
	console.debug("[*] Sample Image start");

	let mySummaryElement = getWindowShoppingElement();
	let largeSampleImagesElement = createSummarySectionElement('largeSampleImages');
	mySummaryElement.append(largeSampleImagesElement);

	let urls = product.sampleImageUrls;

	// print images to page
	if (urls) {
		let sampleUrlIndex = 0;
		// create img element and append to the parent element
		urls.forEach(function (url) {
			// skip url if delivery notification image
			const deliveryNotificationUrl = 'https://images-na.ssl-images-amazon.com/images/I/718YL%2BADigL.jpg';
			if (url == deliveryNotificationUrl) {
			}
			else {
				let imageLinkElement = createImageLinkElement('sample-image-' + sampleUrlIndex, url);
				largeSampleImagesElement.append(imageLinkElement);
				++sampleUrlIndex;
			}
		});
	}

	console.debug('[*] Sample Image count:' + urls.length);
	console.debug('[*] Sample Image urls:');
	console.debug(urls);
	$('#largeSampleImages-status').text('Sample images count: ' + urls.length);

	console.debug("[*] Sample Image end");
}

// insert trial reading images
function insertTrialReadingImages() {
	console.debug("[*] Trial Reading Image start");

	// create area for trial reading
	let mySummaryElement = getWindowShoppingElement();
	let trialReadingElement = createSummarySectionElement('trialReading');
	mySummaryElement.append(trialReadingElement);

	// check if a trial reading link available
	let hasTrialReading = ($('#litb-read-frame').length != 0 || $('#ebooksSitbLogo').length != 0 || $('#sitbLogo').length != 0);
	if (!hasTrialReading) {
		$('#trialReading-status').text('[!] Trial Reading: Not Available');
		return;
	}

	// retrieve trial reading images
	$('#trialReading-status').text('[*] Trial Reading: Available');

	// obtain ASIN for trial reading image
	let trialReadingAsin = product.asin;
	// if another ASIN for trial reading found in the page, overwrite the target asin
	if ($('#litb-read-frame').length != 0) {
		const dataSrc = $('#litb-read-frame').attr('data-src');
		const found = dataSrc.match(/^https:\/\/read\.amazon\.co\.jp\/sample\/([0-9a-zA-Z]{10})/);
		if (found) {
			trialReadingAsin = found[1];
		}
	}

	// obtain market place id
	let marketPlaceId = '';
	$('.mkpID').each(function () {
		marketPlaceId = $(this).val();
	});

	// create link to read.amazon.co.jp with parameters
	const readUrl = `https://read.amazon.co.jp/trialReadingAsin=${trialReadingAsin}/marketPlaceId=${marketPlaceId}/`;
	let trialReadingPageLinkElement = $('<a>', {
		id: 'trialReadingPageLink',
		href: readUrl,
		target: '_blank',
		text: readUrl
	}).appendTo('#trialReading-content');

	// load trial reading images using ASIN and Market Place ID
	AmazonTrialReadingHelper.loadTrialReadingImages(trialReadingAsin, marketPlaceId);

	console.debug("[*] Trial Reading Image end");
}

// insert recommended items
function insertCarouselItems() {
	console.debug("[*] Carousel Items start");

	// creaate carousel items element
	let carouselItemsElement = createSummarySectionElement('carouselItems');

	// append to summary elemtnt
	let mySummaryElement = getWindowShoppingElement();
	mySummaryElement.append(carouselItemsElement);

	// item list area
	let carouselItemListElement = createBlockElement('carouselItemList');
	$('#carouselItems-content').append(carouselItemListElement);

	// status element for similarities area
	let carouselOperationElement = createBlockElement('carouselOperationElement');
	$('#carouselItems-content').append(carouselOperationElement);

	// add button to open all pages 
	let openAllPagesButton = $("<button>", {
		type: 'button',
		id: 'carouselOpenAllPages',
		text: 'Open all pages'
	});
	// define a function as onclick
	openAllPagesButton.on('click', function () {
		console.debug('open all pages');
		if (window.confirm('Do you really want to open all pages?')) {
			$('.smilarity-page-link').each(function () {
				window.open($(this).attr('href'));
			})
		}
	});
	carouselOperationElement.append(openAllPagesButton);

	// add button to open all images 
	let openAllImageesButton = $("<button>", {
		type: 'button',
		id: 'carouselOpenAllImages',
		text: 'Open all images'
	});
	// define a function as onclick
	openAllImageesButton.on('click', function () {
		console.debug('open all images');
		if (window.confirm('Do you really want to open all images?')) {
			$('.smilarity-image-link').each(function () {
				window.open($(this).attr('href'));
			})
		}
	});
	carouselOperationElement.append(openAllImageesButton);

	// load carousel items	
	loadCarouselItems();

	console.debug("[*] Carousel Items end");
}

// load carousel items
function loadCarouselItems() {
	console.debug('[*] loadCarouselItems start');

	// get carousel items
	// target asin list
	let asins = [];

	// add the asin from the current page
	// since in some products we can get the large image only from the carousel info
	let currentAsin = product.asin;
	asins.push(currentAsin);

	// add carousel asin list retrieved from the page
	asins = asins.concat(product.carouselAsins);
	// $('#carouselStats').text('Carousel items: ' + asins.length);

	// Retrieve carousel item information
	// Approach 1: from current page HTML & DOM
	// Steps:
	// - Retrieve acp carousel path from current page html
	//   - e.g. /acp/p13n-desktop-carousel/p13n-desktop-carousel-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-ddddddddddddd/
	//   - Note that the path is printed Removed when loading current page. Fetch location.href again and obtain the path from the response
	let ajaxRequestCurrentPage = {
		type: 'GET',
		url: location.href
	};

	// Approach 2: from renderLazyLoaded
	// retrieve additional asins and url for query from renderLazyLoaded
	// some carousel items are loaded after the page is loaded
	// Note: url for query carousel date is also retrieved from location.href, but it is old method
	const renderLazyLoadedUrl = 'https://www.amazon.co.jp/dram/renderLazyLoaded';

	// post data for renderLazyLoaded
	let encryptedLazyLoadRenderRequest = null;
	$('.json-content').each(function () {
		encryptedLazyLoadRenderRequest = JSON.parse($(this).text());
	});

	let ajaxRequestRenderLazyLoaded = {};
	if (encryptedLazyLoadRenderRequest) {
		// if encryptedLazyLoadRenderRequest found, create a POST request to the renderLazyLoadedUrl
		console.log('[*] Found encryptedLazyLoadRenderRequest. Retrieve additional carousel asin list from renderLazyLoaded url.');
		console.log('[*] encryptedLazyLoadRenderRequest: ' + JSON.stringify(encryptedLazyLoadRenderRequest));
		ajaxRequestRenderLazyLoaded = {
			type: 'POST',
			url: renderLazyLoadedUrl,
			contentType: "application/json",
			dataType: 'json',
			data: JSON.stringify(encryptedLazyLoadRenderRequest)
		};
	}
	else {
		// if encryptedLazyLoadRenderRequest not found, create a dummy request to current page to avoid error in $.when
		console.log('[*] Not Found encryptedLazyLoadRenderRequest.');
		ajaxRequestRenderLazyLoaded = {
			type: 'GET',
			url: location.href
		};
	}

	// Call 2 ajax requests, then load carousel items
	console.debug('[*] Call 2 ajax requests, then load carousel items');

	$.when(
		$.ajax(
			ajaxRequestCurrentPage
		),
		$.ajax(
			ajaxRequestRenderLazyLoaded
		)
	).then(
		// success
		function (result1, result2) {
			console.debug('[*] location.href / renderLazyLoaded request succeeded.');
			// console.debug(result1);
			// console.debug(result2);

			// retrieve contents
			let data1 = result1[0];
			let content1 = data1;
			let data2 = result2[0];
			let content2 = '';
			if (data2.cards && data2.cards[0].content) {
				// console.debug('[*] renderLazyLoaded response data: ');
				// console.debug(data2.cards[0].content);
				content2 = data2.cards[0].content;
			}

			// retrieve acp carousel path from location.href in current page
			// e.g. /acp/p13n-desktop-carousel/p13n-desktop-carousel-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-ddddddddddddd/
			const acpPathRegex = /\/acp\/p13n-desktop-carousel\/[a-zA-Z0-9_+-]+\//;
			let acpPath = '';
			// update if the path is found in the response
			let dataAcpPathMatch = content1.match(acpPathRegex);
			if (dataAcpPathMatch) {
				acpPath = dataAcpPathMatch[0];
				console.debug(`[*] acp carousel path found: ${acpPath}`);
			}
			else {
				console.log('[!] Failed to retrieve acp carousel path from current page. Trying renderLazyLoaded...');

				// retrieve acp carousel path from renderLazyLoadedUrl response
				dataAcpPathMatch = content2.match(acpPathRegex);
				if (dataAcpPathMatch) {
					acpPath = dataAcpPathMatch[0];
					console.debug(`[*] acp carousel path found: ${acpPath}`);
				}
			}

			// carousel query url. post asin list and retrieve carousel data
			const carouselQueryUrl = `https://www.amazon.co.jp${acpPath}getCarouselItems?pd_rd_w=v&pf_rd_p=3&pf_rd_r=A&pd_rd_r=f&pd_rd_wg=H&ref_=pd_sbs`;
			console.debug('[*] carouselQueryUrl: ' + carouselQueryUrl);

			// retrieve additional carousel asins in renderLazyLoadedUrl
			// e.g. \&quot;BXXXXXXXXX\&quot;
			const asinRegexp = /\\&quot;([0-9A-Z]{10})\\&quot/g;
			const asinMatches = content2.matchAll(asinRegexp);
			for (const asinMatch of asinMatches) {
				// console.debug(`[*] Added asin ${asinMatch[1]}`);
				asins.push(asinMatch[1]);
			}

			// unique asin list
			const uniqAsins = uniq(asins);
			// debug: print asin count
			console.debug(`[*] Carousel asin count: ${uniqAsins.length}`);
			// display count in current page
			$('#carouselItems-status').text(`[*] Carousel asin count: ${uniqAsins.length}`);

			// loop and process each 30 carousel items
			while (true) {
				// separate asins as each 30 asins
				// got 502 error if asin count >= 31
				// const itemCount = asins.length;
				const asinCountInGroup = 30;

				// retrieve 30 asins to process
				let targetAsins = uniqAsins.splice(0, asinCountInGroup);
				console.debug('[*] carousel group: ');
				console.debug(targetAsins);
				if (targetAsins.length == 0) {
					break;
				}

				// create json data to post
				let asinPayload = [];
				targetAsins.forEach(function (asin) {
					asinPayload.push('"{\\"id\\":\\"' + asin + '\\"}"');
				});
				const carouselPostData = '{"aCarouselOptions":"{\\"ajax\\":{\\"id_list\\":[]},\\"autoAdjustHeightFreescroll\\":true,\\"first_item_flush_left\\":false,\\"initThreshold\\":100,\\"loadingThresholdPixels\\":100,\\"name\\":\\"p\\",\\"nextRequestSize\\":6,\\"set_size\\":10}","faceoutspecs":"{}","faceoutkataname":"GeneralFaceout","individuals":"0","language":"en-US","linkparameters":"{\\"pd_rd_w\\":\\"mFBYH\\",\\"pf_rd_p\\":\\"f\\",\\"pf_rd_r\\":\\"P\\",\\"pd_rd_r\\":\\"b\\",\\"pd_rd_wg\\":\\"t\\"}","marketplaceid":"A","name":"p","offset":"6","reftagprefix":"pd_sim","aDisplayStrategy":"swap","aTransitionStrategy":"swap","aAjaxStrategy":"promise","ids":[' + asinPayload.join(',') + '],"indexes":[1]}';

				// debug
				console.debug('[*] Carousel post data: ');
				console.debug(carouselPostData);

				// get similarity items using jQuery
				$.ajax({
					type: 'POST',
					url: carouselQueryUrl,
					headers: {
						'x-amz-acp-params': 'tok=a;ts=1;rid=A;d1=1;d2=0;tpm=C;ref=p'
					},
					contentType: "application/json",
					dataType: 'json',
					data: carouselPostData
				}).then(
					// success
					function (dataCarousel, textStatus, jqXHR) {
						console.debug('[*] Carousel post resuest succeeded.');
						console.debug('[*] Carousel response data:');
						console.debug(dataCarousel);

						// print error message if available
						if (dataCarousel.error) {
							console.debug(`[!] Failed to retrieve carousel items / error key: ${dataCarousel.error.text.key}`);
						}

						let carouselItems = [];

						// retrieve each items
						dataCarousel.products.forEach(function (p) {
							if (!p) {
								console.debug('[!] Carousel product information is null. skip this data.');
								return;
							}

							let asin = '';
							let title = p.title.titleText;
							let thumbImageUrl = p.image.imageUri.replace('_AC_UL160_SR160,160_', '_AC_UL320_SR240,320_');;
							let pageUrl = p.link.url;
							let originalImageUrl = AmazonProductPageHelper.normalizeImageUrl(thumbImageUrl);

							let dp = pageUrl.match(/\/dp\/([0-9A-Z]{10})\//);
							if (dp) {
								pageUrl = 'https://www.amazon.co.jp' + dp[0];
								asin = dp[1];
							}

							let item = {
								'asin': asin,
								'title': title,
								'thumbImageUrl': thumbImageUrl,
								'pageUrl': pageUrl,
								'originalImageUrl': originalImageUrl
							}

							carouselItems.push(item);
						});

						console.debug('[*] Carousel item list printed in page:');
						console.debug(carouselItems);

						// add similarity items to the page
						carouselItems.forEach(function (item) {
							// create an element to add
							// page link element
							let pageLinkElement = $("<a>", {
								href: item.pageUrl,
								title: item.title,
								target: '_blank',
								style: 'margin: 0em; line-height: 150%;',
								class: 'smilarity-page-link'
							});

							// thumb image element
							let thumbImageElement = $("<img>", {
								src: item.thumbImageUrl,
								alt: item.title
							}).appendTo(pageLinkElement);

							// image link element
							let imageLinkElement = $("<a>", {
								href: item.originalImageUrl,
								title: item.title,
								target: '_blank',
								style: 'position:absolute; top: 0px; left: 0px; background-color: #d08000; color: #404040; border: 1px solid #f0f0f0; font-weight: bold; padding: 0.2em 0.2em;',
								class: 'smilarity-image-link',
								text: 'Large image'
							});

							// item element
							let itemElement = $("<span>", {
								style: 'margin: 0.25em 0.25em; position: relative;',
								class: 'carouselItem',
								title: item.title,
								thumbImageUrl: item.thumbImageUrl,
								pageUrl: item.pageUrl,
								originalImageUrl: item.originalImageUrl
							});
							itemElement.append(pageLinkElement);
							itemElement.append(imageLinkElement);

							// add the item element into page 
							if (item.asin == currentAsin) {
								// if the item is the same as current page, insert the large image to self carousel area
								let imageLinkElement = createImageLinkElement('selfCarouselImage', item.originalImageUrl);
								$('#selfCarousel-content').append(imageLinkElement);
								// copy button
								let copyButton = createCopyButtonElement('selfCarouselImageUrlCopy', '', item.originalImageUrl);
								$('#selfCarousel-content').append(copyButton);
							}
							else {
								// if the item is a standard carousel item, insert carousel element to the standard carousel area
								$('#carouselItems').append(itemElement);
							}
						});
					},
					// error
					function (jqXHR, textStatus, errorThrown) {
						console.debug(`[!] Failed to retrieve carousel data. Status Code: ${jqXHR.status}`);
					}
				);
			}
		},
		// error
		function (jqXHR, textStatus, errorThrown) {
			console.debug(`[!] Failed to request location.href / renderLazyLoaded. Status Code: ${jqXHR.status}`);
		}
	);

	console.debug('[*] loadCarouselItems end.');
}

// get window shopping element
function getWindowShoppingElement() {
	const wsArea = $('#mySummaryArea');
	return wsArea;
}

// create a summary section element
// - create a div element
// - consists of a section header and section content elements
// return: an element for section
function createSummarySectionElement(sectionName) {
	if (sectionName == null) {
		sectionName = '';
	}

	let sectionElement = createBlockElement(sectionName);
	sectionElement.addClass('mysummary_section');

	let headerElement = createBlockElement(sectionName + '-header');
	headerElement.text(sectionName);
	headerElement.addClass('mysummary_section_header');
	sectionElement.append(headerElement);

	let statusElement = createBlockElement(sectionName + '-status');
	statusElement.addClass('mysummary_section_status');
	sectionElement.append(statusElement);

	let contentElement = createBlockElement(sectionName + '-content');
	contentElement.addClass('mysummary_section_content');
	sectionElement.append(contentElement);

	return sectionElement;
}

// create block element
// return: an element for block
function createBlockElement(id) {
	if (id == null) {
		id = '';
	}

	let element = $("<div>", {
		id: id,
		class: 'mysummary_block'
	});

	return element;
}

// create separator
// return: an element for separator
function createSeparatorElement() {
	let separator = $("<hr>", {
		class: 'mysummary_separator'
	})
	return separator;
}

// create image element with link
// id: ID for the HTML element
// url: url for the image
// return: jQuery element for the link
function createImageLinkElement(id, url) {
	// if id not specified, assign a random string to id
	if (id == null || id == '') {
		id = Math.random().toString(36).substring(2);
	}
	if (url == null) {
		url = '';
	}

	// link element
	let linkElement = $("<a>", {
		id: 'link-' + id,
		title: 'link-' + id,
		href: url,
		target: '_blank',
		rel: 'noopener noreferrer nofollow',
		class: 'mysummary_image_link'
	});
	// image elemnt
	let imageElement = $("<img>", {
		id: 'image-' + id,
		alt: 'image-' + id,
		src: url,
		class: 'mysummary_image'
	}).appendTo(linkElement);

	return linkElement;
}

// create a link element to navigate
// anchor: id attributre to navigate
// label: label for the link
// return: jQuery element for the link
function createNavigateLinkElement(anchor, label) {
	// if id not specified, assign a random string to id
	if (anchor == null || anchor == '') {
		anchor = Math.random().toString(36).substring(2);
	}

	if (label == null || label == '') {
		label = 'navigation-' + anchor;
	}

	let linkElement = $("<a>", {
		id: 'navigate-' + anchor,
		title: label,
		href: '#' + anchor,
		style: 'font-weight: bold; font-size: 120%; margin: 0em 0.5em;'
	});

	linkElement.text(label);

	return linkElement;
}

// create a button element to copy text
function createCopyButtonElement(id, accesskey, text) {
	let element = $("<button>", {
		id: id,
		style: 'margin: 0.5em 0.5em; color: #f0f0f0; background-color: #202020; font-size: 1.5em; line-height: 1.5em;'
	});

	// set attributes
	element.text('Copy');

	// set accesskey
	if (accesskey) {
		element.attr('accesskey', accesskey)
	}

	// set event handler
	element.on('click', function () {
		console.debug('[*] Copy text to clipboard:' + text);
		navigator.clipboard.writeText(text);
	});

	return element;
}

// remove or hide links for purchage
function removePurchaseLinks() {
	// buy one click buyOneClick
	$('#checkoutButtonId').remove();

	// link for not unlimited purchage
	$('a[data-action="a-expander-toggle"]').each(function () {
		//$(this).attr('style', 'display: none');
		$(this).remove();
	});
}

function uniq(array) {
	return [...new Set(array)];
}

// define sleep function
function sleep(waitSec, callbackFunc) {

	let spanedSec = 0;

	let waitFunc = function () {

		spanedSec++;

		if (spanedSec >= waitSec) {
			if (callbackFunc) callbackFunc();
			return;
		}

		clearTimeout(id);
		id = setTimeout(waitFunc, 1000);

	};

	let id = setTimeout(waitFunc, 1000);

}
