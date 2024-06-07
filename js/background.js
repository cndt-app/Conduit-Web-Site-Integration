chrome.action.setBadgeBackgroundColor({color: 'purple'});
chrome.action.setBadgeTextColor({color: 'white'});
var job_running = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, type = 'danger') {
    console.log(type, message);
    chrome.runtime.sendMessage({action: "log", message: message, type: type})

}

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

chrome.tabs.onActivated.addListener(function (info) {
    console.log(info);
    chrome.tabs.sendMessage(info.tabId, {action: "getTablesCount"}, function (response) {
        console.log(response);
        if (response) {
            chrome.action.setBadgeText({text: `${response.count}`})
        } else {
            chrome.action.setBadgeText({text: ""})

        }
    });
});
chrome.tabs.onUpdated.addListener(function (tabId) {
    chrome.tabs.sendMessage(tabId, {action: "getTablesCount"}, function (response) {
        if (response) {
            chrome.action.setBadgeText({text: `${response.count}`})
        } else {
            chrome.action.setBadgeText({text: ""})

        }
    });

})
chrome.tabs.onCreated.addListener(
    function () {
        chrome.action.setBadgeText({text: ""})
    }
)

async function open_url(tab_id, url, table_id, name = 'table', scroll_attempts = 1, send_to_url = null) {
    console.log(url, tab_id)
    chrome.tabs.update(tab_id, {url});

    return new Promise((resolve, reject) => {
            try {
                let tmout;

                async function onCompletted(details) {
                    if (details.frameId !== 0) {
                        return;
                    } // Only process top-frame requests
                    console.log('tmout', tmout);
                    clearTimeout(tmout)
                    console.log("tab.id", tab_id, details.tabId)
                    if (tab_id === details.tabId) {
                        console.log('send message to parse table')
                        chrome.tabs.sendMessage(tab_id, {
                            action: "parse_table",
                            table_id: table_id,
                            name: name,
                            send_to_url: send_to_url,
                            scroll_attempts: scroll_attempts
                        }).then(function (responseCT) {
                            console.log(responseCT);
                            if (!responseCT.rows) {
                                reject({
                                    error_type: 'Error on page',
                                    message: 'There is no required table! May be you need to authorize in 3d part service'
                                })
                                chrome.webNavigation.onCompleted.removeListener(onCompletted);
                                return;
                            }
                            if (send_to_url) {
                                let send_url;
                                try {
                                    send_url = new URL(send_to_url);
                                } catch (e) {
                                    reject({error_type: 'Options error', message: e})
                                    chrome.webNavigation.onCompleted.removeListener(onCompletted);
                                    return;
                                }
                                (async () => {
                                    const blob_resp = await fetch(responseCT.blob);
                                    console.log(blob_resp);
                                    let blob = await blob_resp.blob();
                                    console.log(blob)
                                    let fd = new FormData()
                                    fd.append("file", blob)
                                    if (!send_url.searchParams.has('update')) {
                                        send_url.searchParams.append('update', '1')
                                    }
                                    fetch(send_url,
                                        {
                                            method: 'POST',
                                            body: fd
                                        }
                                    ).then(async function (response) {
                                        if (response.ok) {
                                            response.message = `${responseCT.rows.length} rows`
                                            resolve(response);
                                        } else {
                                            response.error_type = "Http status"
                                            response.message = await response.text()
                                            throw response;
                                        }
                                    }).catch(async (error) => {
                                        reject(error);
                                    })
                                })();
                            } else {
                                reject({error_type: 'Options error', message: "Url is not configured"})
                            }

                        });

                        chrome.webNavigation.onCompleted.removeListener(onCompletted);
                    }
                    return true;
                }

                chrome.webNavigation.onCompleted.addListener(onCompletted);

                tmout = setTimeout(() => {
                    console.log('timeout raised')
                    reject({error_type: 'Timeout', message: "can't fetch data"});
                    chrome.webNavigation.onCompleted.removeListener(onCompletted);
                }, 30000)
                //catch
            } catch (e) {
                reject({status: "Error fetch data", message: JSON.stringify(e)});
            }
        }
    );

}

async function open_page_object(pages, index, tabId, auto_interval = false) {
    let page = pages[index];
    page['last_request'] = {"begin_at": new Date().toLocaleString()}
    console.log(`open ${page.url}`)
    chrome.runtime.sendMessage({action: "open_page", index: index})
    chrome.storage.local.set({"retrieving_page_index": index})
    let message = {
        action: "page_process_finished",
        index: index
    }
    await open_url(tabId, page.url, page.table_id, page.name, page.scroll_attempts, page.send_to_url)
        .then((response) => {
            page['last_request']['result'] = "OK";
            page['last_request']['message'] = response.message
            message['log'] = {}
            message['log']['message'] = `${page.name}: ${response.message}`
            message['log']['type'] = 'success'
        })
        .catch((error) => {
            console.log('error', error)
            let error_message = '';
            if (error.error_type) error_message += `${error.error_type}`;
            if (error.status) error_message += ` ${error.status}:`
            error_message += ` ${error.message}`

            if (error_message) {
                message['log'] = {}
                message['log']['message'] = error_message;
                message['log']['type'] = 'danger'
            }
            page['last_request']['result'] = "FAIL";
            page['last_request']['message'] = error_message
        }).finally(() => {
            chrome.storage.local.remove("retrieving_page_index")
            page['last_request']['end_at'] = new Date().toLocaleString();
            chrome.storage.local.get("plugin_json_settings", function (data) {
                data.plugin_json_settings.pages[index] = {...data.plugin_json_settings.pages[index], ...page}
                console.log(data.plugin_json_settings)
                chrome.storage.local.set({plugin_json_settings: data.plugin_json_settings})
                chrome.runtime.sendMessage(message)
            })

        })

    if (auto_interval) {
        await sleep(auto_interval * 5000);
    }

}

var cronTabId = null;


async function create_cron_tab() {

    return await chrome.tabs.create({active: false});
}

async function retrieve_all(tabId, from_cron = false) {
    let tab;
    if (!tabId) {
        tab = await create_cron_tab();
    } else {
        try {
            tab = await chrome.tabs.get(tabId);
        } catch (e) {

            log(JSON.stringify(e), "warning")
            tab = await create_cron_tab();
        }
    }
    tabId = tab.id;
    if (from_cron) {
        cronTabId = tabId;
    }
    let plugin_json_settings = await readLocalStorage('plugin_json_settings');
    if (plugin_json_settings) {

        for (let index = 0; index < plugin_json_settings.pages.length; index++) {
            await open_page_object(plugin_json_settings.pages, index, tabId, plugin_json_settings.auto_interval)
        }
    }

}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(message);
    let tabId = message.tabId
    switch (message.action) {
        case "retrieve_all":
            (async () => {
                if (!job_running) {
                    job_running = true;
                    await retrieve_all(tabId);
                    job_running = false;
                } else {

                    log("Job already in progress. Can't run multiple tasks!", 'warning')
                }
            })();
            break;
        case "retrieve_page":
            console.log('job_runing', job_running)
            if (!job_running) {
                chrome.storage.local.get('plugin_json_settings', async function (data) {
                    if (data.plugin_json_settings) {
                        let index = message.index;
                        job_running = true;
                        await open_page_object(data.plugin_json_settings.pages, index, message.tabId, data.plugin_json_settings.auto_interval)
                        job_running = false;
                    }
                })
            } else {
                log("Job already in progress. Can't run multiple tasks!", 'warning')
            }
            break;


    }
    sendResponse({action: 'ok', error: ''})
})

async function run_schedule_task() {
    if (!job_running) {
        job_running = true;
        log("Start sync all", "success")
        await retrieve_all(cronTabId, true);
        log("Finish sync all", "success")
        job_running = false;
    } else {
        log("Can't run Schedule task. Another job is already running!", "warning")

    }
}

function cron() {
    console.log('cron job running')
    chrome.storage.local.get('plugin_json_settings', async function (data) {
        if (data.plugin_json_settings && data.plugin_json_settings.crontab && data.plugin_json_settings.crontab.enabled) {
            let dt = new Date();
            let hour = dt.getHours();
            let minutes = dt.getMinutes();
            let run = false;
            if (data.plugin_json_settings.crontab.interval.indexOf('h') > -1) {
                console.log('hour', hour)
                if (hour % parseInt(data.plugin_json_settings.crontab.interval) == 0 && minutes == 0) {
                    run = true;
                }
            } else {
                console.log('minutes', minutes);
                if (minutes % parseInt(data.plugin_json_settings.crontab.interval) == 0) {
                    run = true;
                }
            }
            if (run) {
                await run_schedule_task();
            }
        }
    });
}

var cron_interval = setInterval(cron, 60000)
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
setTimeout(cron, 5000);

//todo sometimes first connection in schedule dosn't have a spinner
//todo after reload of app can circle previous spinner