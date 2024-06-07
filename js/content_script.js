function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTablesLength() {
    let tables = document.getElementsByTagName("table");
    if (tables.length === 0) return "";
    return tables.length;
}

function createCSVBlob(rows) {

    let processRow = function (row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            }

            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '';
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    return new Blob([csvFile], {type: 'text/csv;charset=utf-8;'});
}


async function parse_table(ind, scroll_count = 5) {
    await sleep(3000);
    await scroll_attempts(scroll_count);
    let tables = document.getElementsByTagName("table");
    console.log('Tables count', tables.length)
    let iterations = 0;
    while (ind > tables.length - 1 && iterations < 10) {
        iterations++;
        console.log(`no table ${ind}, await 1000`)
        await sleep(1000);
        tables = document.getElementsByTagName("table");
    }
    // table not found
    if (ind > tables.length - 1) {
        console.log('cant wait anymore')
        return false;
    }
    let THs = tables[ind].getElementsByTagName('th')
    let ths = [];
    for (let index = 0; index < THs.length; index++) {
        ths.push(THs[index].innerText);
    }
    let TRs = tables[ind].getElementsByTagName("tr");
    let trs = [];
    trs.push(ths);
    for (let row_index = 0; row_index < TRs.length; row_index++) {
        let tr = TRs[row_index];
        let TDs = tr.getElementsByTagName("td");
        let tds = [];
        for (let column_index = 0; column_index < TDs.length; column_index++) {
            tds.push(TDs[column_index].innerText);
        }
        if (tds.length > 0) {
            // If tds count less than in first row, continue
            if (row_index > 0 && tds.length < trs[0].length) continue;
            trs.push(tds);
        }

    }
    return trs
}

const convertBlobToBase64 = blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data);
    };
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    (async () => {
        switch (request.action) {
            case "getTablesCount":
                sendResponse({count: getTablesLength()})
                break
            case "focusTableByID":
                let tables = document.getElementsByTagName("table");
                let table = tables[request.tableID];
                if (table) {
                    if (request.focus) {
                        table.scrollIntoView();
                        table.setAttribute("retrieve-border", table.style.border);
                        table.style.border = "3px solid red";
                    } else {

                        table.style.border = table.getAttribute("retrieve-border");
                    }
                }
                break;
            case "parse_table":
                console.log('get request to retrieve table')
                let rows = await parse_table(request.table_id, request.scroll_attempts)
                if (!rows) {
                    sendResponse({rows: false})
                    break;
                }
                console.log(request);
                if (request.send_to_url) {
                    let blob = createCSVBlob(rows);
                    let blob_send = await convertBlobToBase64(blob);
                    sendResponse({rows: rows, blob: blob_send})
                } else {
                    sendResponse({rows: rows});
                }
                break
        }
    })();
    return true;
});

const ElementsWithScrolls = (function () {
    var getComputedStyle = document.body && document.body.currentStyle ? function (elem) {
        return elem.currentStyle;
    } : function (elem) {
        return document.defaultView.getComputedStyle(elem, null);
    };

    function getActualCss(elem, style) {
        return getComputedStyle(elem)[style];
    }

    function isXScrollable(elem) {
        return elem.offsetWidth < elem.scrollWidth &&
            autoOrScroll(getActualCss(elem, 'overflow-x'));
    }

    function isYScrollable(elem) {
        return elem.offsetHeight < elem.scrollHeight &&
            autoOrScroll(getActualCss(elem, 'overflow-y'));
    }

    function autoOrScroll(text) {
        return text == 'scroll' || text == 'auto';
    }

    function hasScroller(elem) {
        return isYScrollable(elem) || isXScrollable(elem);
    }

    return function ElemenetsWithScrolls() {
        return [].filter.call(document.querySelectorAll('*'), hasScroller);
    };
})();


async function scroll_attempts(scroll_count) {
    for (let i = 0; i < scroll_count; i++) {
        console.log(`scroll ${i}`)
        window.scrollTo({left: 0, top: document.body.scrollHeight, behavior: "smooth"});
        for (let el of ElementsWithScrolls()) {
            el.scrollTo(0, el.scrollHeight);
        }
        await sleep(2000);
    }
}