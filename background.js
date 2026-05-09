chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('background received message:', message);
    if (message.target !== 'background') return;

    switch (message.type) {
        case 'complete-video-progress': {
            await completeVideoProgress(message.data);
            break;
        }
        case 'get-video-progress': {
            const {courseId, itemId, xn_api_token} = message.data;
            const status = await getVideoStatus(courseId, itemId, xn_api_token);
            sendMessageToPopup('set-video-progress', {
                percent: status.progress / status.duration * 100,
                is_completed: status.is_completed,
                duration: status.duration,
                progress: status.progress,
            });
            break;
        }
        default:
            console.warn('background received message with unknown type:', message);
            break;
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
