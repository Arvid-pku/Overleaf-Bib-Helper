// ==UserScript==
// @name         Overleaf-Bib-Helper
// @namespace    com.Xunjian.overleaf
// @version      1.2
// @description  Enhances Overleaf by allowing article searches and BibTeX retrieval from DBLP and Google Scholar
// @author       Xunjian Yin
// @match        https://www.overleaf.com/project/*
// @match        https://cn.overleaf.com/project*
// @match        https://latex.pku.edu.cn/project/*
// @icon         https://www.overleaf.com/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/core@1.6.8
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.6.12
// @require      https://cdn.jsdelivr.net/npm/simple-notify@1.0.6/dist/simple-notify.min.js
// @resource     notifycss   https://cdn.jsdelivr.net/npm/simple-notify/dist/simple-notify.css
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    GM_addStyle(GM_getResourceText('notifycss'));
    injectScript();
    setInterval(() => {
        if (!document.getElementById('toggleIcon')) {
            injectScript();
        }
    }, 2000);
})();

function injectScript() {
    waitUtil('div.ol-cm-toolbar-button-group.ol-cm-toolbar-end', el => {
        let iconBox = createToggleIcon();
        el.appendChild(iconBox);

        let popupBox = createBox();
        let oldPopup = document.querySelector("#popup");
        if (oldPopup) {
            popupBox = oldPopup;
        }

        document.body.appendChild(popupBox);
        FloatingUIDOM.autoUpdate(iconBox, popupBox, () => {
            FloatingUIDOM.computePosition(iconBox, popupBox, {
                middleware: [FloatingUICore.shift(), FloatingUICore.flip(), FloatingUICore.offset(6)],
            }).then(({ x, y }) => {
                Object.assign(popupBox.style, {
                    top: `${y}px`,
                    left: `${x}px`
                });
            });
        });

        iconBox.onclick = () => {
            togglePopup(popupBox);
        };

        let searchIcon = document.getElementById('search-word');
        let searchInput = document.querySelector('.search-input');
        searchIcon.onclick = () => {
            queryArticle();
        };
        searchInput.onkeydown = (env) => {
            if (env.key === 'Enter') {
                queryArticle();
            }
        };

        // Global Esc key listener
        document.onkeydown = (env) => {
            if (env.key === 'Escape' && showBox) {
                togglePopup(popupBox);
            }
        };

        let content = document.getElementById("search-content");
        content.onclick = (env) => {
            if (env.target.className == 'scholar-data') {
                let source = document.getElementById("source").value;
                let id = env.target.getAttribute("data-cid");
                if (source === "DBLP") {
                    getBibTexDBLP(id).then(bib => {
                        new Notify({
                            status: 'success',
                            title: 'Copy successfully',
                            text: 'Bib has been copied to clipboard',
                            effect: 'slide',
                            type: 'filled'
                        });
                        GM_setClipboard(bib);
                    }).catch(_ => {
                        new Notify({
                            status: 'error',
                            title: "Copy failed",
                            text: "Failed to get BibTeX from DBLP",
                            effect: "slide",
                            type: "filled"
                        });
                    });
                } else if (source === "GoogleScholar") {
                    getBibTexGoogleScholar(id).then(bib => {
                        new Notify({
                            status: 'success',
                            title: 'Copy successfully',
                            text: 'Bib has been copied to clipboard',
                            effect: 'slide',
                            type: 'filled'
                        });
                        GM_setClipboard(bib);
                    }).catch(_ => {
                        new Notify({
                            status: 'error',
                            title: "Copy failed",
                            text: "Failed to get BibTeX from Google Scholar",
                            effect: "slide",
                            type: "filled"
                        });
                    });
                }
            }
        };
    });
}

function togglePopup(popupBox) {
    showBox = !showBox;
    popupBox.style.display = showBox ? 'block' : 'none';
    if (showBox) {
        document.querySelector('.search-input').focus(); // Optional: Focus input when popup opens
    }
}

function queryArticle() {
    let content = document.getElementById("search-content");
    content.innerHTML = "Loading......";
    let word = document.querySelector('input.search-input').value;
    let source = document.getElementById("source").value;
    let resultCount = document.getElementById("resultCount").value;
    if (source === "DBLP") {
        getArticleIDListDBLP(word, resultCount).then(lists => {
            if (lists.length === 0) {
                content.innerHTML = "No articles found.";
                throw new Error("No articles found");
            }
            let searchText = "";
            lists.forEach(article => {
                searchText += scholarContent(`${article.title}@${article.author}`, article.url);
            });
            content.innerHTML = searchText;
        }).catch(err => {
            console.log("Error:", err);
            if (content.innerHTML !== "No articles found.") {
                content.innerHTML = "Failed to load articles.";
            }
            new Notify({
                status: 'error',
                title: 'Request failed',
                text: 'Please check your query or try again later.',
                effect: 'slide',
                type: 'filled'
            });
        });
    } else if (source === "GoogleScholar") {
        getArticleIDListGoogleScholar(word, resultCount).then(lists => {
            if (lists.length === 0) {
                content.innerHTML = "No articles found.";
                throw new Error("No articles found");
            }
            let searchText = "";
            lists.forEach(article => {
                searchText += scholarContent(`${article.title}@${article.author}`, article.id);
            });
            content.innerHTML = searchText;
        }).catch(err => {
            console.log("Error:", err);
            if (content.innerHTML !== "No articles found.") {
                content.innerHTML = "Failed to load articles.";
            }
            new Notify({
                status: 'error',
                title: 'Request failed',
                text: 'Please check your query or try again later.',
                effect: 'slide',
                type: 'filled'
            });
        });
    }
}

function waitUtil(el, callback, timeout = 6000) {
    let query = setInterval(() => {
        let target = document.querySelector(el);
        if (target) {
            clearInterval(query);
            callback(target);
        }
    });
    setTimeout(() => {
        clearInterval(query);
    }, timeout);
}

function createToggleIcon() {
    let iconBox = document.createElement('div');
    iconBox.className = 'ol-cm-toolbar-button';
    iconBox.style.display = 'flex';
    iconBox.style.justifyContent = 'center';
    iconBox.style.alignItems = 'center';
    iconBox.id = "toggleIcon";
    iconBox.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';
    return iconBox;
}

function createBox() {
    let box = document.createElement('div');
    box.id = "popup";
    box.style = 'width:300px;background:#eef;padding:10px;border:1px solid #ccc;border-radius:5px;position:absolute;display:none;top:0px;left:0px';
    box.innerHTML = `
        <style>
            .scholar-data:hover { background:#eee; }
            .scholar-data { border-bottom:1px solid #ccc; cursor:pointer; font-size:12px; padding:5px; }
            input.search-input:hover { outline:none; }
            select, button { padding: 8px; margin: 5px; border-radius: 4px; border: 1px solid #ccc; }
            .popup { font-family: Arial, sans-serif; }
            #search-content { max-height: 300px; overflow-y: auto; margin-top: 10px; }
        </style>
        <div id="search" style="display:flex;">
            <input class="search-input" style="height:22px;flex-grow:1;"></input>
            <div class="search-icon" id="search-word" style="display:flex;justify-content:center;align-items:center;margin-left:5px;outline:none">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </div>
        </div>
        <label for="source">Source: </label>
        <select id="source">
            <option value="DBLP">DBLP</option>
            <option value="GoogleScholar">Google Scholar</option>
        </select>
        <label for="resultCount">Results: </label>
        <select id="resultCount">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
        </select>
        <div id="search-content"></div>
    `;

    let sourceSelect = box.querySelector("#source");
    let countSelect = box.querySelector("#resultCount");
    sourceSelect.value = GM_getValue("searchSource", "DBLP");
    countSelect.value = GM_getValue("resultCount", "5");

    sourceSelect.addEventListener("change", () => GM_setValue("searchSource", sourceSelect.value));
    countSelect.addEventListener("change", () => GM_setValue("resultCount", countSelect.value));

    return box;
}

function scholarContent(ref, cid) {
    return `<div class="scholar-data" data-cid="${cid}">${ref}</div>`;
}

// DBLP Functions
const dblpOrigin = "https://dblp.org";
function getArticleIDListDBLP(query, resultCount) {
    return new Promise((resolve, reject) => {
        let url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(query)}&h=${resultCount}`;
        GM_xmlhttpRequest({
            url: url,
            method: "GET",
            onload: response => {
                let parser = new DOMParser();
                let doc = parser.parseFromString(response.responseText, 'text/xml');
                let hits = doc.querySelectorAll('hit');
                let articlesIDs = [];
                hits.forEach(hit => {
                    let info = hit.querySelector('info');
                    let title = info.querySelector('title').textContent;
                    let authors = Array.from(info.querySelectorAll('author')).map(a => a.textContent).join(', ');
                    let url = info.querySelector('url').textContent;
                    articlesIDs.push({
                        url: url,
                        title: title,
                        author: authors
                    });
                });
                resolve(articlesIDs);
            },
            onerror: err => {
                reject(err);
            }
        });
    });
}

function getBibTexURLDBLP(publicationURL) {
    let path = publicationURL.split("/rec/")[1].split(".html")[0];
    return `${dblpOrigin}/rec/${path}.bib`;
}

function getBibTexDBLP(publicationURL) {
    return new Promise((resolve, reject) => {
        let bibtexURL = getBibTexURLDBLP(publicationURL);
        GM_xmlhttpRequest({
            url: bibtexURL,
            method: "GET",
            onload: response => {
                if (response.status === 200) {
                    resolve(response.responseText);
                } else {
                    reject(new Error("Failed to fetch BibTeX from DBLP"));
                }
            },
            onerror: err => {
                reject(err);
            }
        });
    });
}

// Google Scholar Functions
const origins = ["https://scholar.google.com.hk", "https://scholar.lanfanshu.cn", "https://xs.vygc.top"];
let oldOrigins = GM_getValue("origins", []);
const mergedArray = [...new Set([...origins, ...oldOrigins])];
GM_setValue("origins", mergedArray);
let currentOrigin = () => GM_getValue("configure.origin", "https://scholar.google.com.hk");

let scholarURL = query => `${currentOrigin()}/scholar?hl=zh-CN5&q=${query}&oq=a`;
let scholarRefPageURL = id => `${currentOrigin()}/scholar?q=info:${id}:scholar.google.com/&output=cite&scirp=1&hl=zh-CN`;

function getArticleIDListGoogleScholar(query, resultCount) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            url: scholarURL(query),
            method: "GET",
            onload: response => {
                let parser = new DOMParser();
                let doc = parser.parseFromString(response.responseText, 'text/html');
                let searchItems = doc.querySelectorAll('div[data-cid]');
                let articlesIDs = [];
                searchItems.forEach((article, key) => {
                    let cid = article.getAttribute('data-cid');
                    try {
                        let title = article.querySelector("h3").textContent;
                        let author = article.querySelector("div.gs_a").textContent;
                        if (!cid.startsWith("gs") && key < resultCount) {
                            articlesIDs.push({
                                id: cid,
                                title: title,
                                author: author
                            });
                        }
                    } catch (err) {
                        console.log(err);
                    }
                });
                resolve(articlesIDs);
            },
            onerror: err => {
                new Notify({
                    status: 'error',
                    title: 'Request failed',
                    text: 'Please verify your identification',
                    effect: 'slide',
                    type: 'filled'
                });
                reject(err);
            }
        });
    });
}

function getRefPageGoogleScholar(id) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            url: scholarRefPageURL(id),
            method: "GET",
            onload: res => {
                resolve(res.response);
            },
            onerror: err => {
                reject(err);
            }
        });
    });
}

function getBibTexGoogleScholar(id) {
    return new Promise((resolve, reject) => {
        getRefPageGoogleScholar(id).then(page => {
            let dom = document.createElement("div");
            dom.innerHTML = page;
            let first = dom.querySelector("#gs_citi>a.gs_citi").href;
            return GM_xmlhttpRequest({
                url: first,
                method: "GET",
                onload: (res) => {
                    resolve(res.responseText);
                },
                onerror: err => {
                    reject(err);
                }
            });
        }).catch(() => {
            new Notify({
                status: 'error',
                title: 'Request failed',
                text: 'Please verify your identification.',
                effect: 'slide',
                type: 'filled'
            });
            setTimeout(() => {
                GM_openInTab(currentOrigin());
            }, 1000);
            throw new Error("Not find BibTeX");
        });
    });
}

let showBox = false;
