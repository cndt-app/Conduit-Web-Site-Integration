const log_body = document.getElementById('log')
const console_log_big = document.getElementById('console-log')

function write_to_console(message, type, time) {
    console_log_big.innerHTML += `<p class="${type}"><span class="badge bg-${type}">${time}</span> <span class="log-message">${message}</span></p>`;
    // log_body.scrollTop = log_body.scrollHeight;
}


function recover_console() {
    chrome.storage.local.get('log', function (data) {
        if (data.log) {
            console_log_big.innerHTML = ""
            for (let line of data.log) {
                write_to_console(line.message, line.type, line.time)
            }
            console_log_big.scrollTop = console_log_big.scrollHeight;
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    recover_console();
})