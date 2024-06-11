const retrieve_all_card = document.getElementById('retrieve-all-card')
const retrieve_all_button = document.getElementById('retrieve-all-button')
const console_log = document.getElementById('console-log')
const console_block = document.getElementById('console-block')

const readLocalStorage = async (key) => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], function (result) {
            if (result[key] === undefined) {
                reject();
            } else {
                resolve(result[key]);
            }
        });
    });
};
document.getElementById('create-new-button').addEventListener('click', function () {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        document.getElementById('retrieve_name').value = tabs[0].title;
    });
    open_screen('create-new')
    let links = document.getElementsByClassName("table-link")
    let max_rows = 0;
    let max_ind = 0;
    for (let i = 0; i < links.length; i++) {
        if (parseInt(links[i].innerText) > max_rows) {
            max_rows = parseInt(links[i].innerText)
            max_ind = i;
        }
    }
    links[max_ind].click();
})
document.getElementById('create-new-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (save_retrieving_click(event)) {
        fill_connection_list();
        open_screen('main')
        return false;
    }
    return false;

});
document.getElementById("cancel-manage-button").addEventListener('click', function () {
    open_screen('main', true)
});
document.getElementById('delete-retrieving-button').addEventListener('click', delete_retrieving_click);
document.getElementById("cancel-schedule-button").addEventListener('click', function () {
    open_screen('main', true)
});
document.addEventListener("DOMContentLoaded", function () {

    recover_console();
    console_log.scrollTop = console_log.scrollHeight;

    chrome.storage.local.get('current_screen', function (data) {
        console.log('current_screen', data.current_screen);
        let current_screen = data.current_screen;
        if (current_screen) {
            switch (current_screen) {
                case "create-new":
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        document.getElementById('retrieve_name').value = tabs[0].title;
                    });
                    break;
                case "scheduler-edit":
                    sync_schedule_click(false);
            }
            open_screen(data.current_screen, false);
        }
    });
    fill_connection_list();
});

function exportToCsv(filename, rows) {
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

    let blob = new Blob([csvFile], {type: 'text/csv;charset=utf-8;'});
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        let link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
            // Browsers that support HTML5 download attribute
            let url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

const parse_table = (ind) => {
    let tables = document.getElementsByTagName("table");
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
            trs.push(tds);
        }

    }
    return trs
}
const getTables = () => {

    let tables = document.getElementsByTagName("table");
    let result = {"amount": tables.length, "tables": []}
    for (let index = 0; index < tables.length; index++) {

        result['tables'].push(tables[index].getElementsByTagName('tr').length)
    }
    return result;
}

function query_tables() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            func: getTables
        }, (result) => {
            if (!result) return;
            let res = result[0].result;
            Array.from(document.getElementsByClassName("table_amount")).forEach(function (element) {
                if (res) element.innerText = res['amount'];
            });
            let tables_element = document.getElementsByClassName('tables');
            Array.from(tables_element).forEach(function (table) {
                table.innerHTML = "";
            })
            let idcs = [];
            if (document.getElementById('table_id').value) {
                idcs = document.getElementById('table_id').value.split(",")
            }
            if (res) {
                for (let index = 0; index < res['tables'].length; index++) {

                    if (res['tables'][index] > 0) {
                        Array.from(tables_element).forEach(function (table_element) {
                            let span = document.createElement('span')
                            span.classList.add('table-link')
                            span.innerText = `${res['tables'][index]} rows`;
                            span.dataset.table_id = index
                            if (idcs.includes(index.toString()) && table_element.dataset.action === 'select') {
                                span.classList.toggle("bg-danger")
                                span.classList.toggle("bg-opacity-25")
                                span.classList.toggle("selected")

                            }
                            span.addEventListener('click', function () {
                                switch (table_element.dataset.action) {
                                    case "retrieve":
                                        break
                                    case "select":
                                        Array.from(table_element.getElementsByTagName('span')).forEach(function (el) {
                                            el.classList.remove('bg-danger')
                                            el.classList.remove('bg-opacity-25')
                                            el.classList.remove("selected")
                                        })
                                        span.classList.toggle("bg-danger")
                                        span.classList.toggle("bg-opacity-25")
                                        span.classList.toggle("selected")

                                        document.getElementById("table_id").value = ""
                                        table_element.querySelectorAll("span.selected").forEach(function (span_el) {
                                            document.getElementById("table_id").value += "," + span_el.dataset.table_id
                                        });
                                        document.getElementById("table_id").value = document.getElementById("table_id").value.replace(/^,+|,+$/g, '')
                                        let link_element = document.createElement("a")
                                        link_element.innerHTML = "download table csv"
                                        link_element.href = "#"
                                        link_element.addEventListener('click', function () {
                                            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                                                chrome.scripting.executeScript({
                                                    target: {tabId: tabs[0].id},
                                                    func: parse_table,
                                                    args: [index]
                                                }, (result) => {
                                                    exportToCsv("table.csv", result[0].result)
                                                });
                                            });
                                        })
                                        let csv_link_container = document.getElementById("to-csv-link-container")
                                        csv_link_container.innerHTML = "";
                                        csv_link_container.append(link_element)
                                        break
                                }
                            });
                            span.addEventListener("mouseover", function () {
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    "action": "focusTableByID",
                                    tableID: index,
                                    focus: true
                                });
                            })
                            span.addEventListener("mouseout", function () {
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    "action": "focusTableByID",
                                    tableID: index,
                                    focus: false
                                });
                            })
                            table_element.append(span)
                        });
                    }
                }
            }
        });
    });
}

query_tables();


retrieve_all_button.addEventListener('click', function () {
    chrome.storage.local.get('plugin_json_settings', async function (data) {
        if (data.plugin_json_settings) {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            chrome.runtime.sendMessage({"action": "retrieve_all", tabId: tab.id}, function (message) {
                console_add(message.message)
            })
        }
    })
})


function open_screen(id, store = true) {
    let screens = document.getElementsByTagName('screen');
    Array.from(screens).forEach(function (el) {
        el.classList.add('visually-hidden')
    })
    let visible_screen = document.querySelector(`screen#${id}`)
    visible_screen.classList.remove('visually-hidden')
    if (store) chrome.storage.local.set({current_screen: id});

}


function connection_action_click(event) {
    let id = event.target.dataset.id;
    switch (event.target.dataset.action) {
        case "sync":
            (async () => {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                chrome.runtime.sendMessage({"action": "retrieve_page", index: id, tabId: tab.id}, function (message) {
                        console_add(message.message)
                    }
                )
            })();
            break;
        case "manage":
            chrome.storage.local.get('plugin_json_settings', function (data) {
                (async () => {
                    let page = data.plugin_json_settings.pages[id];
                    let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tab.url != page.url) {
                        chrome.tabs.update(tab.id, {url: page.url})
                        chrome.webNavigation.onCompleted.addListener(async function onCompletted(details) {
                            if (details.frameId !== 0) return; // Only process top-frame requests
                            console.log("tab.id", tab.id, details.tabId)
                            if (tab.id === details.tabId) {

                                query_tables();
                                document.getElementById('retrieve_name').value = page.name;
                                document.getElementById('table_id').value = page.table_id;

                                document.getElementById('send_to_url').value = page.send_to_url ? page.send_to_url : "";
                                document.getElementById("auto_scroll").checked = page.scroll_attempts > 0
                                open_screen("create-new", false);
                                chrome.webNavigation.onCompleted.removeListener(onCompletted);
                            }
                        });
                    } else {
                        query_tables();
                        document.getElementById('retrieve_name').value = page.name;
                        document.getElementById('table_id').value = page.table_id;
                        document.getElementById('send_to_url').value = page.send_to_url ? page.send_to_url : "";
                        document.getElementById("auto_scroll").checked = page.scroll_attempts > 0
                        open_screen("create-new", false);
                    }
                    document.getElementById('delete-retrieving-button').dataset.id = id
                })();
            });
            break;
    }
}

function save_retrieving_click() {
    let required = true;
    document.querySelectorAll("#create-new-form input[required]").forEach(function (el) {
        if (!el.value) required = false;
    });
    if (!required) {
        return false;
    }


    chrome.storage.local.get('plugin_json_settings', function (data) {
        if (!data.plugin_json_settings) data.plugin_json_settings = {};
        (async () => {
            let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            let page = {
                name: document.getElementById('retrieve_name').value,
                url: tab.url,
                table_id: document.getElementById('table_id').value,
                send_to_url: document.getElementById('send_to_url').value,
                scroll_attempts: document.getElementById("auto_scroll").checked ? 5 : 0
            }

            let pages = data.plugin_json_settings.pages ? data.plugin_json_settings.pages : [];
            let index;
            let found = false;
            for (index = 0; index < pages.length; index++) {
                if (pages[index].name === page.name) {
                    found = true;
                    break;
                }
            }
            if (found) {
                pages[index] = {...pages[index], ...page};
            } else {
                pages.push(page);
            }
            data.plugin_json_settings.pages = pages
            await chrome.storage.local.set({plugin_json_settings: data.plugin_json_settings})
            fill_connection_list();
        })();
        return true;
    })

    return true;
}

function delete_retrieving_click(event) {
    event.preventDefault();
    let delbut = event.target
    if (confirm('Are you sure want to delete this connection?')) {

        chrome.storage.local.get('plugin_json_settings', function (data) {
            data.plugin_json_settings.pages.splice(delbut.dataset.id, 1)
            chrome.storage.local.set({plugin_json_settings: data.plugin_json_settings}, function () {
                fill_connection_list();
                open_screen('main')
            })
        });
    }
    return false;
}

function fill_connection_list() {

    chrome.storage.local.get('plugin_json_settings', function (data) {
        console.log(data)
        if (!data.plugin_json_settings) data.plugin_json_settings = {}
        let edc = document.getElementById('existing-data-connections');
        edc.innerHTML = "";
        let pages = data.plugin_json_settings.pages ? data.plugin_json_settings.pages : [];
        if (pages.length > 0) {
            document.getElementById('existing-data-connections-container').style.display = 'block';
            retrieve_all_card.style.display = 'block';
        }
        pages.forEach(function (page, index) {
            let row = document.createElement('tr')
            row.dataset.id = index
            let con_indicator = document.createElement('td');
            let con_name = document.createElement('td');
            let con_buttons = document.createElement('td');
            let button_sync = document.createElement("button")
            con_indicator.id = `connector-indicator-${index}`
            con_indicator.style.width = "1.5rem;"
            con_indicator.vAlign = 'top';
            button_sync.innerText = "Sync"
            button_sync.classList.add("btn", "btn-outline-dark", "m-1")
            button_sync.dataset.id = row.dataset.id
            button_sync.dataset.action = 'sync'
            button_sync.addEventListener('click', connection_action_click)
            let button_manage = document.createElement("button")
            button_manage.innerText = "Manage"
            button_manage.classList.add("btn", "btn-outline-dark")
            button_manage.dataset.id = row.dataset.id
            button_manage.dataset.action = 'manage'
            button_manage.addEventListener('click', connection_action_click)
            con_buttons.append(button_sync, button_manage)
            con_buttons.style.whiteSpace = "nowrap"
            row.append(con_indicator, con_name, con_buttons);
            con_name.innerHTML = `<strong>${page.name}</strong>`
            if (page.last_request) {
                con_indicator.dataset.toggle = "tooltip";
                con_indicator.dataset.placement = "top";
                if (page.last_request.message) con_indicator.setAttribute("title", page.last_request.message);
                let last_time = document.createElement('p')
                last_time.innerText = `${page.last_request.end_at}`
                last_time.style.fontSize = '0.7em'
                con_name.append(last_time)
                if (page.last_request.result === "FAIL") {
                    con_indicator.innerHTML = "<span style='color:red'>X</span>";
                } else {

                    con_indicator.innerHTML = "<span style='color:green'><img alt='OK' src='../staff/check.png' width='15'/> </span>";
                    last_time.innerText += `, ${page.last_request.message}`
                }
            }

            edc.append(row)

        })
        chrome.storage.local.get("retrieving_page_index", function (data) {
            if (data.retrieving_page_index !== undefined) {
                indicate_retrieving(data.retrieving_page_index)

            }
        })
    });
}

function indicate_retrieving(index) {
    let template = document.getElementById("spinner-template");
    let indicator = document.getElementById(`connector-indicator-${index}`)
    indicator.innerHTML = template.innerHTML
}

function write_to_console(message, type, time) {
    console_log.innerHTML += `<p class="${type}"><span class="badge bg-${type}">${time}</span> <span class="log-message">${message}</span></p>`;
    console_log.scrollTop = console_log.scrollHeight;
}

function console_add(message, type = "danger", store = true, time = null) {
    console_block.style.display = 'block';
    if (!message) return;
    console.log(message)
    if (!time) time = new Date().toLocaleString();
    write_to_console(message, type, time)
    if (store) chrome.storage.local.get('log', function (data) {

        if (!data.log) data.log = [];
        data.log.push({message, type, time})
        data.log = data.log.slice(data.log.length - 100, data.log.length)
        chrome.storage.local.set({'log': data.log})
    })

}

function recover_console() {
    chrome.storage.local.get('log', function (data) {
        if (data.log) {
            for (let line of data.log) {
                write_to_console(line.message, line.type, line.time)
            }
        }
    });
}


document.getElementById('sync-schedule-button').addEventListener('click', sync_schedule_click);
chrome.runtime.onMessage.addListener(function (request) {
    console.log('request', request);
    switch (request.action) {
        case "open_page":
            indicate_retrieving(request.index)
            break;
        case "page_process_finished":
            fill_connection_list();
            break;
        case "log":
            console_add(request.message, request.type ? request.type : "danger", false)
            break;

    }
    if (request.log) {
        if (request.log.message) console_add(request.log.message, request.log.type ? request.log.type : "danger")
    }
});
document.getElementById('console-close').addEventListener('click', function () {
    document.getElementById('console-block').style.display = 'none';
})

async function save_schedule_click() {
    let required = true;
    document.querySelectorAll("#scheduler-settings input[required]").forEach(function (el) {
        if (!el.value) required = false;
    });
    if (!required) {
        return false;
    }
    await chrome.storage.local.get('plugin_json_settings', function (data) {
        if (!data.plugin_json_settings) data.plugin_json_settings = {}
        if (!data.plugin_json_settings.crontab) data.plugin_json_settings.crontab = {};
        (async () => {
            data.plugin_json_settings.crontab.enabled = document.getElementById("schedule_enable").checked
            data.plugin_json_settings.crontab.interval = document.querySelector('input[name="schedule_interval"]:checked').value;
            await chrome.storage.local.set({plugin_json_settings: data.plugin_json_settings})
        })();
        return true;
    })
    return true

}

document.getElementById('scheduler-settings').addEventListener('submit', function (event) {
    event.preventDefault();
    if (save_schedule_click(event)) {
        open_screen('main')
        return false;
    }
    return false;

});

function sync_schedule_click(open = true) {
    (async () => {
        await chrome.storage.local.get('plugin_json_settings', function (data) {
            if (data.plugin_json_settings && data.plugin_json_settings.crontab) {
                document.getElementById("schedule_enable").checked = data.plugin_json_settings.crontab.enabled;
                setCheckedValueOfRadioButtonGroup("schedule_interval", data.plugin_json_settings.crontab.interval)
            } else {
                setCheckedValueOfRadioButtonGroup("schedule_interval", "1h")
            }
            if (open) open_screen('scheduler-edit')
        })
    })();
}

/**
 * setCheckedValueOfRadioButtonGroup
 * @param {name of input type=radio} radio_name
 * @param {the radiobutton with this value will be checked} vValue
 */
function setCheckedValueOfRadioButtonGroup(radio_name, vValue) {
    var radios = document.getElementsByName(radio_name);
    for (var j = 0; j < radios.length; j++) {
        if (radios[j].value === vValue) {
            radios[j].checked = true;
            break;
        }
    }
}
