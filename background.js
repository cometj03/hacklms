chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message);
    if (message.target !== 'background') return;

    switch (message.type) {
        case 'complete-video-progress': {
            await completeVideoProgress(message.data);
            break;
        }
        case 'get-video-progress': {
            const {courseId, itemId, xn_api_token} = message.data;
            const progress = await getVideoProgress(courseId, itemId, xn_api_token);
            sendMessageToPopup('set-video-progress', {
                percent: progress.last_at / progress.duration * 100,
                is_completed: progress.is_completed,
            });
            break;
        }
    }
});

async function getVideoProgress(courseId, itemId, token) {
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
    const last_at = json.attendance_data?.last_at ?? 0;
    const is_completed = json.attendance_data?.completed ?? false;
    return { duration, last_at, is_completed };
}

async function completeVideoProgress(data) {
    const {targetUrl, courseId, itemId, xn_api_token} = data;
    console.assert(targetUrl && courseId && itemId && xn_api_token, 'these params shoud be exist');

    const {duration, last_at} = await getVideoProgress(courseId, itemId, xn_api_token);
    let time = last_at;
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

        const progress = await getVideoProgress(courseId, itemId, xn_api_token);
        sendMessageToPopup('set-video-progress', {
            percent: time / duration * 100, 
            is_completed: progress.is_completed,
        });
        console.log(`${time / duration * 100}% 완료`, {time, delta});
    } while (time < duration);
}

function sendMessageToPopup(type, data) {
    chrome.runtime.sendMessage({target: 'popup', type, data});
}

// video download
/*
chrome.downloads.download({
    url: request.url,
    filename: "ssmovie.mp4",
    headers: [
    { name: "Referer", value: "https://commons.ssu.ac.kr/" }
    ],
    saveAs: true // 사용자가 저장 위치를 선택하게 함
}, (downloadId) => {
    if (chrome.runtime.lastError) {
    sendResponse({ status: "error", message: chrome.runtime.lastError.message });
    } else {
    sendResponse({ status: "success", id: downloadId });
    }
});    
*/

// 배속 방지 리스너 제거
// video.removeEventListener('ratechange', getEventListeners(video).ratechange[0].listener)


// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file
