'use strict';

console.debug('[*] amazon-read.js loaded.');

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
                $('#trialReading-gotopage-status').text('[!] Failed loading trialReading-gotopage. Use the link below.');
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
    console.debug('[*] page load completed. start processing...');

    // create window shopping area
    let windowShoppingAreaElement = $("<div>", {
        id: 'mySummaryArea'
    }).insertBefore('#g');

    // hide #g element. it describes that the page is 404 error.
    $('#g').attr('style', 'display: none;');

    // insert Trial Reading area
    insertTrialReadingImages();

    console.debug('[*] completed processing.');
}

// insert trial reading images
function insertTrialReadingImages() {
    console.debug("[*] Trial Reading Image start");

    // retrieve ASIN from url
    // example: https://read.amazon.co.jp/trialReadingAsin=XXXXXXXXXX/marketPlaceId=XXXXXXXXXXXXXX/
    let trialReadingAsin = '';
    const url = location.href;
    const asinRegex = /\/trialReadingAsin=([A-Z0-9]{10})\//;
    const asinMatchResult = url.match(asinRegex);
    if (asinMatchResult) {
        trialReadingAsin = asinMatchResult[1];
    }
    console.debug(`[*] Trial Reading ASIN: ${trialReadingAsin}`);

    // retrieve marketplace id from url
    // example: https://read.amazon.co.jp/trialReadingAsin=XXXXXXXXXX/marketPlaceId=XXXXXXXXXXXXXX/
    let marketPlaceId = '';
    const marketPlaceIdRegex = /\/marketPlaceId=([A-Z0-9]{14})\//;
    const marketPlaceIdMatchResult = url.match(marketPlaceIdRegex);
    if (marketPlaceIdMatchResult) {
        marketPlaceId = marketPlaceIdMatchResult[1];
    }
    console.debug(`[*] Market Place ID: ${marketPlaceId}`);

    // change favion
    AmazonTrialReadingHelper.changeFaviconWithReading();

    // create area for trial reading
    let mySummaryElement = getWindowShoppingElement();
    let trialReadingElement = createSummarySectionElement('trialReading');
    mySummaryElement.append(trialReadingElement);

    // add link to the original page
    var linkToOriginalPage = $("<a>", {
        id: 'originalPageLink',
        href: 'https://www.amazon.co.jp/dp/' + trialReadingAsin + '/',
        target: '_blank',
        text: 'https://www.amazon.co.jp/dp/' + trialReadingAsin + '/'
    }).prependTo('#trialReading-content');

    // obtain title from metadata
    const titleUrl = `https://read.amazon.co.jp/sample/meta/${trialReadingAsin}`
    $.ajax({
        type: "GET",
        url: titleUrl,
        xhrFields: {
            withCredentials: true
        }
    }).then(
        // success
        function (data, textStatus, jqXHR) {
            console.log('[*] Metadata retrieve results: ');
            console.debug(data);
            const title = data.title;

            // update title
            $('title').each(function () {
                $(this).text('[Trial]' + title);
            });

            // link to the original page
            var originalTitleElement = $("<div>", {
                id: 'originalTitle',
                text: title
            }).prependTo('#trialReading-content');
        },
        // error
        function (jqXHR, textStatus, errorThrown) {
            console.log(`[!] ERROR: Failed to retrive trial title. / Status: ${jqXHR.status}`);
        }
    );

    // load Trial Reading images
    AmazonTrialReadingHelper.loadTrialReadingImages(trialReadingAsin, marketPlaceId);

    console.debug("[*] Trial Reading Image end");
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
    var linkElement = $("<a>", {
        id: 'link-' + id,
        title: 'link-' + id,
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: 'mysummary_image_link'
    });
    // image elemnt
    var imageElement = $("<img>", {
        id: 'image-' + id,
        alt: 'image-' + id,
        src: url,
        class: 'mysummary_image'
    }).appendTo(linkElement);

    return linkElement;
}
