const REFERER_RULE_ID = 1;

async function setupRefererRule() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [REFERER_RULE_ID],
        addRules: [{
            id: REFERER_RULE_ID,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'Referer', operation: 'set', value: 'https://commons.ssu.ac.kr/' }
                ]
            },
            condition: {
                urlFilter: '||commonscdn.com/',
                resourceTypes: ['xmlhttprequest', 'media', 'other', 'main_frame', 'sub_frame']
            }
        }]
    });
}

chrome.runtime.onInstalled.addListener(setupRefererRule);
chrome.runtime.onStartup.addListener(setupRefererRule);

// === Captured MP4 URL cache (tabId → URL) ===
// 영상 player가 fetch하는 본 컨텐츠 mp4 요청을 가로채서 popup이 다운로드할 URL을 결정
const capturedMp4Urls = new Map();

const INTRO_PATTERN = /\/uniplayer\/intro\.mp4(\?|$)/;
const MAIN_PATTERN = /\/media_files\/[^/?]+\.mp4(\?|$)/;

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const { tabId, url } = details;
        if (tabId < 0) return;
        if (INTRO_PATTERN.test(url)) return;
        if (!MAIN_PATTERN.test(url)) return;
        // Range request로 같은 URL이 반복되니 첫 매칭만 기록
        if (capturedMp4Urls.has(tabId)) return;
        capturedMp4Urls.set(tabId, url);
    },
    { urls: ['*://*.commonscdn.com/*'] }
);

// canvas 페이지가 새 main_frame 로드되면 그 탭 캐시 클리어
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.tabId >= 0) capturedMp4Urls.delete(details.tabId);
    },
    { urls: ['*://canvas.ssu.ac.kr/*'], types: ['main_frame'] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
    capturedMp4Urls.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('background received message:', message);
    if (message.target !== 'background') return;

    switch (message.type) {
        case 'complete-video-progress': {
            completeVideoProgress(message.data);
            return;
        }
        case 'get-video-progress': {
            const {courseId, itemId, xn_api_token} = message.data;
            getVideoStatus(courseId, itemId, xn_api_token).then(status => {
                sendMessageToPopup('set-video-progress', {
                    percent: status.progress / status.duration * 100,
                    is_completed: status.is_completed,
                    duration: status.duration,
                    progress: status.progress,
                });
            });
            return;
        }
        case 'get-captured-mp4': {
            const tabId = message.data?.tabId;
            sendResponse({ videoUrl: capturedMp4Urls.get(tabId) ?? null });
            return;
        }
        default:
            console.warn('background received message with unknown type:', message);
            return;
    }
});

async function getVideoStatus(courseId, itemId, token) {
    const res = await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/${courseId}/attendance_items/${itemId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!res.ok) {
        console.warn('check: response failed', res);
        // TODO: error handling
        return null;
    }
    const json = await res.json();
    const duration = json.item_content_data?.duration ?? 1; // 1 이상의 값이어야 함
    const progress = json.attendance_data?.progress ?? 0;
    const is_completed = json.attendance_data?.completed ?? false;
    return { duration, progress, is_completed };
}

async function completeVideoProgress(data) {
    const {targetUrl, courseId, itemId, xn_api_token} = data;
    console.assert(targetUrl && courseId && itemId && xn_api_token, 'these params shoud be exist');

    const {duration, progress} = await getVideoStatus(courseId, itemId, xn_api_token);
    let time = progress;
    let delta = 60;
    do {
        time += delta;
        if (time > duration) time = duration;
        
        const res = await fetch(`${targetUrl}&callback=aaa&state=8&duration=${duration}&currentTime=${time}&cumulativeTime=${time}`); // todo: duration 정하기
        if (!res.ok) {
            sendMessageToPopup('complete-video-progress-error', {errorMessage: 'response failed', time, delta});
            break;
        }
        const text = await res.text();
        const json = JSON.parse(text.replace('aaa(', '').replace(')', ''));
        if (json.error_code) {
            // console.warn('error:', json.error_code, {time});
            time -= delta;
            delta = 60;
        } else {
            delta += 60;
        }

        const status = await getVideoStatus(courseId, itemId, xn_api_token);
        sendMessageToPopup('set-video-progress', {
            percent: time / duration * 100,
            is_completed: status.is_completed,
            duration: status.duration,
            progress: status.progress,
        });
        console.log(`${time / duration * 100}% 완료`, {time, delta});
    } while (time < duration);
}

function sendMessageToPopup(type, data) {
    chrome.runtime.sendMessage({target: 'popup', type, data});
}

// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file
