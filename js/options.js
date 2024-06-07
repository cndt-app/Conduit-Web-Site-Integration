const form_settings = document.getElementById('form_settings');
const form_error = document.getElementById('error');
const load_defaults = document.getElementById('load_defaults');

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const default_value = {
    "auto_interval": 1,
    "auto_is_enabled": true,
    "pages": [
        {
            "name": "",
            "path": "",
            "scroll_attempts": "",
            "send_to_url": "",
            "table_id": "",
            "url": ""
        },
        {
            "name": "",
            "path": "",
            "scroll_attempts": "",
            "send_to_url": "",
            "table_id": "",
            "url": ""
        }
    ]
}

document.addEventListener("DOMContentLoaded", function () {
    chrome.storage.local.get('plugin_json_settings', function (data) {
        if (!data.plugin_json_settings) {
            data.plugin_json_settings = default_value;
        }
        form_settings.innerHTML = JSON.stringify(data.plugin_json_settings, undefined, 4)
    });
});
form_settings.addEventListener('keyup', function (ev) {
    ev.preventDefault();
    let new_settings = form_settings.value
    if (!isJsonString(new_settings)) {
        form_error.innerText = "Bad JSON";
        return false;
    } else {
        form_error.innerText = "";
    }
    chrome.storage.local.set({plugin_json_settings: JSON.parse(form_settings.value)}, function () {
    });
    return false;
});
load_defaults.addEventListener('click', function () {
    if (confirm('Are you sure want to replace settings to default value?')) {
        chrome.storage.local.set({plugin_json_settings: default_value}, function () {
            chrome.storage.local.get('plugin_json_settings', function (data) {
                form_settings.innerHTML = JSON.stringify(data.plugin_json_settings, undefined, 4)
            });
        })

    }
})